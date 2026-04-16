/** Earliest plausible event time (2000-01-01 UTC, ms). */
const MIN_EVENT_MS = 946684800000;
/** Upper bound to reject corrupted / future junk (~ year 2100). */
const MAX_EVENT_MS = 4102444800000;

/**
 * Normalize stored event timestamps to UTC milliseconds.
 * - Rejects null / zero / invalid.
 * - Treats values &lt; 1e11 as Unix **seconds** (legacy or mistaken writes).
 */
export function normalizeEventMs(ts: number | null | undefined): number | null {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return null;
  let ms = ts;
  if (ts < 1e11) ms = ts * 1000;
  if (ms < MIN_EVENT_MS || ms > MAX_EVENT_MS) return null;
  return ms;
}

/** For sorting / "last activity": invalid timestamps sort as 0. */
export function eventTimeMsForSort(ts: number | null | undefined): number {
  return normalizeEventMs(ts) ?? 0;
}
