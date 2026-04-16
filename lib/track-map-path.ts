import type {
  Location,
  LocationHistoryEntry,
} from '@/components/interfaces/location.interface';
import { bearingDeg, haversineMeters, segmentSpeedMS } from '@/lib/geo';

export type TrackEntry = LocationHistoryEntry & {
  /** `true` when this entry represents the live current position, not a history ping. */
  isLive?: boolean;
};

export type TrackSegment = {
  source: 'gps' | 'ip';
  /** Ordered list of entry indices into the denoised `entries` array. */
  indices: number[];
  points: [number, number][];
};

/**
 * A "gap" is the unobservable interval between two consecutive entries whose
 * second entry reports `gapBeforeMs > GAP_BREAK_MS` (page was backgrounded).
 * We surface it as its own span so the map can render a dashed "offline"
 * connector instead of a straight line across unknown territory.
 */
export type GapSpan = {
  /** Index into `entries` of the point BEFORE the gap. */
  fromIndex: number;
  /** Index into `entries` of the point AFTER the gap. */
  toIndex: number;
  from: [number, number];
  to: [number, number];
  /** Gap duration (ms) as reported by the tracker. */
  durationMs: number;
};

export type TrackStats = {
  distanceM: number;
  durationMs: number;
  avgSpeedKmh: number | null;
  peakSpeedKmh: number | null;
  /** Clusters of ≥3 consecutive points within `STOP_RADIUS_M` for ≥ `STOP_MIN_MS`. */
  stops: number;
  /** Number of backgrounded gaps detected from `gapBeforeMs`. */
  gapCount: number;
  /** Total hidden time (ms) summed across gaps. */
  gapMs: number;
};

export type ArrowMarker = {
  position: [number, number];
  bearing: number;
};

const ACCURACY_MAX_M = 2000;
const MAX_SPEED_MS = 83.33;
const STOP_RADIUS_M = 40;
const STOP_MIN_MS = 5 * 60_000;
/**
 * Gaps of this size or greater break the polyline. Matches the writer's
 * `GAP_BREAK_MS` in `app/track/TrackClient.tsx`.
 */
const GAP_BREAK_MS = 30_000;

export function parseHistoryEntries(history: Location['history']): LocationHistoryEntry[] {
  if (!history) return [];
  const raw = Array.isArray(history)
    ? [...history]
    : typeof history === 'object'
      ? (Object.values(history as Record<string, LocationHistoryEntry>) as LocationHistoryEntry[])
      : [];
  return raw
    .filter(
      (e) =>
        e &&
        typeof e.latitude === 'number' &&
        typeof e.longitude === 'number' &&
        Number.isFinite(e.latitude) &&
        Number.isFinite(e.longitude)
    )
    .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
}

/**
 * Remove likely-bad entries:
 * - accuracy &gt; ACCURACY_MAX_M (usually city-level IP junk or a GPS blip).
 * - speed since previous kept point &gt; MAX_SPEED_MS (GPS teleports).
 */
export function denoiseEntries(entries: LocationHistoryEntry[]): LocationHistoryEntry[] {
  const cleaned: LocationHistoryEntry[] = [];
  for (const e of entries) {
    if (e.accuracy != null && e.accuracy > ACCURACY_MAX_M) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev) {
      const tsA = Number(prev.ts) || 0;
      const tsB = Number(e.ts) || 0;
      // Never filter across a backgrounded gap: the teleport is real and
      // we explicitly want to preserve the resume point.
      const isGapCrossing =
        typeof e.gapBeforeMs === 'number' && e.gapBeforeMs >= GAP_BREAK_MS;
      if (!isGapCrossing && tsA > 0 && tsB > 0) {
        const speed = segmentSpeedMS(
          [prev.latitude, prev.longitude],
          [e.latitude, e.longitude],
          tsA,
          tsB
        );
        if (speed != null && speed > MAX_SPEED_MS) continue;
      }
    }
    cleaned.push(e);
  }
  return cleaned;
}

/** Returns gap spans between consecutive entries, based on `gapBeforeMs`. */
export function findGaps(entries: TrackEntry[]): GapSpan[] {
  const out: GapSpan[] = [];
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    const g = typeof e.gapBeforeMs === 'number' ? e.gapBeforeMs : 0;
    if (g >= GAP_BREAK_MS) {
      const prev = entries[i - 1];
      out.push({
        fromIndex: i - 1,
        toIndex: i,
        from: [prev.latitude, prev.longitude],
        to: [e.latitude, e.longitude],
        durationMs: g,
      });
    }
  }
  return out;
}

/** True when `to` begins a new observable segment after a backgrounded gap. */
function isGapCrossing(to: TrackEntry | undefined): boolean {
  return !!to && typeof to.gapBeforeMs === 'number' && to.gapBeforeMs >= GAP_BREAK_MS;
}

/**
 * Split a denoised entry list into contiguous runs of the same `locationSource`,
 * breaking on backgrounded gaps so we never draw a straight line across
 * intervals where we were blind.
 */
export function segmentPath(entries: LocationHistoryEntry[]): TrackSegment[] {
  const segs: TrackSegment[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const source: TrackSegment['source'] = e.locationSource === 'ip' ? 'ip' : 'gps';
    const cur = segs[segs.length - 1];
    const breakHere = isGapCrossing(e);
    if (cur && cur.source === source && !breakHere) {
      cur.indices.push(i);
      cur.points.push([e.latitude, e.longitude]);
    } else {
      // Bridge the previous segment with the current point ONLY when there
      // is no gap; otherwise start a fresh segment with just the new point.
      if (cur && cur.points.length > 0 && !breakHere) {
        cur.indices.push(i);
        cur.points.push([e.latitude, e.longitude]);
      }
      segs.push({ source, indices: [i], points: [[e.latitude, e.longitude]] });
    }
  }
  return segs;
}

export type VisitorTrack = {
  /** Full denoised list (time order) with a synthetic tail entry for the current position when distinct. */
  entries: TrackEntry[];
  /** Full ordered polyline (same length as `entries`). */
  path: [number, number][];
  /** GPS/IP segments over the full `entries`. */
  segments: TrackSegment[];
  /** Observable gaps (backgrounded intervals) between consecutive entries. */
  gaps: GapSpan[];
  hasTrail: boolean;
  /** GPS accuracy (m) for uncertainty ring at the live position, when sensible. */
  lastAccuracyM: number | null;
  hasLivePosition: boolean;
  firstPingTs: number | null;
  lastPingTs: number | null;
  stats: TrackStats;
};

/**
 * Build a single visitor path for map visualization: first ping → … → current.
 */
export function buildVisitorTrack(loc: Location): VisitorTrack {
  const rawEntries = parseHistoryEntries(loc.history);
  const entries: TrackEntry[] = denoiseEntries(rawEntries);

  const curLat = loc.latitude;
  const curLng = loc.longitude;
  const hasLive =
    typeof curLat === 'number' &&
    typeof curLng === 'number' &&
    Number.isFinite(curLat) &&
    Number.isFinite(curLng);

  if (hasLive) {
    const last = entries[entries.length - 1];
    const distinct =
      !last ||
      Math.abs(last.latitude - curLat) > 1e-5 ||
      Math.abs(last.longitude - curLng) > 1e-5;
    if (distinct) {
      entries.push({
        latitude: curLat!,
        longitude: curLng!,
        accuracy: null,
        locationSource: (loc.locationSource ?? (last?.locationSource ?? 'gps')) as
          | 'gps'
          | 'ip',
        ts: Number(loc.updatedAt) || Date.now(),
        isLive: true,
      });
    } else if (last) {
      last.isLive = true;
    }
  }

  const path: [number, number][] = entries.map((e) => [e.latitude, e.longitude]);
  const segments = segmentPath(entries);
  const gaps = findGaps(entries);

  let lastAccuracyM: number | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.locationSource === 'gps' && e.accuracy != null && e.accuracy > 0) {
      lastAccuracyM = e.accuracy;
      break;
    }
  }
  if (lastAccuracyM != null && (lastAccuracyM <= 0 || lastAccuracyM > 5000)) {
    lastAccuracyM = null;
  }

  const firstPingTs = firstValidTs(entries);
  const lastPingTs = lastValidTs(entries);
  const stats = computeTrackStats(entries);

  return {
    entries,
    path,
    segments,
    gaps,
    hasTrail: path.length >= 2,
    lastAccuracyM,
    hasLivePosition: hasLive,
    firstPingTs,
    lastPingTs,
    stats,
  };
}

function firstValidTs(entries: TrackEntry[]): number | null {
  for (const e of entries) {
    const t = Number(e.ts);
    if (Number.isFinite(t) && t > 0) return t;
  }
  return null;
}

function lastValidTs(entries: TrackEntry[]): number | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const t = Number(entries[i].ts);
    if (Number.isFinite(t) && t > 0) return t;
  }
  return null;
}

/**
 * Distance, duration, speeds, stop count computed from a denoised entry list.
 */
export function computeTrackStats(entries: TrackEntry[]): TrackStats {
  let distanceM = 0;
  let peakSpeedMS = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let observedMs = 0;
  let gapMs = 0;
  let gapCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const t = Number(e.ts);
    if (Number.isFinite(t) && t > 0) {
      if (firstTs == null) firstTs = t;
      lastTs = t;
    }
    if (i > 0) {
      const prev = entries[i - 1];
      const tsA = Number(prev.ts);
      const tsB = Number(e.ts);
      const gap = isGapCrossing(e);
      if (gap) {
        gapCount += 1;
        gapMs += typeof e.gapBeforeMs === 'number' ? e.gapBeforeMs : 0;
        continue;
      }
      distanceM += haversineMeters(
        [prev.latitude, prev.longitude],
        [e.latitude, e.longitude]
      );
      if (Number.isFinite(tsA) && Number.isFinite(tsB) && tsB > tsA) {
        observedMs += tsB - tsA;
        const s = segmentSpeedMS(
          [prev.latitude, prev.longitude],
          [e.latitude, e.longitude],
          tsA,
          tsB
        );
        if (s != null && s > peakSpeedMS) peakSpeedMS = s;
      }
    }
  }

  const wallMs = firstTs != null && lastTs != null ? lastTs - firstTs : 0;
  const durationMs = Math.max(0, wallMs - gapMs);
  const durationS = (observedMs > 0 ? observedMs : durationMs) / 1000;
  const avgSpeedKmh = durationS > 0 ? (distanceM / durationS) * 3.6 : null;
  const peakSpeedKmh = peakSpeedMS > 0 ? peakSpeedMS * 3.6 : null;

  let stops = 0;
  let cluster: TrackEntry[] = [];
  const flushCluster = () => {
    if (cluster.length < 3) return;
    const tsA = Number(cluster[0].ts) || 0;
    const tsB = Number(cluster[cluster.length - 1].ts) || 0;
    if (tsA > 0 && tsB - tsA >= STOP_MIN_MS) stops += 1;
  };
  for (const e of entries) {
    if (cluster.length === 0) {
      cluster = [e];
      continue;
    }
    const anchor = cluster[0];
    const d = haversineMeters(
      [anchor.latitude, anchor.longitude],
      [e.latitude, e.longitude]
    );
    if (d <= STOP_RADIUS_M) {
      cluster.push(e);
    } else {
      flushCluster();
      cluster = [e];
    }
  }
  flushCluster();

  return {
    distanceM,
    durationMs,
    avgSpeedKmh,
    peakSpeedKmh,
    stops,
    gapCount,
    gapMs,
  };
}

/**
 * Direction chevrons placed along the path; count scales with total points (max ~12).
 * Any index in `breakBefore` represents a gap boundary; we skip the segment
 * ending at that index so we don't paint an arrow across an offline interval.
 */
export function computeArrowMarkers(
  path: [number, number][],
  breakBefore: ReadonlySet<number> = new Set()
): ArrowMarker[] {
  if (path.length < 2) return [];
  const step = Math.max(1, Math.floor(path.length / 12));
  const arrows: ArrowMarker[] = [];
  for (let i = step; i < path.length; i += step) {
    if (breakBefore.has(i)) continue;
    const a = path[i - 1];
    const b = path[i];
    if (haversineMeters(a, b) < 5) continue;
    arrows.push({ position: b, bearing: bearingDeg(a, b) });
  }
  return arrows;
}

/** Stable visitor hue from an id/string (0..360). */
export function visitorColor(id: string | undefined | null): string {
  const s = id ?? '';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 80% 45%)`;
}

/**
 * Chunked color gradient along an ordered path; used to draw a time-gradient polyline.
 * Returns contiguous sub-paths with a color; each sub-path overlaps the previous by 1 point
 * so the full line reads as a single continuous stroke.
 *
 * `breakBefore` — indices into `path` that start a new "run" (typically gap boundaries).
 * The gradient never spans a break; the dashed gap overlay (rendered separately) connects them.
 */
export function gradientChunks(
  path: [number, number][],
  chunkSize: number = 8,
  breakBefore: ReadonlySet<number> = new Set()
): { points: [number, number][]; color: string }[] {
  if (path.length < 2) return [];
  const chunks: { points: [number, number][]; color: string }[] = [];
  const step = Math.max(2, chunkSize);
  const total = Math.max(1, path.length - 1);

  const runs: { start: number; end: number }[] = [];
  let runStart = 0;
  for (let i = 1; i < path.length; i++) {
    if (breakBefore.has(i)) {
      if (i - runStart >= 2) runs.push({ start: runStart, end: i });
      runStart = i;
    }
  }
  if (path.length - runStart >= 2) runs.push({ start: runStart, end: path.length });

  for (const { start: runS, end: runE } of runs) {
    for (let start = runS; start < runE - 1; start += step - 1) {
      const end = Math.min(runE, start + step);
      const tMid = (start + (end - start) / 2) / total;
      const hue = 210 + tMid * (140 - 210);
      chunks.push({
        points: path.slice(start, end),
        color: `hsl(${hue.toFixed(1)} 85% 45%)`,
      });
      if (end === runE) break;
    }
  }
  return chunks;
}
