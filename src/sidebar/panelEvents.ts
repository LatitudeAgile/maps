/**
 * How the sidebar and a panel component talk (add-print-and-sketch-panels D3). Documented for
 * custom components in docs/custom-components.md.
 *
 * - `viewer-panel-open` and `viewer-panel-close` are dispatched on the component's element when
 *   its panel opens and closes, however that happens: its icon, its close button, Escape, or a
 *   switch to another panel. On a switch, the old panel's close comes before the new one's open.
 *   They don't bubble.
 * - A component asks for its panel to be opened by dispatching `viewer-panel-request-open` from
 *   its element, bubbling and composed. It opens the panel as if its icon was activated while
 *   closed; for a panel that is already open, it does nothing. A component outside the sidebar
 *   (in a map corner, or headless) can dispatch it safely: nothing listens there.
 */
export const PANEL_OPEN = "viewer-panel-open";
export const PANEL_CLOSE = "viewer-panel-close";
export const PANEL_REQUEST_OPEN = "viewer-panel-request-open";

/**
 * Tell panel components about a sidebar change: close on the previous panel's component first,
 * then open on the new one's.
 */
export function notifyPanels(components: ReadonlyMap<string, EventTarget>, openId: string | undefined, previousId: string | undefined): void {
  if (previousId !== undefined) components.get(previousId)?.dispatchEvent(new Event(PANEL_CLOSE));
  if (openId !== undefined) components.get(openId)?.dispatchEvent(new Event(PANEL_OPEN));
}

/** Ask the sidebar to open the panel that holds `element`. */
export function requestPanelOpen(element: Element): void {
  element.dispatchEvent(new Event(PANEL_REQUEST_OPEN, { bubbles: true, composed: true }));
}
