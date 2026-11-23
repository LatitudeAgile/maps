// Corner components behind an expand button (map-components; add-map-expand-and-components
// D3, D4). The expand only wraps the component: options, configure hooks and view limits apply
// to the component as they do without one.
import type { ComponentConfig, ExpandMode } from "../config/types.ts";
import { notifyOpen, PANEL_REQUEST_OPEN } from "../sidebar/panelEvents.ts";

/**
 * Which side of its button a floating expand opens on, by corner: beside the button, lined up
 * with its outer edge. The SDK picks these from the expand's own slot, but here the corner's stack
 * holds the slot, so the SDK would fall back to "auto", which can run the component against the
 * map's edge.
 */
const POPOVER_PLACEMENTS: Partial<Record<ComponentConfig["placement"], HTMLArcgisExpandElement["placement"]>> = {
  "top-left": "right-start",
  "top-start": "right-start",
  "top-right": "left-start",
  "top-end": "left-start",
  "bottom-left": "right-end",
  "bottom-start": "right-end",
  "bottom-right": "left-end",
  "bottom-end": "left-end",
};

export const loadExpand = (): Promise<unknown> => import("@arcgis/map-components/components/arcgis-expand");

/**
 * Wrap a corner component's element in an `arcgis-expand` with its settings resolved: the icon
 * and tooltip from the entry, else from the type's panel icon and heading (the ones the sidebar
 * would show), the group from the entry, else the corner. The expand's opening and closing are
 * passed on to the element as panel events, and the element's request to open opens the expand.
 */
export function wrapInExpand(
  entry: ComponentConfig,
  element: HTMLElement,
  panel: { heading: string; icon: string },
  defaultMode: ExpandMode = "auto",
): HTMLArcgisExpandElement {
  const settings = entry.expand ?? {};
  const expand = document.createElement("arcgis-expand");
  // Always set: the SDK's own lookup (the content's icon) finds nothing for custom elements or
  // the layer list, and the sidebar's icon is the one to match (D3).
  expand.expandIcon = (settings.icon ?? panel.icon) as HTMLArcgisExpandElement["expandIcon"];
  const tooltip = settings.tooltip ?? panel.heading;
  expand.expandTooltip = tooltip;
  expand.label = tooltip;
  const group = settings.group ?? entry.placement;
  if (group !== false) expand.group = group;
  expand.mode = settings.mode ?? defaultMode;
  const placement = POPOVER_PLACEMENTS[entry.placement];
  if (placement) expand.placement = placement;
  expand.expanded = settings.expanded ?? false;
  expand.setAttribute("data-expand-for", entry.id);
  expand.append(element);

  // Tell the component only on a change, whatever raised it: the button, Escape, another expand
  // in the group, or the startup open below.
  let told = false;
  const tell = (open: boolean) => {
    if (open === told) return;
    told = open;
    notifyOpen(element, open);
  };
  expand.addEventListener("arcgisPropertyChange", (event) => {
    // Components inside raise the same event name, and it bubbles.
    if (event.target !== expand) return;
    if ((event as CustomEvent<{ name?: string }>).detail?.name === "expanded") tell(expand.expanded);
  });
  expand.addEventListener(PANEL_REQUEST_OPEN, (event) => {
    event.stopPropagation();
    if (!expand.expanded) void expand.expand();
  });
  // Open at startup: told once the expand is on the page, as a component put into an already
  // open panel is (D4).
  if (expand.expanded) {
    void expand.componentOnReady().then(
      () => tell(expand.expanded),
      () => undefined,
    );
  }
  return expand;
}
