import type Viewpoint from "@arcgis/core/Viewpoint.js";
import type { MapViewKind, ViewerConfig } from "../config/types.ts";
import { READY_TIMEOUT_MS } from "./createMap.ts";
import type { ViewElement } from "./viewElement.ts";

type MapConfig = ViewerConfig["map"];

/**
 * The parts of the starting view that are applied once the view is ready (add-web-maps-and-
 * scenes D4): with an item, every override the config sets; in a config-built scene, the tilt
 * and heading (center and zoom or scale were already set on the element). Undefined when there
 * is nothing to apply.
 */
export function startingViewTarget(map: MapConfig, view: MapViewKind, fromItem: boolean): Record<string, unknown> | undefined {
  const target: Record<string, unknown> = {};
  if (fromItem) {
    if (map.center) target.center = [...map.center];
    if (map.scale !== undefined) target.scale = map.scale;
    else if (map.zoom !== undefined) target.zoom = map.zoom;
  }
  if (view === "3d") {
    if (map.tilt !== undefined) target.tilt = map.tilt;
    if (map.heading !== undefined) target.heading = map.heading;
  }
  return Object.keys(target).length > 0 ? target : undefined;
}

/** Settings a web map can't use, each worth one console warning (map-scenes). */
export function ignoredForWebMap(map: MapConfig): string[] {
  return (["tilt", "heading", "ground"] as const).filter((k) => map[k] !== undefined).map((k) => `map.${k}`);
}

/**
 * Apply the starting view once the view is ready, without animation, and return the view's
 * viewpoint afterwards: the view Home returns to (D4). Returns undefined for a config-built 2D
 * map, whose Home keeps its own default, and when the view never becomes ready.
 */
export async function applyStartingView(mapEl: ViewElement, map: MapConfig, view: MapViewKind, fromItem: boolean): Promise<Viewpoint | undefined> {
  // A view that never becomes ready is reported by createView; don't hold up the components.
  const ready = await Promise.race([
    mapEl.viewOnReady().then(() => true, () => false),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), READY_TIMEOUT_MS)),
  ]);
  if (!ready) return undefined;
  const target = startingViewTarget(map, view, fromItem);
  if (target && view === "3d" && (target.tilt !== undefined || target.heading !== undefined)) {
    // Tilting or turning alone moves the scene's center: look at the intended center and scale
    // (the configured ones, or the view's current ones) while turning.
    const v = mapEl.view;
    target.center ??= map.center ? [...map.center] : v?.center?.clone();
    if (target.scale === undefined && target.zoom === undefined) {
      if (map.scale !== undefined) target.scale = map.scale;
      else if (map.zoom !== undefined) target.zoom = map.zoom;
      else target.scale = v?.scale;
    }
  }
  if (target) {
    // A pan or zoom the user starts first interrupts it; the view then simply stays where it is.
    await mapEl.goTo(target, { animate: false }).catch(() => undefined);
  }
  if (!fromItem && view === "2d") return undefined;
  return mapEl.view?.viewpoint?.clone();
}
