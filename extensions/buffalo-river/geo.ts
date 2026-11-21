// Small geometry helpers on longitude and latitude, shared by the level model and trip planning.
// Ported from brokan.xyz/buffalo (mathStuff.ts).

const EARTH_RADIUS_METERS = 6371000;
export const METERS_PER_MILE = 1609.34;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance in meters between two points, by the haversine formula. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** `a` weighted by `weightA`, and `b` by the rest. */
export function weightedAverage(a: number, b: number, weightA: number): number {
  return a * weightA + b * (1 - weightA);
}
