'use client';

import { useEffect, useState } from 'react';

const DEFAULT_MS = 30_000;

/**
 * Bumps state on an interval so `moment().fromNow()` (and similar) recompute while the page is open.
 */
export function useRelativeTimeTick(intervalMs: number = DEFAULT_MS): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}
