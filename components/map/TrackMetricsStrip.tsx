'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { momentAgo } from '@/lib/momentAgo';
import { useRelativeTimeTick } from '@/lib/use-relative-time-tick';
import type { TrackStats } from '@/lib/track-map-path';
import type { Location } from '@/components/interfaces/location.interface';

interface TrackMetricsStripProps {
  stats: TrackStats;
  /** Total number of *denoised* points we plotted on the map. */
  pointsDrawn: number;
  /** Timestamp (ms) of the most recent ping. */
  lastPingTs: number | null;
  /** Full location row so we can detect paused/ended sessions. */
  location?: Pick<
    Location,
    'sessionState' | 'backgroundedAt' | 'foregroundedAt' | 'lastHeartbeatAt'
  > | null;
  compact?: boolean;
}

function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '0 m';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatSpeed(kmh: number | null): string {
  if (kmh == null || !Number.isFinite(kmh)) return '—';
  if (kmh < 1) return '< 1 km/h';
  return `${kmh.toFixed(1)} km/h`;
}

type StatusTone = 'live' | 'idle' | 'stale' | 'paused';

function statusOf(
  lastPingTs: number | null,
  loc?: TrackMetricsStripProps['location']
): {
  label: 'Live' | 'Idle' | 'Stale' | 'Unknown' | 'Paused' | 'Ended';
  tone: StatusTone;
} {
  if (loc) {
    if (loc.sessionState === 'ended') return { label: 'Ended', tone: 'paused' };
    if (loc.sessionState === 'hidden') return { label: 'Paused', tone: 'paused' };
    if (
      typeof loc.backgroundedAt === 'number' &&
      typeof loc.foregroundedAt === 'number' &&
      loc.backgroundedAt > loc.foregroundedAt
    ) {
      return { label: 'Paused', tone: 'paused' };
    }
  }
  if (lastPingTs == null) return { label: 'Unknown', tone: 'stale' };
  const age = Date.now() - lastPingTs;
  if (age < 30_000) return { label: 'Live', tone: 'live' };
  if (age < 5 * 60_000) return { label: 'Idle', tone: 'idle' };
  return { label: 'Stale', tone: 'stale' };
}

function formatGapDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export function TrackMetricsStrip({
  stats,
  pointsDrawn,
  lastPingTs,
  location,
  compact = false,
}: TrackMetricsStripProps) {
  useRelativeTimeTick(15_000);

  const status = useMemo(
    () => statusOf(lastPingTs, location),
    [lastPingTs, location]
  );

  const items: { label: string; value: string }[] = [
    { label: 'Distance', value: formatDistance(stats.distanceM) },
    { label: 'Duration', value: formatDuration(stats.durationMs) },
    { label: 'Avg speed', value: formatSpeed(stats.avgSpeedKmh) },
    { label: 'Peak speed', value: formatSpeed(stats.peakSpeedKmh) },
    { label: 'Stops', value: String(stats.stops) },
    { label: 'Points', value: String(pointsDrawn) },
  ];
  if (stats.gapCount > 0) {
    items.push({
      label: 'Offline gaps',
      value: `${stats.gapCount} · ${formatGapDuration(stats.gapMs)}`,
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 ${
        compact ? 'px-2 py-1.5' : 'px-3 py-2'
      }`}
    >
      <Badge
        variant="outline"
        className={`track-status-badge track-status-badge--${status.tone}`}
      >
        <span className="track-status-dot" aria-hidden />
        {status.label}
      </Badge>
      {lastPingTs != null && (
        <span className="text-xs text-muted-foreground">
          Last ping {momentAgo(lastPingTs)}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-baseline gap-1.5 text-xs"
          >
            <span className="text-muted-foreground">{it.label}:</span>
            <span className="font-semibold tabular-nums">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrackMetricsStrip;
