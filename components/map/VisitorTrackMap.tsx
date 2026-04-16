'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatLocalDateTime, momentAgo } from '@/lib/momentAgo';
import {
  buildVisitorTrack,
  computeArrowMarkers,
  computeTrackStats,
  gradientChunks,
  type ArrowMarker,
  type TrackEntry,
  type VisitorTrack,
} from '@/lib/track-map-path';
import type { Location } from '@/components/interfaces/location.interface';

import TrackControls, { type SourceFilter } from './TrackControls';
import TrackMetricsStrip from './TrackMetricsStrip';
import LiveMarker from './LiveMarker';

interface VisitorTrackMapProps {
  location: Location;
  height?: number;
  showMetrics?: boolean;
  showControls?: boolean;
  initialFollow?: boolean;
}

const startIcon = L.divIcon({
  className: 'track-marker-start',
  html: `<div style="width:32px;height:32px;border-radius:9999px;background:#15803d;color:#fff;font:700 11px/32px system-ui,sans-serif;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);text-align:center;">S</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const scrubIcon = L.divIcon({
  className: 'track-marker-scrub',
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:#f59e0b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function chevronIcon(bearing: number): L.DivIcon {
  return L.divIcon({
    className: 'track-chevron',
    html: `<div class="track-chevron__inner" style="transform: rotate(${bearing}deg);">▲</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FitBoundsOnCommand({
  path,
  triggerId,
}: {
  path: [number, number][];
  triggerId: number;
}) {
  const map = useMap();
  const lastTriggerRef = useRef<number>(-1);

  useEffect(() => {
    if (triggerId === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerId;
    if (path.length === 0) return;
    try {
      if (path.length === 1) {
        map.setView(path[0], Math.max(map.getZoom(), 14));
        return;
      }
      const bounds = L.latLngBounds(path);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true });
      }
    } catch {
      /* ignore */
    }
  }, [map, path, triggerId]);

  return null;
}

/** Turn off follow as soon as the user drags; report via callback. */
function FollowDragBreaker({ onUserDrag }: { onUserDrag: () => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onUserDrag();
    map.on('dragstart', handler);
    return () => {
      map.off('dragstart', handler);
    };
  }, [map, onUserDrag]);
  return null;
}

type LiveStatus = 'live' | 'idle' | 'stale' | 'paused';

function liveStatusFor(loc: Location, ageMs: number | null): LiveStatus {
  const backgrounded =
    loc.sessionState === 'hidden' ||
    loc.sessionState === 'ended' ||
    (typeof loc.backgroundedAt === 'number' &&
      typeof loc.foregroundedAt === 'number' &&
      loc.backgroundedAt > loc.foregroundedAt);
  if (backgrounded) return 'paused';
  if (ageMs == null) return 'stale';
  if (ageMs < 30_000) return 'live';
  if (ageMs < 5 * 60_000) return 'idle';
  return 'stale';
}

const GAP_BREAK_MS_UI = 30_000;

function filteredEntries(entries: TrackEntry[], filter: SourceFilter): TrackEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((e) =>
    filter === 'gps' ? e.locationSource !== 'ip' : e.locationSource === 'ip'
  );
}

function mapEntriesToPath(entries: TrackEntry[]): [number, number][] {
  return entries.map((e) => [e.latitude, e.longitude]);
}

function MapBody({
  track,
  filteredTrack,
  scrubIndex,
  showArrows,
  showAccuracy,
  follow,
  fitBoundsTrigger,
  onUserDrag,
  loc,
  now,
}: {
  track: VisitorTrack;
  filteredTrack: { entries: TrackEntry[]; path: [number, number][] };
  scrubIndex: number;
  showArrows: boolean;
  showAccuracy: boolean;
  follow: boolean;
  fitBoundsTrigger: number;
  onUserDrag: () => void;
  loc: Location;
  now: number;
}) {
  const { path: fullPath } = filteredTrack;
  const visibleEntries = filteredTrack.entries.slice(0, Math.max(1, scrubIndex + 1));
  const visiblePath = fullPath.slice(0, Math.max(1, scrubIndex + 1));
  const start = fullPath[0];
  const scrubPoint = visiblePath[visiblePath.length - 1];
  const liveEntry = filteredTrack.entries[filteredTrack.entries.length - 1];
  const liveAt: [number, number] | null = liveEntry
    ? [liveEntry.latitude, liveEntry.longitude]
    : null;

  const breakBefore = useMemo<Set<number>>(() => {
    const s = new Set<number>();
    for (let i = 1; i < visibleEntries.length; i++) {
      const g = visibleEntries[i].gapBeforeMs;
      if (typeof g === 'number' && g >= GAP_BREAK_MS_UI) s.add(i);
    }
    return s;
  }, [visibleEntries]);

  const gapOverlays = useMemo(() => {
    const spans: {
      from: [number, number];
      to: [number, number];
      durationMs: number;
    }[] = [];
    breakBefore.forEach((i) => {
      const prev = visibleEntries[i - 1];
      const cur = visibleEntries[i];
      if (!prev || !cur) return;
      spans.push({
        from: [prev.latitude, prev.longitude],
        to: [cur.latitude, cur.longitude],
        durationMs: cur.gapBeforeMs ?? 0,
      });
    });
    return spans;
  }, [breakBefore, visibleEntries]);

  const chunks = useMemo(
    () => gradientChunks(visiblePath, 8, breakBefore),
    [visiblePath, breakBefore]
  );
  const arrows: ArrowMarker[] = useMemo(
    () => (showArrows ? computeArrowMarkers(visiblePath, breakBefore) : []),
    [showArrows, visiblePath, breakBefore]
  );

  const tailIpSegments = useMemo(() => {
    const segs: { points: [number, number][] }[] = [];
    let cur: [number, number][] = [];
    for (let i = 0; i < visibleEntries.length; i++) {
      const e = visibleEntries[i];
      // Gap breaks the IP-only overlay too, otherwise it would connect across a blind interval.
      if (breakBefore.has(i) && cur.length > 0) {
        if (cur.length > 1) segs.push({ points: [...cur] });
        cur = [];
      }
      if (e.locationSource === 'ip') {
        cur.push([e.latitude, e.longitude]);
      } else if (cur.length > 0) {
        if (cur.length > 1) segs.push({ points: [...cur] });
        cur = [];
      }
    }
    if (cur.length > 1) segs.push({ points: cur });
    return segs;
  }, [visibleEntries, breakBefore]);

  const lastPingTs = track.lastPingTs;
  const ageMs = lastPingTs != null ? now - lastPingTs : null;
  const status = liveStatusFor(loc, ageMs);

  const scrubEntry = visibleEntries[visibleEntries.length - 1];
  const scrubbedAway = scrubEntry && liveEntry && scrubEntry !== liveEntry;

  const livePopup = `
    <div style="min-width:180px">
      <div style="font-weight:600;font-size:13px;margin:0">${
        track.hasLivePosition ? 'Current position' : 'Latest ping'
      }</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">Route: ${fullPath.length} point${
        fullPath.length === 1 ? '' : 's'
      }</div>
      ${
        liveAt
          ? `<div style="font-family:ui-monospace,monospace;font-size:12px;margin-top:4px">${liveAt[0].toFixed(
              5
            )}, ${liveAt[1].toFixed(5)}</div>`
          : ''
      }
      ${
        loc.createdAt != null
          ? `<div style="font-size:12px;margin-top:4px">Session since ${momentAgo(
              loc.createdAt
            )}</div>
      <div style="font-size:11px;color:#64748b">${formatLocalDateTime(loc.createdAt)}</div>`
          : ''
      }
      ${loc.userId ? `<div style="font-size:11px;margin-top:4px">User: ${loc.userId}</div>` : ''}
    </div>
  `.trim();

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBoundsOnCommand path={fullPath} triggerId={fitBoundsTrigger} />
      <FollowDragBreaker onUserDrag={onUserDrag} />

      {chunks.map((c, i) => (
        <Polyline
          key={`grad-${i}`}
          positions={c.points}
          pathOptions={{
            color: c.color,
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
      {tailIpSegments.map((seg, i) => (
        <Polyline
          key={`ip-${i}`}
          positions={seg.points}
          pathOptions={{
            color: '#94a3b8',
            weight: 3,
            opacity: 0.8,
            dashArray: '4 6',
          }}
        />
      ))}

      {gapOverlays.map((g, i) => (
        <Polyline
          key={`gap-${i}`}
          positions={[g.from, g.to]}
          pathOptions={{
            color: '#cbd5e1',
            weight: 2,
            opacity: 0.9,
            dashArray: '2 8',
            lineCap: 'round',
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>Offline gap</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                The tracker page was backgrounded for roughly{' '}
                {Math.round(g.durationMs / 1000)}s. The straight dashed line only
                connects the last-known point to the first ping after resume —
                the actual path is unknown.
              </p>
            </div>
          </Popup>
        </Polyline>
      ))}

      {arrows.map((a, i) => (
        <Marker
          key={`arr-${i}`}
          position={a.position}
          icon={chevronIcon(a.bearing)}
          interactive={false}
          keyboard={false}
        />
      ))}

      {showAccuracy && track.lastAccuracyM != null && liveAt && (
        <Circle
          center={liveAt}
          radius={track.lastAccuracyM}
          pathOptions={{
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.09,
            weight: 1,
            opacity: 0.45,
          }}
        />
      )}

      {start && (
        <Marker position={start} icon={startIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>Start</p>
              <p
                style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}
              >
                First recorded position when tracking began.
              </p>
              {track.firstPingTs != null && (
                <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                  First seen {momentAgo(track.firstPingTs)}
                </p>
              )}
              {track.firstPingTs != null && (
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                  {formatLocalDateTime(track.firstPingTs)}
                </p>
              )}
              <p
                style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, margin: '4px 0 0' }}
              >
                {start[0].toFixed(5)}, {start[1].toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {scrubbedAway && scrubPoint && (
        <Marker position={scrubPoint} icon={scrubIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>Scrubbed point</p>
              {scrubEntry?.ts != null && (
                <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                  {formatLocalDateTime(scrubEntry.ts)}
                </p>
              )}
              <p
                style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, margin: '4px 0 0' }}
              >
                {scrubPoint[0].toFixed(5)}, {scrubPoint[1].toFixed(5)}
              </p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                Source: {scrubEntry?.locationSource === 'ip' ? 'IP' : 'GPS'}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {liveAt && (
        <LiveMarker
          position={liveAt}
          status={status}
          popupHtml={livePopup}
          follow={follow}
        />
      )}
    </>
  );
}

export function VisitorTrackMap({
  location,
  height = 420,
  showMetrics = true,
  showControls = true,
  initialFollow = false,
}: VisitorTrackMapProps) {
  const track = useMemo(() => buildVisitorTrack(location), [location]);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [showAccuracy, setShowAccuracy] = useState<boolean>(true);
  const [follow, setFollow] = useState<boolean>(initialFollow);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [scrubIndex, setScrubIndex] = useState<number>(
    Math.max(0, track.entries.length - 1)
  );
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const filteredTrack = useMemo(() => {
    const entries = filteredEntries(track.entries, sourceFilter);
    return { entries, path: mapEntriesToPath(entries) };
  }, [track.entries, sourceFilter]);

  const filteredStats = useMemo(
    () => (sourceFilter === 'all' ? track.stats : computeTrackStats(filteredTrack.entries)),
    [sourceFilter, track.stats, filteredTrack.entries]
  );

  const totalFiltered = filteredTrack.entries.length;
  const effectiveScrub = Math.min(scrubIndex, Math.max(0, totalFiltered - 1));

  useEffect(() => {
    setScrubIndex(Math.max(0, totalFiltered - 1));
  }, [totalFiltered]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const handleUserDrag = useCallback(() => {
    setFollow((f) => (f ? false : f));
  }, []);

  const handlePlayToggle = useCallback(
    (next: boolean) => {
      if (next) {
        setFollow(false);
      }
      setPlaying(next);
    },
    []
  );

  const scrubbedEntry = filteredTrack.entries[effectiveScrub];
  const timeLabel = scrubbedEntry?.ts
    ? formatLocalDateTime(scrubbedEntry.ts)
    : undefined;

  const mapEl = (expandedMode: boolean) => {
    const centerFallback: [number, number] =
      filteredTrack.path[filteredTrack.path.length - 1] ?? [25.276987, 55.296249];
    const zoom = filteredTrack.path.length > 0 ? 14 : 5;

    return (
      <div
        className="relative w-full overflow-hidden rounded-md border bg-background"
        style={{ height: expandedMode ? '72vh' : height }}
      >
        {filteredTrack.path.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No points match the current filter.
          </div>
        ) : (
          <MapContainer
            center={centerFallback}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            preferCanvas
            key={`${location.id ?? 'solo'}-${sourceFilter}-${
              expandedMode ? 'xl' : 'sm'
            }`}
          >
            <MapBody
              track={track}
              filteredTrack={filteredTrack}
              scrubIndex={effectiveScrub}
              showArrows={showArrows}
              showAccuracy={showAccuracy}
              follow={follow}
              fitBoundsTrigger={fitTrigger}
              onUserDrag={handleUserDrag}
              loc={location}
              now={now}
            />
          </MapContainer>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {showMetrics && (
        <TrackMetricsStrip
          stats={filteredStats}
          pointsDrawn={filteredTrack.path.length}
          lastPingTs={track.lastPingTs}
          location={location}
        />
      )}
      {mapEl(false)}
      {showControls && (
        <TrackControls
          totalPoints={totalFiltered}
          scrubIndex={effectiveScrub}
          onScrubChange={(i) => {
            setScrubIndex(i);
            if (playing) setPlaying(false);
          }}
          playing={playing}
          onPlayToggle={handlePlayToggle}
          speed={speed}
          onSpeedChange={setSpeed}
          sourceFilter={sourceFilter}
          onSourceChange={(s) => {
            setSourceFilter(s);
            setPlaying(false);
          }}
          showArrows={showArrows}
          onToggleArrows={setShowArrows}
          showAccuracy={showAccuracy}
          onToggleAccuracy={setShowAccuracy}
          follow={follow}
          onToggleFollow={setFollow}
          onFitBounds={() => setFitTrigger((n) => n + 1)}
          onExpand={() => setExpanded(true)}
          timeLabel={timeLabel}
        />
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[min(1200px,95vw)]">
          <DialogHeader>
            <DialogTitle>Movement map</DialogTitle>
          </DialogHeader>
          {expanded && mapEl(true)}
          {expanded && showControls && (
            <TrackControls
              totalPoints={totalFiltered}
              scrubIndex={effectiveScrub}
              onScrubChange={(i) => {
                setScrubIndex(i);
                if (playing) setPlaying(false);
              }}
              playing={playing}
              onPlayToggle={handlePlayToggle}
              speed={speed}
              onSpeedChange={setSpeed}
              sourceFilter={sourceFilter}
              onSourceChange={(s) => {
                setSourceFilter(s);
                setPlaying(false);
              }}
              showArrows={showArrows}
              onToggleArrows={setShowArrows}
              showAccuracy={showAccuracy}
              onToggleAccuracy={setShowAccuracy}
              follow={follow}
              onToggleFollow={setFollow}
              onFitBounds={() => setFitTrigger((n) => n + 1)}
              onExpand={() => setExpanded(false)}
              expanded
              timeLabel={timeLabel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VisitorTrackMap;
