const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Great-circle distance in meters. */
export function haversineMeters(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (0..360 deg) from `a` to `b`. */
export function bearingDeg(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/** m/s between two timestamped points; returns null if dt is invalid. */
export function segmentSpeedMS(
  a: readonly [number, number],
  b: readonly [number, number],
  tsA: number,
  tsB: number
): number | null {
  const dt = (tsB - tsA) / 1000;
  if (!Number.isFinite(dt) || dt <= 0) return null;
  return haversineMeters(a, b) / dt;
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}
