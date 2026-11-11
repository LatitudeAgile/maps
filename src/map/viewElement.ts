import type { MapViewKind } from "../config/types.ts";

/**
 * The element that shows the app's map: `arcgis-map` in 2D, `arcgis-scene` in 3D. Code that
 * works in both views takes this type; code that is 2D only (the sketch panel) keeps
 * `HTMLArcgisMapElement` (add-web-maps-and-scenes D6).
 */
export type ViewElement = HTMLArcgisMapElement | HTMLArcgisSceneElement;

/** Matches either map element, for `closest()` and `querySelector()`. */
export const VIEW_ELEMENT_SELECTOR = "arcgis-map, arcgis-scene";

/** The tag for a view. */
export const viewElementTag = (view: MapViewKind): "arcgis-map" | "arcgis-scene" => (view === "3d" ? "arcgis-scene" : "arcgis-map");

/** The map element `from` sits in, such as a component placed in a map corner, or null. */
export function findViewElement(from: Element): ViewElement | null {
  return from.closest<ViewElement>(VIEW_ELEMENT_SELECTOR);
}
