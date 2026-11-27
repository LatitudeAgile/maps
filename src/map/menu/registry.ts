// Map menu items added by components and extensions (map-menu; add-map-menu D5). One app-wide
// registry, keyed by the component's element: components in the sidebar sit outside the view
// element, so they can't register against it. The viewer API re-exports `addMapMenuItems` and
// the types, so this module has no runtime imports, and none from the components registry.
import type Point from "@arcgis/core/geometry/Point.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { ViewElement } from "../viewElement.ts";

/** The spot the menu was opened for. The same object goes to every item of one opening (D3). */
export interface MapMenuContext {
  /** The spot, in the view's spatial reference. */
  readonly mapPoint: Point;
  /** The spot's WGS84 latitude and longitude, in degrees. */
  readonly latitude: number;
  readonly longitude: number;
  /** Where the menu was opened, in view pixels from the view's top left. */
  readonly screenPoint: { readonly x: number; readonly y: number };
  readonly view: MapView | SceneView;
  /** The map element (`arcgis-map` or `arcgis-scene`). */
  readonly element: ViewElement;
}

/** One menu item. */
export interface MapMenuItem {
  /** Unique within the component. */
  id: string;
  /** The text the menu shows. */
  label: string;
  /** A Calcite icon name. */
  icon?: string;
  /** Whether the item is listed for this spot; listed when absent. A throw counts as false. */
  appliesTo?(context: MapMenuContext): boolean;
  /** What picking the item does. A throw or rejection is shown in a notice naming the item. */
  run(context: MapMenuContext): void | Promise<void>;
}

const groups = new Map<HTMLElement, readonly MapMenuItem[]>();

/**
 * Add `element`'s items to the map menu, shown as one group headed with its component's heading.
 * Calling it again for the same element replaces its items. Returns a function that removes
 * them. An element that has left the page is dropped at the next opening anyway.
 */
export function addMapMenuItems(element: HTMLElement, items: readonly MapMenuItem[]): () => void {
  const own = [...items];
  groups.set(element, own);
  return () => {
    if (groups.get(element) === own) groups.delete(element);
  };
}

/** The items registered by the component whose config id is `componentId`, on connected elements. */
export function itemsForComponent(componentId: string): MapMenuItem[] {
  const items: MapMenuItem[] = [];
  for (const [element, own] of groups) {
    if (!element.isConnected) {
      groups.delete(element);
      continue;
    }
    if (element.getAttribute("data-component-id") === componentId) items.push(...own);
  }
  return items;
}
