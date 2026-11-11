import { LEGACY_BASEMAP_IDS, isBasemapStyleId } from "../map/basemapIds.ts";
import { PORTAL_ITEM_ID } from "./layers.ts";
import {
  DEFAULTS,
  GROUND_SETTINGS,
  MAP_VIEWS,
  type ConfigProblem,
  type GroundSetting,
  type MapViewKind,
  type ViewerConfig,
} from "./types.ts";

type Obj = Record<string, unknown>;
type MapConfig = ViewerConfig["map"];

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const UNLESS_ITEM = "Required unless map.item is set.";

export interface MapValidation {
  /** The validated section; undefined when it has errors. */
  map: MapConfig | undefined;
  /**
   * The view, when the config alone decides it: `"2d"` or `"3d"` without an item, undefined
   * with one (add-web-maps-and-scenes D8). Layer and component validation use it.
   */
  view: MapViewKind | undefined;
}

/**
 * Validate the `map` section (viewer-config, web-maps, map-scenes). Without `map.item`, the
 * basemap, center, and zoom or scale are required; with it, each is optional and overrides the
 * item. `ground`, `tilt` and `heading` need a 3D scene, or an item that may turn out to be one.
 */
export function validateMap(raw: unknown, errors: ConfigProblem[], warnings: ConfigProblem[]): MapValidation {
  if (raw === undefined) {
    errors.push({ path: "map", message: "Required. Expected an object with item, or with basemap, center, and zoom or scale." });
    return { map: undefined, view: undefined };
  }
  if (!isObject(raw)) {
    errors.push({ path: "map", message: "Expected an object." });
    return { map: undefined, view: undefined };
  }
  const before = errors.length;

  // item (web-maps)
  let item: { id: string } | undefined;
  if (raw.item !== undefined) {
    if (!isObject(raw.item)) {
      errors.push({ path: "map.item", message: 'Expected an object, such as { "id": "<32-character portal item ID>" }.' });
    } else if (typeof raw.item.id === "string" && PORTAL_ITEM_ID.test(raw.item.id)) {
      item = { id: raw.item.id };
    } else {
      errors.push({ path: "map.item.id", message: "Expected a 32-character portal item ID." });
    }
  }
  const hasItem = raw.item !== undefined;

  // view (map-scenes): the item's type decides when there is one.
  let view: MapViewKind | undefined = hasItem ? undefined : DEFAULTS.map.view;
  if (raw.view !== undefined) {
    if (hasItem) {
      errors.push({
        path: "map.view",
        message: "The view comes from the item's type (a web map opens in 2D, a web scene in 3D), so it can't be set with map.item.",
      });
    } else if ((MAP_VIEWS as readonly unknown[]).includes(raw.view)) {
      view = raw.view as MapViewKind;
    } else {
      errors.push({ path: "map.view", message: 'Expected "2d" or "3d".' });
    }
  }

  // basemap
  let basemap: string | undefined;
  if (raw.basemap === undefined && !hasItem) {
    errors.push({ path: "map.basemap", message: `${UNLESS_ITEM} Expected a basemap ID, such as "arcgis/streets" or "osm".` });
  } else if (raw.basemap !== undefined) {
    if (isNonEmptyString(raw.basemap)) {
      basemap = raw.basemap.trim();
      const modern = LEGACY_BASEMAP_IDS[basemap];
      if (modern) {
        warnings.push({ path: "map.basemap", message: `"${basemap}" is a legacy basemap ID. Use the basemap styles ID "${modern}" instead.` });
      }
    } else {
      errors.push({ path: "map.basemap", message: 'Expected a non-empty basemap ID, such as "arcgis/streets" or "osm".' });
    }
  }

  let fallbackBasemap: string = DEFAULTS.map.fallbackBasemap;
  if (raw.fallbackBasemap !== undefined) {
    if (!isNonEmptyString(raw.fallbackBasemap)) {
      errors.push({ path: "map.fallbackBasemap", message: "Expected a non-empty basemap ID." });
    } else if (isBasemapStyleId(raw.fallbackBasemap.trim())) {
      errors.push({ path: "map.fallbackBasemap", message: 'Expected a basemap that needs no API key, such as "osm" (not a provider/style ID).' });
    } else {
      fallbackBasemap = raw.fallbackBasemap.trim();
    }
  }

  // center
  let center: [number, number] | undefined;
  if (raw.center === undefined && !hasItem) {
    errors.push({ path: "map.center", message: `${UNLESS_ITEM} Expected [longitude, latitude]: an array of two numbers.` });
  } else if (raw.center !== undefined) {
    const c: unknown = raw.center;
    if (!Array.isArray(c) || c.length !== 2) {
      errors.push({ path: "map.center", message: "Expected [longitude, latitude]: an array of two numbers." });
    } else {
      const [lon, lat] = c as [unknown, unknown];
      const lonOk = isFiniteNumber(lon) && lon >= -180 && lon <= 180;
      const latOk = isFiniteNumber(lat) && lat >= -90 && lat <= 90;
      if (!lonOk) errors.push({ path: "map.center[0]", message: "Expected a longitude between -180 and 180." });
      if (!latOk) errors.push({ path: "map.center[1]", message: "Expected a latitude between -90 and 90." });
      if (lonOk && latOk) center = [lon, lat];
    }
  }

  // Initial view: at most one of zoom or scale, and one is required without an item (design D10).
  let zoomOrScale: { zoom: number } | { scale: number } | Record<string, never> = {};
  const hasZoom = raw.zoom !== undefined;
  const hasScale = raw.scale !== undefined;
  if (hasZoom && hasScale) {
    errors.push({ path: "map", message: "Set either map.zoom or map.scale, not both." });
  } else if (!hasZoom && !hasScale) {
    if (!hasItem) errors.push({ path: "map", message: "Required: map.zoom or map.scale." });
  } else if (hasZoom) {
    if (isFiniteNumber(raw.zoom) && raw.zoom >= 0) zoomOrScale = { zoom: raw.zoom };
    else errors.push({ path: "map.zoom", message: "Expected a number 0 or greater." });
  } else if (isFiniteNumber(raw.scale) && raw.scale > 0) {
    zoomOrScale = { scale: raw.scale };
  } else {
    errors.push({ path: "map.scale", message: "Expected a number greater than 0." });
  }

  // 3D settings (map-scenes): rejected in a 2D app, accepted in 3D or with an item.
  const needs3d = (name: string) => `${name} needs "view": "3d".`;
  let ground: GroundSetting | undefined = view === "3d" ? DEFAULTS.map.ground : undefined;
  if (raw.ground !== undefined) {
    if (view === "2d") errors.push({ path: "map.ground", message: needs3d("The ground") });
    else if ((GROUND_SETTINGS as readonly unknown[]).includes(raw.ground)) ground = raw.ground as GroundSetting;
    else errors.push({ path: "map.ground", message: 'Expected "world-elevation" or "none".' });
  }
  let tilt: number | undefined;
  if (raw.tilt !== undefined) {
    if (view === "2d") errors.push({ path: "map.tilt", message: needs3d("Tilt") });
    else if (isFiniteNumber(raw.tilt) && raw.tilt >= 0 && raw.tilt <= 90) tilt = raw.tilt;
    else errors.push({ path: "map.tilt", message: "Expected a number from 0 to 90." });
  }
  let heading: number | undefined;
  if (raw.heading !== undefined) {
    if (view === "2d") errors.push({ path: "map.heading", message: needs3d("Heading") });
    else if (isFiniteNumber(raw.heading) && raw.heading >= 0 && raw.heading < 360) heading = raw.heading;
    else errors.push({ path: "map.heading", message: "Expected a number from 0 up to, but not including, 360." });
  }

  if (errors.length > before) return { map: undefined, view };
  return {
    map: {
      ...(item ? { item } : {}),
      ...(view ? { view } : {}),
      ...(basemap !== undefined ? { basemap } : {}),
      fallbackBasemap,
      ...(center ? { center } : {}),
      ...zoomOrScale,
      ...(ground !== undefined ? { ground } : {}),
      ...(tilt !== undefined ? { tilt } : {}),
      ...(heading !== undefined ? { heading } : {}),
    },
    view,
  };
}
