// The map picture and where it is on the ground (3d-print D5, D7): the print area captured with
// takeScreenshot at 300 DPI, its four corners through toMap, and the scale across its middle.
import type Point from "@arcgis/core/geometry/Point.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import * as projectOperator from "@arcgis/core/geometry/operators/projectOperator.js";
import type { PrintArea, PrintView } from "./frame.ts";
import { distanceMeters, MAP_DPI, type MapPage } from "./page.ts";

/** A 3D view tilted more than this from straight down prints without a scale. */
export const MAX_TILT = 2;

export interface LonLat {
  longitude: number;
  latitude: number;
}

export interface GeoCorners {
  topLeft: LonLat;
  topRight: LonLat;
  bottomRight: LonLat;
  bottomLeft: LonLat;
}

/** Where a to-scale print is on the ground. */
export interface Placement {
  corners: GeoCorners;
  /** Ground meters per inch of the printed map, across its middle. */
  metersPerInch: number;
  /** The view's spatial reference, for the GeoPDF's projection. */
  spatialReference: { wkid: number | null; wkt: string | null; isWebMercator: boolean; isWGS84: boolean };
}

export interface MapPicture {
  /** A JPEG data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

/** The pixel size of the printed map at 300 DPI. */
export function pictureSize(page: MapPage): { width: number; height: number } {
  return { width: Math.round(page.mapWidth * MAP_DPI), height: Math.round(page.mapHeight * MAP_DPI) };
}

/** The print area at print resolution, as a JPEG. The SDK renders at that size, in 2D and 3D. */
export async function takePicture(view: PrintView, area: PrintArea, page: MapPage): Promise<MapPicture> {
  const size = pictureSize(page);
  // The area is in view pixels with the padding included, so the padding isn't applied again.
  const shot = await view.takeScreenshot({ area, ...size, format: "jpg", quality: 92, ignorePadding: true });
  return { dataUrl: shot.dataUrl, ...size };
}

/** True for a 3D view tilted more than MAX_TILT degrees: it has no single scale. */
export function isTilted(view: PrintView): boolean {
  return view.type === "3d" && view.camera.tilt > MAX_TILT;
}

/** A point as longitude and latitude, projecting it when the view isn't Web Mercator or WGS84. */
async function lonLat(point: Point): Promise<LonLat | null> {
  const sr = point.spatialReference;
  if (sr.isWGS84) return { longitude: point.x, latitude: point.y };
  if (sr.isWebMercator) return { longitude: point.longitude!, latitude: point.latitude! };
  if (!projectOperator.isLoaded()) await projectOperator.load();
  const projected = projectOperator.execute(point, SpatialReference.WGS84) as Point | null | undefined;
  return projected ? { longitude: projected.x, latitude: projected.y } : null;
}

/**
 * Where the print area is on the ground, or null when the print isn't to scale: a tilted 3D
 * view, or one where a corner of the frame misses the ground. A 2D view always is, rotated or
 * not, since the corners carry the rotation.
 */
export async function placeOnGround(view: PrintView, area: PrintArea, page: MapPage): Promise<Placement | null> {
  if (isTilted(view)) return null;
  const at = async (x: number, y: number) => {
    const point = (view.toMap as (p: { x: number; y: number }) => Point | null | undefined)({ x, y });
    return point ? lonLat(point) : null;
  };
  const { x, y, width, height } = area;
  const middle = y + height / 2;
  const [topLeft, topRight, bottomRight, bottomLeft, west, east] = await Promise.all([
    at(x, y),
    at(x + width, y),
    at(x + width, y + height),
    at(x, y + height),
    at(x, middle),
    at(x + width, middle),
  ]);
  if (!topLeft || !topRight || !bottomRight || !bottomLeft || !west || !east) return null;
  const sr = view.spatialReference;
  return {
    corners: { topLeft, topRight, bottomRight, bottomLeft },
    metersPerInch: distanceMeters(west, east) / page.mapWidth,
    spatialReference: { wkid: sr.wkid ?? null, wkt: sr.wkt ?? null, isWebMercator: sr.isWebMercator, isWGS84: sr.isWGS84 },
  };
}
