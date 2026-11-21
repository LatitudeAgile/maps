// Reads GPX 1.0 and 1.1 text into lines and waypoints (design D2). Plain code: no SDK or element
// imports, so other formats and features can reuse what it returns.

/** A point on a track or route. `time` is in ms since the epoch. */
export interface LinePoint {
  lon: number;
  lat: number;
  ele?: number;
  time?: number;
}

export interface Waypoint {
  lon: number;
  lat: number;
  ele?: number;
  name?: string;
  description?: string;
}

export interface GpxData {
  /** The file's own name for its contents: `metadata/name` (1.1) or `name` under `gpx` (1.0). */
  name?: string;
  /** The first track's or route's name. */
  firstLineName?: string;
  /** One path per track segment, each with at least two points. */
  tracks: LinePoint[][];
  /** One path per route, each with at least two points. */
  routes: LinePoint[][];
  waypoints: Waypoint[];
}

export type GpxErrorReason = "not-gpx" | "empty";

/** Why a file can't be shown: it isn't GPX, or it has no tracks, routes or waypoints. */
export class GpxError extends Error {
  readonly reason: GpxErrorReason;
  constructor(reason: GpxErrorReason) {
    super(reason === "not-gpx" ? "The file isn't a GPX file." : "The file has no tracks, routes or waypoints.");
    this.reason = reason;
  }
}

/** Parses GPX text. Throws a GpxError when it isn't GPX or has nothing to show. */
export function parseGpx(text: string): GpxData {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, "application/xml");
  } catch {
    throw new GpxError("not-gpx");
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "gpx" || doc.getElementsByTagName("parsererror").length > 0) throw new GpxError("not-gpx");

  const data: GpxData = {
    name: textOf(child(child(root, "metadata"), "name")) ?? textOf(child(root, "name")),
    tracks: [],
    routes: [],
    waypoints: [],
  };

  for (const track of children(root, "trk")) {
    data.firstLineName ??= textOf(child(track, "name"));
    for (const segment of children(track, "trkseg")) {
      const path = linePoints(children(segment, "trkpt"));
      if (path.length >= 2) data.tracks.push(path);
    }
  }
  for (const route of children(root, "rte")) {
    data.firstLineName ??= textOf(child(route, "name"));
    const path = linePoints(children(route, "rtept"));
    if (path.length >= 2) data.routes.push(path);
  }
  for (const element of children(root, "wpt")) {
    const point = position(element);
    if (!point) continue;
    data.waypoints.push({
      ...point,
      name: textOf(child(element, "name")),
      description: textOf(child(element, "desc")) ?? textOf(child(element, "cmt")),
    });
  }

  if (!data.tracks.length && !data.routes.length && !data.waypoints.length) throw new GpxError("empty");
  return data;
}

/** The bounds of everything in the file, as [xmin, ymin, xmax, ymax] in degrees. */
export function bounds(data: GpxData): [number, number, number, number] {
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;
  const add = ({ lon, lat }: { lon: number; lat: number }) => {
    xmin = Math.min(xmin, lon);
    ymin = Math.min(ymin, lat);
    xmax = Math.max(xmax, lon);
    ymax = Math.max(ymax, lat);
  };
  for (const path of [...data.tracks, ...data.routes]) path.forEach(add);
  data.waypoints.forEach(add);
  return [xmin, ymin, xmax, ymax];
}

function linePoints(elements: Element[]): LinePoint[] {
  const points: LinePoint[] = [];
  for (const element of elements) {
    const point = position(element);
    if (!point) continue;
    const time = Date.parse(textOf(child(element, "time")) ?? "");
    points.push(Number.isFinite(time) ? { ...point, time } : point);
  }
  return points;
}

/** A point's position and elevation, or undefined when its lat or lon is missing or out of range. */
function position(element: Element): { lon: number; lat: number; ele?: number } | undefined {
  const lat = Number.parseFloat(element.getAttribute("lat") ?? "");
  const lon = Number.parseFloat(element.getAttribute("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  const ele = Number.parseFloat(textOf(child(element, "ele")) ?? "");
  return Number.isFinite(ele) ? { lon, lat, ele } : { lon, lat };
}

/** Direct children with this local name, in any namespace. */
function children(parent: Element | undefined, localName: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((element) => element.localName === localName);
}

function child(parent: Element | undefined, localName: string): Element | undefined {
  if (!parent) return undefined;
  for (const element of Array.from(parent.children)) if (element.localName === localName) return element;
  return undefined;
}

/** An element's trimmed text, or undefined when it's missing or blank. */
function textOf(element: Element | undefined): string | undefined {
  const text = element?.textContent?.trim();
  return text ? text : undefined;
}
