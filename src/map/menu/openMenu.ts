// Opening the map menu (map-menu; add-map-menu D2, D3): a right-click is the view's click with
// button 2, which the view sends only for a press and release without a drag, so rotating or
// tilting with the right button never opens it. A long press opens it on touch and pen, and the
// ContextMenu key or Shift+F10 opens it for the map's center. The browser's own menu is cancelled
// over the map's surface only, not over the components in its corners.
import type Point from "@arcgis/core/geometry/Point.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { MapMenuEntry } from "../../config/mapMenu.ts";
import { showMapMenuItemError } from "../../ui/notices.ts";
import type { ViewElement } from "../viewElement.ts";
import { menuContents, type ContentsOptions } from "./contents.ts";
import { isMapMenuHeld } from "./hold.ts";
import type { MapMenuContext, MapMenuItem } from "./registry.ts";
import { MenuView } from "./renderMenu.ts";

export interface MapMenuOptions {
  element: ViewElement;
  view: MapView | SceneView;
  /** The normalized `mapMenu` entries. */
  entries: readonly MapMenuEntry[];
  itemFor: ContentsOptions["itemFor"];
  headingFor: ContentsOptions["headingFor"];
}

type ViewPointerDetail = { button: number; pointerType?: string; x: number; y: number; mapPoint?: Point | null };

/** The spot's WGS84 latitude and longitude, projecting only for other spatial references. */
async function latitudeLongitude(point: Point): Promise<{ latitude: number; longitude: number } | undefined> {
  const sr = point.spatialReference;
  if (sr.isWGS84) return { latitude: point.y, longitude: point.x };
  if (sr.isWebMercator) return { latitude: point.latitude!, longitude: point.longitude! };
  const [projectOperator, { default: SpatialReference }] = await Promise.all([
    import("@arcgis/core/geometry/operators/projectOperator.js"),
    import("@arcgis/core/geometry/SpatialReference.js"),
  ]);
  if (!projectOperator.isLoaded()) await projectOperator.load();
  const projected = projectOperator.execute(point, SpatialReference.WGS84) as Point | null | undefined;
  return projected ? { latitude: projected.y, longitude: projected.x } : undefined;
}

/** Start the map menu on `element`. Returns a function that stops it. */
export function startMapMenu({ element, view, entries, itemFor, headingFor }: MapMenuOptions): () => void {
  const menu = new MenuView(element, view);
  let opening = 0;

  const run = async (item: MapMenuItem, context: MapMenuContext) => {
    try {
      await item.run(context);
    } catch (error) {
      console.error(`[viewer] The map menu item "${item.label}" failed.`, error);
      showMapMenuItemError(item.label);
    }
  };

  const open = async (screenPoint: { x: number; y: number }, mapPoint: Point | null | undefined) => {
    const mine = ++opening;
    menu.close();
    // No ground under the spot (the sky in a scene), or a drawing tool has the click.
    if (!mapPoint || isMapMenuHeld()) return;
    const lonLat = await latitudeLongitude(mapPoint);
    if (!lonLat || mine !== opening) return;
    const context: MapMenuContext = Object.freeze({ mapPoint, ...lonLat, screenPoint: Object.freeze({ ...screenPoint }), view, element });
    const groups = menuContents({ entries, context, itemFor, headingFor });
    if (groups.length === 0) return;
    await menu.open(screenPoint, groups, (item) => void run(item, context));
  };

  const onClick = (event: Event) => {
    const detail = (event as CustomEvent<ViewPointerDetail>).detail;
    if (detail.button === 2) void open({ x: detail.x, y: detail.y }, detail.mapPoint);
    // Any other click or tap on the map closes it. Calcite closes on a click outside, but a tap
    // on the map gives no DOM click (the view handles the touch), so on a phone it stayed open.
    else if (menu.isOpen) menu.close();
  };
  const onHold = (event: Event) => {
    const detail = (event as CustomEvent<ViewPointerDetail>).detail;
    // A held mouse button is left alone; touch and pen open the menu.
    if (detail.pointerType !== "mouse") void open({ x: detail.x, y: detail.y }, detail.mapPoint);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    // Only from the map itself, not from a component in a corner.
    if (isInCornerUi(event)) return;
    event.preventDefault();
    const p = view.padding;
    const left = p?.left ?? 0;
    const top = p?.top ?? 0;
    const x = left + (view.width - left - (p?.right ?? 0)) / 2;
    const y = top + (view.height - top - (p?.bottom ?? 0)) / 2;
    void open({ x, y }, view.toMap({ x, y }));
  };
  // A component in a corner is a light-DOM child of the map element; the view's own surface is in
  // the element's shadow root.
  const isInCornerUi = (event: Event) => event.composedPath().some((node) => node instanceof Element && node !== element && element.contains(node));
  const onContextMenu = (event: Event) => {
    if (!isInCornerUi(event)) event.preventDefault();
  };
  const onViewChange = () => {
    if (menu.isOpen) menu.close();
  };

  // Listened to as a plain element: the two map elements' event maps don't combine.
  const target: HTMLElement = element;
  target.addEventListener("arcgisViewClick", onClick);
  target.addEventListener("arcgisViewHold", onHold);
  target.addEventListener("keydown", onKey);
  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("arcgisViewChange", onViewChange);
  return () => {
    menu.close();
    target.removeEventListener("arcgisViewClick", onClick);
    target.removeEventListener("arcgisViewHold", onHold);
    target.removeEventListener("keydown", onKey);
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("arcgisViewChange", onViewChange);
  };
}
