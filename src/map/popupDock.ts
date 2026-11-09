import { WIDE_QUERY } from "../sidebar/insets.ts";

/**
 * How map popups dock (add-print-and-sketch-panels D14).
 *
 * - Popups open undocked, beside the feature, on every screen: the SDK would otherwise dock them
 *   automatically on small screens (`dockOptions.breakpoint`), which is turned off.
 * - When the user docks one with the popup's dock button, it docks at the SDK's default
 *   position on wide screens. On phones it docks at the top: the sidebar is a bar along the
 *   bottom there, and the SDK's phone-width bottom dock is a full-width sheet that ignores the
 *   map's bottom inset (`--arcgis-layout-overlay-space-bottom`), so it would sit under the bar
 *   and any open panel.
 */
export function popupDockOptions(wide: boolean): { breakpoint: false; position: "auto" | "top-center" } {
  return { breakpoint: false, position: wide ? "auto" : "top-center" };
}

/** The parts of arcgis-map used here. */
interface MapWithPopup {
  readonly popupElement: { dockOptions: Record<string, unknown>; dockEnabled: boolean } | null;
}

/**
 * Apply `popupDockOptions` to the map's popup, following the layout as the window crosses the
 * breakpoint, and start undocked. Call once the view is ready. Returns a function that stops
 * following. Crossing the breakpoint keeps whether the user docked the popup.
 */
export function followPopupDocking(mapElement: MapWithPopup, wide: MediaQueryList = window.matchMedia(WIDE_QUERY)): () => void {
  const apply = () => {
    const popup = mapElement.popupElement;
    if (!popup) return;
    popup.dockOptions = { ...popup.dockOptions, ...popupDockOptions(wide.matches) };
  };
  apply();
  // On a small screen the SDK has already docked it by the time the view is ready (probed).
  if (mapElement.popupElement) mapElement.popupElement.dockEnabled = false;
  wide.addEventListener("change", apply);
  return () => wide.removeEventListener("change", apply);
}
