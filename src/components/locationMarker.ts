import ActionButton from "@arcgis/core/support/actions/ActionButton.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type Graphic from "@arcgis/core/Graphic.js";

/** The SDK's built-in action that the popup component can't carry out on a view graphic. */
const BUILT_IN_REMOVE = "remove-selected-feature";
/** Our replacement, handled by `handleRemoveLocationAction`. */
export const REMOVE_LOCATION_ACTION = "viewer-remove-location";

/** The parts of a locate or track element this module uses. */
interface LocationElement {
  graphic?: Graphic | null;
}

/**
 * Swap the location marker's built-in remove action for ours (design D14), now and whenever
 * the component replaces the marker's popup template. In SDK 5.2 the popup component handles
 * the built-in action by calling `.remove()` on the graphic's owner, which for a `view.graphics`
 * graphic is the MapView, and that throws; its title also never resolves.
 */
export function replaceRemoveAction(element: LocationElement): () => void {
  const handle = reactiveUtils.watch(
    () => element.graphic?.popupTemplate?.actions?.map((a) => a.id).join(","),
    () => {
      const actions = element.graphic?.popupTemplate?.actions;
      if (!actions) return;
      const index = actions.findIndex((a) => a.id === BUILT_IN_REMOVE);
      if (index === -1) return;
      actions.splice(index, 1, new ActionButton({ id: REMOVE_LOCATION_ACTION, title: "Remove", icon: "trash" }));
    },
    { initial: true },
  );
  return () => handle.remove();
}

/** The map element's parts used to handle the action. */
interface MapLike {
  popupElement?: (HTMLElement & { selectedFeature?: Graphic | null; open?: boolean }) | null;
  view?: { graphics: { remove(graphic: Graphic): unknown } } | null;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

/**
 * Handle our "Remove" action once per map (design D14): remove the selected graphic from the
 * view's graphics and close the popup. The popup's `arcgisTriggerAction` event is composed and
 * bubbles out through the map element, so the listener sits on the map: the popup element may
 * not exist yet when components are created.
 */
export function handleRemoveLocationAction(mapElement: MapLike): void {
  if (handled.has(mapElement)) return;
  handled.add(mapElement);
  mapElement.addEventListener("arcgisTriggerAction", (event) => {
    const detail = (event as CustomEvent<{ action?: { id?: string } }>).detail;
    if (detail?.action?.id !== REMOVE_LOCATION_ACTION) return;
    const popup = mapElement.popupElement;
    const graphic = popup?.selectedFeature;
    if (graphic) mapElement.view?.graphics.remove(graphic);
    if (popup) popup.open = false;
  });
}

const handled = new WeakSet<object>();
