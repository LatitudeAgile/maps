import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-action-bar";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell-panel";

import type { PanelComponent } from "../components/createComponents.ts";
import { SidebarState } from "./SidebarState.ts";
import { WIDE_QUERY } from "./insets.ts";

export interface Sidebar {
  state: SidebarState;
  /** The calcite-shell-panel holding the action bar and panels. */
  element: HTMLCalciteShellPanelElement;
}

export interface CreateSidebarOptions {
  /** The page's calcite-shell. */
  shell: HTMLCalciteShellElement;
  /** Panel components in config order (from createComponents). */
  panels: PanelComponent[];
}

/**
 * Build the sidebar (design D1, D3): a floating calcite-shell-panel over a full-window map,
 * with one action and one closable calcite-panel per panel component. Returns undefined, and
 * changes nothing, when there are no panel components.
 */
export function createSidebar({ shell, panels }: CreateSidebarOptions): Sidebar | undefined {
  if (panels.length === 0) return undefined;

  const state = new SidebarState();

  // The map stays in the shell's default slot and fills it; panels float over it (D1).
  shell.contentBehind = true;

  const shellPanel = document.createElement("calcite-shell-panel");
  shellPanel.collapsed = true; // starts collapsed (P-20)
  shellPanel.classList.add("sidebar");

  const actionBar = document.createElement("calcite-action-bar");
  actionBar.slot = "action-bar";
  actionBar.expandToggleDisabled = true; // no expand toggle (expandDisabled is deprecated since Calcite 5.2)
  shellPanel.append(actionBar);

  const actions = new Map<string, HTMLCalciteActionElement>();
  const calcitePanels = new Map<string, HTMLCalcitePanelElement>();

  for (const { entry, element, heading, icon } of panels) {
    const id = entry.id;

    const action = document.createElement("calcite-action");
    action.text = heading;
    action.label = heading;
    // Config icon names aren't checked against Calcite's set (design D7): unknown names show no glyph.
    action.icon = icon as HTMLCalciteActionElement["icon"];
    action.setAttribute("data-panel-for", id);
    action.addEventListener("click", () => state.toggle(id));
    actionBar.append(action);
    actions.set(id, action);

    const panel = document.createElement("calcite-panel");
    panel.heading = heading;
    panel.closable = true;
    panel.hidden = true;
    panel.id = `sidebar-panel-${id}`;
    panel.setAttribute("data-panel-for", id);
    panel.addEventListener("calcitePanelClose", () => {
      // Don't leave focus inside the now-hidden panel: return it to the panel's icon (Calcite
      // accessibility guidance; P-26). A no-op if Escape already closed it.
      const wasOpen = state.openId === id;
      state.close();
      if (wasOpen) void action.setFocus();
    });
    panel.append(element as unknown as Node);
    shellPanel.append(panel);
    calcitePanels.set(id, panel);
  }

  state.onChange((openId) => {
    for (const [id, action] of actions) {
      action.active = id === openId;
      // Screen readers: the icon controls its panel and says whether it is open (P-26, D5).
      action.aria = { expanded: id === openId, controlsElements: [calcitePanels.get(id)!] };
    }
    for (const [id, panel] of calcitePanels) {
      const open = id === openId;
      panel.hidden = !open;
      // A closable panel marks itself closed when its close button is used; reopen it.
      if (open) panel.closed = false;
    }
    shellPanel.collapsed = openId === undefined;
  });

  // Wide: a vertical bar on the starting side. Narrow: a horizontal bar along the bottom, with
  // the panel rising above it (P-25, design D2). Moving one element keeps the open panel and
  // its component alive across the switch.
  const wide = window.matchMedia(WIDE_QUERY);
  const applyLayout = () => {
    const isWide = wide.matches;
    shellPanel.slot = isWide ? "panel-start" : "panel-bottom";
    shellPanel.position = isWide ? "start" : "end";
    shellPanel.layout = isWide ? "vertical" : "horizontal";
    // Full width on narrow screens (no floating margins); floating over the map when wide.
    shellPanel.displayMode = isWide ? "float-all" : "overlay";
    actionBar.layout = isWide ? "vertical" : "horizontal";
    // Phones: the bar starts from the right, first icon nearest the thumb (design D12). Only
    // the bar's direction changes; Tab still follows config order, now read from the right.
    if (isWide) actionBar.removeAttribute("dir");
    else actionBar.dir = "rtl";
  };
  applyLayout();
  wide.addEventListener("change", applyLayout);

  // Phones: Calcite's arrow keys follow DOM order (Right = next) whatever the direction, which
  // on the right-to-left bar points the wrong way. Swap Left and Right and re-send the key from
  // the same element, so Calcite still does the focusing and its Tab-stop bookkeeping (D12).
  // Calcite reads event.key and doesn't check isTrusted.
  const mirrored = new WeakSet<Event>();
  actionBar.addEventListener(
    "keydown",
    (event) => {
      if (wide.matches || mirrored.has(event) || !event.target) return;
      const key = event.key === "ArrowLeft" ? "ArrowRight" : event.key === "ArrowRight" ? "ArrowLeft" : undefined;
      if (!key) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const swapped = new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true });
      mirrored.add(swapped);
      event.target.dispatchEvent(swapped);
    },
    { capture: true },
  );

  for (const [id, action] of actions) action.aria = { expanded: false, controlsElements: [calcitePanels.get(id)!] };

  // Escape closes the open panel and returns focus to its icon (P-26). Capture phase: a closable
  // calcite-panel handles Escape itself and closes first, which would hide which panel was open.
  shellPanel.addEventListener(
    "keydown",
    (event) => {
      const openId = state.openId;
      if (event.key !== "Escape" || openId === undefined) return;
      event.preventDefault();
      state.close();
      void actions.get(openId)?.setFocus();
    },
    { capture: true },
  );

  shell.append(shellPanel);
  return { state, element: shellPanel };
}
