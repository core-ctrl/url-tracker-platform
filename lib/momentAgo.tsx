import moment from 'moment';
import { normalizeEventMs } from './timestamp-ms';

export { normalizeEventMs, eventTimeMsForSort } from './timestamp-ms';

/** Relative time from viewer's clock; updates when parent re-renders (use useRelativeTimeTick). */
export function momentAgo(timestamp: number | null | undefined): string {
  const ms = normalizeEventMs(timestamp ?? 0);
  if (ms == null) return '—';
  return moment(ms).fromNow();
}

export function formatLocalDateTime(timestamp: number | null | undefined): string {
  const ms = normalizeEventMs(timestamp ?? 0);
  if (ms == null) return '—';
  return moment(ms).format('MMMM Do YYYY, h:mm:ss a');
}
