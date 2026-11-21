// Projects the river and a trip's stretch into SVG coordinates for the minimaps in Trip details.
// Longitude is scaled by the cosine of the latitude so the river keeps its real proportions.
// Ported from brokan.xyz/buffalo (riverPathProjection.ts).
import { getAccessPoint, tripPathIndices } from "./trip.ts";
import { riverPath } from "./data/riverPath.ts";

type SvgPoint = [number, number];

interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

function boundsOf(path: readonly [number, number][]): Bounds {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const [lon, lat] of path) {
    bounds.minLon = Math.min(bounds.minLon, lon);
    bounds.maxLon = Math.max(bounds.maxLon, lon);
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
  }
  return bounds;
}

const toPoints = (points: SvgPoint[]): string => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// The whole river.
const PADDING = 16;
const TARGET_WIDTH = 320;
const river = boundsOf(riverPath);
const lonScale = Math.cos((((river.minLat + river.maxLat) / 2) * Math.PI) / 180);
const pixelsPerDegree = TARGET_WIDTH / ((river.maxLon - river.minLon) * lonScale);

const projectWhole = (lon: number, lat: number): SvgPoint => [
  (lon - river.minLon) * lonScale * pixelsPerDegree + PADDING,
  (river.maxLat - lat) * pixelsPerDegree + PADDING,
];

/** The whole-river view: its size, the river as polyline points, and a trip's stretch and ends. */
export interface OverviewView {
  width: number;
  height: number;
  river: string;
  stretch: string;
  putIn: SvgPoint;
  takeOut: SvgPoint;
}

const wholeRiverPoints = toPoints(riverPath.map(([lon, lat]) => projectWhole(lon, lat)));

export function overviewView(putIn: string, takeOut: string): OverviewView {
  const [start, end] = tripPathIndices(putIn, takeOut);
  const at = (name: string): SvgPoint => {
    const coord = getAccessPoint(name)?.coord ?? { longitude: river.minLon, latitude: river.maxLat };
    return projectWhole(coord.longitude, coord.latitude);
  };
  return {
    width: TARGET_WIDTH + PADDING * 2,
    height: (river.maxLat - river.minLat) * pixelsPerDegree + PADDING * 2,
    river: wholeRiverPoints,
    stretch: toPoints(riverPath.slice(start, end + 1).map(([lon, lat]) => projectWhole(lon, lat))),
    putIn: at(putIn),
    takeOut: at(takeOut),
  };
}

// The zoomed stretch. Wider padding leaves room for the Put-in and Take-out labels beside each end.
const ZOOM_PADDING = 34;
const ZOOM_MAX_DIMENSION = 320;
/** Keeps a short or nearly straight stretch from collapsing to a sliver. */
const ZOOM_MIN_SPAN_DEGREES = 0.006;

/** A stretch fitted to the SVG: its size, the stretch as polyline points, and its two ends. */
export interface StretchView {
  width: number;
  height: number;
  stretch: string;
  putIn: SvgPoint;
  takeOut: SvgPoint;
}

export function stretchView(putIn: string, takeOut: string): StretchView {
  const [start, end] = tripPathIndices(putIn, takeOut);
  const path = riverPath.slice(start, end + 1);
  const b = boundsOf(path);
  if (b.maxLon - b.minLon < ZOOM_MIN_SPAN_DEGREES) {
    const center = (b.minLon + b.maxLon) / 2;
    b.minLon = center - ZOOM_MIN_SPAN_DEGREES / 2;
    b.maxLon = center + ZOOM_MIN_SPAN_DEGREES / 2;
  }
  if (b.maxLat - b.minLat < ZOOM_MIN_SPAN_DEGREES) {
    const center = (b.minLat + b.maxLat) / 2;
    b.minLat = center - ZOOM_MIN_SPAN_DEGREES / 2;
    b.maxLat = center + ZOOM_MIN_SPAN_DEGREES / 2;
  }
  const scaleLon = Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180);
  const lonSpan = (b.maxLon - b.minLon) * scaleLon;
  const latSpan = b.maxLat - b.minLat;
  // Fit the longer side, so a tall stretch and a wide one both come out a sensible size.
  const scale = ZOOM_MAX_DIMENSION / Math.max(lonSpan, latSpan);
  const project = (lon: number, lat: number): SvgPoint => [
    (lon - b.minLon) * scaleLon * scale + ZOOM_PADDING,
    (b.maxLat - lat) * scale + ZOOM_PADDING,
  ];
  const at = (name: string): SvgPoint => {
    const coord = getAccessPoint(name)?.coord;
    return coord ? project(coord.longitude, coord.latitude) : project(b.minLon, b.maxLat);
  };
  return {
    width: lonSpan * scale + ZOOM_PADDING * 2,
    height: latSpan * scale + ZOOM_PADDING * 2,
    stretch: toPoints(path.map(([lon, lat]) => project(lon, lat))),
    putIn: at(putIn),
    takeOut: at(takeOut),
  };
}
