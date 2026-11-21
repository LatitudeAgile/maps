// Stats worked out from a GPX file (design D7). Plain code: no SDK or element imports. Values are
// in meters, seconds and ms since the epoch; format.ts turns them into text.
import type { GpxData, LinePoint } from "./gpx.ts";

/** Raise this when the calculations change: entries saved with an older version are recomputed. */
export const STATS_VERSION = 1;

export interface Stats {
  /** Length of the tracks, or of the routes when there are no tracks. */
  distance?: number;
  /** Elevation gain and loss, when at least two points have elevations. */
  gain?: number;
  loss?: number;
  /** When it was recorded (the first time), the total duration and the moving time. */
  start?: number;
  duration?: number;
  moving?: number;
  lines: number;
  waypoints: number;
}

/** A climb or descent counts once it passes this far from the last turning point, in meters. */
const HYSTERESIS_M = 3;
/** Slower than this, in m/s, counts as stopped. */
const MOVING_SPEED = 0.3;
/** A gap this long or longer between two points, in seconds, counts as stopped. */
const MAX_STEP_S = 5 * 60;
const EARTH_RADIUS_M = 6_371_008.8;

export function computeStats(data: GpxData): Stats {
  const stats: Stats = { lines: data.tracks.length + data.routes.length, waypoints: data.waypoints.length };
  // A planned route and its recording aren't counted together: tracks win.
  const paths = data.tracks.length ? data.tracks : data.routes;
  if (!paths.length) return stats;

  stats.distance = paths.reduce((sum, path) => sum + pathLength(path), 0);

  let gain = 0;
  let loss = 0;
  let elevations = 0;
  let first = Infinity;
  let last = -Infinity;
  let moving = 0;
  for (const path of paths) {
    let turn: number | undefined;
    for (const point of path) {
      if (point.ele !== undefined) {
        elevations++;
        if (turn === undefined) turn = point.ele;
        else if (point.ele - turn >= HYSTERESIS_M) {
          gain += point.ele - turn;
          turn = point.ele;
        } else if (turn - point.ele >= HYSTERESIS_M) {
          loss += turn - point.ele;
          turn = point.ele;
        }
      }
      if (point.time !== undefined) {
        first = Math.min(first, point.time);
        last = Math.max(last, point.time);
      }
    }
    // Steps between segments never count: each path is summed on its own.
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (a.time === undefined || b.time === undefined) continue;
      const seconds = (b.time - a.time) / 1000;
      if (seconds <= 0 || seconds >= MAX_STEP_S) continue;
      if (haversine(a, b) / seconds >= MOVING_SPEED) moving += seconds;
    }
  }
  if (elevations >= 2) {
    stats.gain = gain;
    stats.loss = loss;
  }
  if (Number.isFinite(first) && last > first) {
    stats.start = first;
    stats.duration = (last - first) / 1000;
    stats.moving = moving;
  }
  return stats;
}

function pathLength(path: LinePoint[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) length += haversine(path[i - 1], path[i]);
  return length;
}

/** Great-circle distance in meters. */
export function haversine(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
