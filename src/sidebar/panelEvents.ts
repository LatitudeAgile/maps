/**
 * How a component's container, a sidebar panel or a corner expand, talks to it
 * (add-print-and-sketch-panels D3, add-map-expand-and-components D4). Documented for custom
 * components in docs/custom-components.md.
 *
 * - `viewer-panel-open` and `viewer-panel-close` are dispatched on the component's element when
 *   its container opens and closes, however that happens: its icon or button, its close button,
 *   Escape, a switch to another panel, or another expand in its group opening. On a sidebar
 *   switch, the old panel's close comes before the new one's open; across expands the order is
 *   the SDK's. They don't bubble.
 * - A component asks for its container to be opened by dispatching `viewer-panel-request-open`
 *   from its element, bubbling and composed. It opens the panel or expand as if its icon or
 *   button was pressed while closed; for one that is already open, it does nothing. A component
 *   in a corner without an expand, or headless, can dispatch it safely: nothing listens there.
 */
export const PANEL_OPEN = "viewer-panel-open";
export const PANEL_CLOSE = "viewer-panel-close";
export const PANEL_REQUEST_OPEN = "viewer-panel-request-open";

/**
 * Tell panel components about a sidebar change: close on the previous panel's component first,
 * then open on the new one's.
 */
export function notifyPanels(components: ReadonlyMap<string, EventTarget>, openId: string | undefined, previousId: string | undefined): void {
  if (previousId !== undefined) notifyOpen(components.get(previousId), false);
  if (openId !== undefined) notifyOpen(components.get(openId), true);
}

/** Tell a component its container opened or closed. */
export function notifyOpen(element: EventTarget | undefined, open: boolean): void {
  element?.dispatchEvent(new Event(open ? PANEL_OPEN : PANEL_CLOSE));
}

/** Ask the sidebar to open the panel that holds `element`. */
export function requestPanelOpen(element: Element): void {
  element.dispatchEvent(new Event(PANEL_REQUEST_OPEN, { bubbles: true, composed: true }));
}
