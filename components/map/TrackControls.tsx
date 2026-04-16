'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type SourceFilter = 'all' | 'gps' | 'ip';

interface TrackControlsProps {
  totalPoints: number;
  scrubIndex: number;
  onScrubChange: (idx: number) => void;

  playing: boolean;
  onPlayToggle: (next: boolean) => void;

  speed: 1 | 2 | 4;
  onSpeedChange: (next: 1 | 2 | 4) => void;

  sourceFilter: SourceFilter;
  onSourceChange: (next: SourceFilter) => void;

  showArrows: boolean;
  onToggleArrows: (next: boolean) => void;

  showAccuracy: boolean;
  onToggleAccuracy: (next: boolean) => void;

  follow: boolean;
  onToggleFollow: (next: boolean) => void;

  onFitBounds: () => void;
  onExpand?: () => void;
  expanded?: boolean;

  /** Optional label shown near the scrubber; eg "12 / 30". */
  indexLabel?: string;
  /** Optional timestamp label for the scrubbed point. */
  timeLabel?: string;
}

export function TrackControls({
  totalPoints,
  scrubIndex,
  onScrubChange,
  playing,
  onPlayToggle,
  speed,
  onSpeedChange,
  sourceFilter,
  onSourceChange,
  showArrows,
  onToggleArrows,
  showAccuracy,
  onToggleAccuracy,
  follow,
  onToggleFollow,
  onFitBounds,
  onExpand,
  expanded = false,
  indexLabel,
  timeLabel,
}: TrackControlsProps) {
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const scrubIndexRef = useRef<number>(scrubIndex);
  scrubIndexRef.current = scrubIndex;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    if (totalPoints < 2) return;

    const perStepMs = 400 / speed;
    lastTickRef.current = performance.now();

    const loop = (now: number) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= perStepMs) {
        lastTickRef.current = now;
        const next = scrubIndexRef.current + 1;
        if (next >= totalPoints) {
          onPlayToggle(false);
          onScrubChange(totalPoints - 1);
          return;
        }
        onScrubChange(next);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, totalPoints, onPlayToggle, onScrubChange]);

  const sources: { id: SourceFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'gps', label: 'GPS' },
    { id: 'ip', label: 'IP' },
  ];

  const atEnd = scrubIndex >= Math.max(0, totalPoints - 1);
  const disabledScrub = totalPoints < 2;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={playing ? 'default' : 'outline'}
          onClick={() => {
            if (atEnd && !playing) onScrubChange(0);
            onPlayToggle(!playing);
          }}
          disabled={disabledScrub}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
        >
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </Button>
        <div className="flex items-center gap-1" role="group" aria-label="Speed">
          {([1, 2, 4] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? 'default' : 'outline'}
              onClick={() => onSpeedChange(s)}
              className="px-2"
              aria-pressed={speed === s}
              disabled={disabledScrub}
            >
              {s}x
            </Button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalPoints - 1)}
          step={1}
          value={scrubIndex}
          onChange={(e) => onScrubChange(Number(e.target.value))}
          className="flex-1 min-w-[160px] accent-primary disabled:opacity-50"
          disabled={disabledScrub}
          aria-label="Timeline position"
        />
        <Badge variant="outline" className="font-mono">
          {indexLabel ?? `${scrubIndex + 1} / ${totalPoints}`}
        </Badge>
        {timeLabel && (
          <span className="text-xs text-muted-foreground">{timeLabel}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Source filter">
          {sources.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={sourceFilter === s.id ? 'default' : 'outline'}
              onClick={() => onSourceChange(s.id)}
              aria-pressed={sourceFilter === s.id}
              className="px-2"
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant={showArrows ? 'default' : 'outline'}
          onClick={() => onToggleArrows(!showArrows)}
          aria-pressed={showArrows}
        >
          Arrows
        </Button>
        <Button
          size="sm"
          variant={showAccuracy ? 'default' : 'outline'}
          onClick={() => onToggleAccuracy(!showAccuracy)}
          aria-pressed={showAccuracy}
        >
          Accuracy
        </Button>
        <Button
          size="sm"
          variant={follow ? 'default' : 'outline'}
          onClick={() => onToggleFollow(!follow)}
          aria-pressed={follow}
          className={follow ? 'track-follow-active' : ''}
        >
          Follow
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onFitBounds}>
            Fit bounds
          </Button>
          {onExpand && (
            <Button size="sm" variant="outline" onClick={onExpand}>
              {expanded ? 'Close' : 'Expand'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrackControls;
