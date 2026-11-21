// Trip planning along the river's path: snapping places to the path, ordering a trip downstream,
// its stretch of river, distance and time, and the points of interest along it. Ported from
// brokan.xyz/buffalo (tripHelper.ts).
import Polyline from "@arcgis/core/geometry/Polyline.js";
import {
  geodeticLengthExecute,
  geodeticLengthIsLoaded,
  geodeticLengthLoad,
} from "@arcgis/core/geometry/operators/geodeticLengthOperator.js";
import { accessPoints, type AccessPoint } from "./data/accessPoints.ts";
import { pointsOfInterest, type PointOfInterest } from "./data/pointsOfInterest.ts";
import { riverPath } from "./data/riverPath.ts";
import { distanceMeters, METERS_PER_MILE } from "./geo.ts";

/** Buffalo's assumed paddling speed. */
export const AVERAGE_PADDLING_SPEED_MPH = 2.5;
/** Paddling time assumed per day when a trip takes more than one. */
export const PADDLING_HOURS_PER_DAY = 8;

interface Coord {
  longitude: number;
  latitude: number;
}

/** The index of the path vertex nearest `coord`. */
function nearestPathIndex(coord: Coord): number {
  let closest = 0;
  let minDistance = Infinity;
  riverPath.forEach(([lon, lat], index) => {
    const distance = distanceMeters(coord.latitude, coord.longitude, lat, lon);
    if (distance < minDistance) {
      minDistance = distance;
      closest = index;
    }
  });
  return closest;
}

/** Miles along the path from its first vertex to each vertex, so a stretch is a subtraction. */
const cumulativeMiles: number[] = [0];
for (let i = 1; i < riverPath.length; i++) {
  const [prevLon, prevLat] = riverPath[i - 1];
  const [lon, lat] = riverPath[i];
  cumulativeMiles.push(cumulativeMiles[i - 1] + distanceMeters(prevLat, prevLon, lat, lon) / METERS_PER_MILE);
}

const accessPointsByName = new Map<string, AccessPoint>(accessPoints.map((ap) => [ap.name, ap]));
const accessPointPathIndices = new Map<string, number>(accessPoints.map((ap) => [ap.name, nearestPathIndex(ap.coord)]));

export function getAccessPoint(name: string): AccessPoint | undefined {
  return accessPointsByName.get(name);
}

export function isPrimitiveAccessPoint(name: string): boolean {
  return accessPointsByName.get(name)?.isPrimitive ?? false;
}

function accessPointPathIndex(name: string): number {
  return accessPointPathIndices.get(name) ?? 0;
}

/**
 * The pair as [put-in, take-out]. The path runs headwaters to mouth, so the lower path index is
 * upstream, whichever point was picked first.
 */
export function orderDownstream(name1: string, name2: string): [string, string] {
  return accessPointPathIndex(name2) < accessPointPathIndex(name1) ? [name2, name1] : [name1, name2];
}

/** The path indices of a trip's two ends, upstream first. */
export function tripPathIndices(name1: string, name2: string): [number, number] {
  const a = accessPointPathIndex(name1);
  const b = accessPointPathIndex(name2);
  return b < a ? [b, a] : [a, b];
}

/** The stretch of river between two access points, in WGS84. */
export function tripStretch(name1: string, name2: string): Polyline {
  const [start, end] = tripPathIndices(name1, name2);
  return new Polyline({ spatialReference: { wkid: 4326 }, paths: [riverPath.slice(start, end + 1)] });
}

/** The geodetic length in miles of the river between two access points. */
export async function tripDistanceMiles(name1: string, name2: string): Promise<number> {
  if (!geodeticLengthIsLoaded()) await geodeticLengthLoad();
  return geodeticLengthExecute(tripStretch(name1, name2), { unit: "meters" }) / METERS_PER_MILE;
}

/** The mean level score of the segments between two access points, or null when there are none. */
export function tripLevelScore(segmentScores: readonly number[], name1: string, name2: string): number | null {
  const [start, end] = tripPathIndices(name1, name2);
  const scores = segmentScores.slice(start, end);
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export const estimateTripMinutes = (miles: number): number => Math.round((miles / AVERAGE_PADDLING_SPEED_MPH) * 60);

/** "45 min", "3 hr" or "3 hr 12 min". */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/** Days needed at {@link PADDLING_HOURS_PER_DAY} hours of paddling a day, at least 1. */
export const estimateTripDays = (minutes: number): number => Math.max(1, Math.ceil(minutes / (PADDLING_HOURS_PER_DAY * 60)));

export interface RiverPointOfInterest extends PointOfInterest {
  /** The point's index in the source data, which identifies it: names repeat along the river. */
  index: number;
  pathIndex: number;
  riverMile: number;
}

export interface TripPointOfInterest extends RiverPointOfInterest {
  milesFromPutIn: number;
}

const pointsAlongRiver: RiverPointOfInterest[] = pointsOfInterest
  .map((poi, index) => {
    const pathIndex = nearestPathIndex(poi.coord);
    return { ...poi, index, pathIndex, riverMile: cumulativeMiles[pathIndex] };
  })
  .sort((a, b) => a.pathIndex - b.pathIndex);

/**
 * The points of interest between two access points in downstream order, including any right at
 * either end (Ponca Creek is at Ponca Bridge).
 */
export function tripPointsOfInterest(name1: string, name2: string): TripPointOfInterest[] {
  const [start, end] = tripPathIndices(name1, name2);
  const putInMile = cumulativeMiles[start];
  return pointsAlongRiver
    .filter((poi) => poi.pathIndex >= start && poi.pathIndex <= end)
    .map((poi) => ({ ...poi, milesFromPutIn: poi.riverMile - putInMile }));
}
