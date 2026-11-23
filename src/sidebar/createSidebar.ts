import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-action-bar";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell-panel";

import type { PanelComponent, PanelSlot } from "../components/createComponents.ts";
import { notifyPanels, PANEL_OPEN, PANEL_REQUEST_OPEN } from "./panelEvents.ts";
import { SidebarState } from "./SidebarState.ts";
import { WIDE_QUERY } from "./insets.ts";

export interface Sidebar {
  state: SidebarState;
  /** The calcite-shell-panel holding the action bar and panels. */
  element: HTMLCalciteShellPanelElement;
  /**
   * Put the panel components in their panels, once the component stage is done
   * (show-sidebar-at-startup D2). A slot with no matching component shows that it couldn't be
   * loaded (D5). Only the first call does anything.
   */
  fill(panels: readonly PanelComponent[]): void;
}

export interface CreateSidebarOptions {
  /** The page's calcite-shell. */
  shell: HTMLCalciteShellElement;
  /** Panel slots in config order, known from config before any component exists (D1). */
  slots: readonly PanelSlot[];
  /**
   * A built-in panel at the end of the bar, such as Apps (add-app-selector D4). Its content is
   * there from the start: `fill` never touches it.
   */
  end?: EndPanel;
}

/** A built-in panel whose action sits in the action bar's `actions-end` slot (D4). */
export interface EndPanel {
  /** A sidebar id no component can have; component ids can't contain a colon. */
  id: `:${string}`;
  heading: string;
  icon: string;
  /** The panel's content. It gets the same panel open and close events as a component. */
  element: HTMLElement;
}

/**
 * Build the sidebar (design D1, D3): a floating calcite-shell-panel over a full-window map,
 * with one action and one closable calcite-panel per panel slot. Built at startup, before the
 * map, with every panel showing a loader until `fill` (show-sidebar-at-startup D2, D3).
 * Returns undefined, and changes nothing, when there are no panel slots.
 */
export function createSidebar({ shell, slots, end }: CreateSidebarOptions): Sidebar | undefined {
  if (slots.length === 0 && !end) return undefined;

  const state = new SidebarState();

  // The map stays in the shell's default slot and fills it; panels float over it (D1).
  shell.contentBehind = true;

  const shellPanel = document.createElement("calcite-shell-panel");
  shellPanel.collapsed = true; // starts collapsed
  shellPanel.classList.add("sidebar");

  const actionBar = document.createElement("calcite-action-bar");
  actionBar.slot = "action-bar";
  actionBar.expandToggleDisabled = true; // no expand toggle (expandDisabled is deprecated since Calcite 5.2)
  shellPanel.append(actionBar);

  const actions = new Map<string, HTMLCalciteActionElement>();
  const calcitePanels = new Map<string, HTMLCalcitePanelElement>();
  const components = new Map<string, EventTarget>();

  const addPanel = ({ id, heading, icon }: PanelSlot, actionSlot?: string): HTMLCalcitePanelElement => {
    const action = document.createElement("calcite-action");
    action.text = heading;
    action.label = heading;
    // Config icon names aren't checked against Calcite's set (design D7): unknown names show no glyph.
    action.icon = icon as HTMLCalciteActionElement["icon"];
    action.setAttribute("data-panel-for", id);
    action.addEventListener("click", () => state.toggle(id));
    if (actionSlot) action.slot = actionSlot;
    actionBar.append(action);
    actions.set(id, action);

    const panel = document.createElement("calcite-panel");
    panel.heading = heading;
    panel.closable = true;
    panel.hidden = true;
    // A colon isn't valid in a CSS id selector without escaping; keep ids plain.
    panel.id = `sidebar-panel-${id.replace(/^:/, "builtin-")}`;
    panel.setAttribute("data-panel-for", id);
    panel.addEventListener("calcitePanelClose", () => {
      // Don't leave focus inside the now-hidden panel: return it to the panel's icon (Calcite
      // accessibility guidance). A no-op if Escape already closed it.
      const wasOpen = state.openId === id;
      state.close();
      if (wasOpen) void action.setFocus();
    });
    // A component asks for its own panel, e.g. Sketch's Edit sketch popup action (D3).
    panel.addEventListener(PANEL_REQUEST_OPEN, (event) => {
      event.stopPropagation();
      state.open(id);
    });
    shellPanel.append(panel);
    calcitePanels.set(id, panel);
    return panel;
  };

  for (const slot of slots) {
    const panel = addPanel(slot);
    // Until fill: the heading and close button show, with a loader for content (D3). Not the
    // panel's own `loading`: its scrim covers the whole panel, close button included.
    const loader = document.createElement("calcite-loader");
    loader.label = `Loading ${slot.heading}`;
    loader.classList.add("panel-loader");
    panel.append(loader);
  }
  if (end) {
    // After every panel component, at the end of the bar (add-app-selector D4).
    const panel = addPanel(end, "actions-end");
    panel.append(end.element);
    components.set(end.id, end.element);
  }

  let filled = false;
  const fill = (panels: readonly PanelComponent[]) => {
    if (filled) return;
    filled = true;
    const byId = new Map(panels.map((p) => [p.entry.id, p]));
    for (const { id, heading } of slots) {
      const panel = calcitePanels.get(id)!;
      const component = byId.get(id);
      if (component) {
        const element = component.element as unknown as Element;
        panel.replaceChildren(element);
        components.set(id, element);
        // Opened while loading: tell it now, as if its panel had just opened (D4).
        if (state.openId === id) element.dispatchEvent(new Event(PANEL_OPEN));
      } else {
        // Load or set-up failed, or startup stopped first; reported on the error channel (D5).
        panel.replaceChildren(failedNotice(heading));
      }
    }
  };

  state.onChange((openId) => {
    for (const [id, action] of actions) {
      action.active = id === openId;
      // Screen readers: the icon controls its panel and says whether it is open (D5).
      action.aria = { expanded: id === openId, controlsElements: [calcitePanels.get(id)!] };
    }
    for (const [id, panel] of calcitePanels) {
      const open = id === openId;
      panel.hidden = !open;
      // A closable panel marks itself closed when its close button is used; reopen it.
      if (open) panel.closed = false;
    }
    shellPanel.collapsed = openId === undefined;
    // With a panel open, a themed icon bar is drawn solid (style.css, D13).
    shellPanel.classList.toggle("panel-open", openId !== undefined);
  });

  // Tell components when their panel closes and opens, once the panels show the new state: the
  // old one first on a switch, so it can finish its work before the next one opens (D3).
  state.onChange((openId, previousId) => notifyPanels(components, openId, previousId));

  // Wide: a vertical bar on the starting side. Narrow: a horizontal bar along the bottom, with
  // the panel rising above it (design D2). Moving one element keeps the open panel and
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

  // Escape closes the open panel and returns focus to its icon. Capture phase: a closable
  // calcite-panel handles Escape itself and closes first, which would hide which panel was open.
  // A dialog or popover open inside the panel gets Escape first, and the panel stays (D4).
  shellPanel.addEventListener(
    "keydown",
    (event) => {
      const openId = state.openId;
      if (event.key !== "Escape" || openId === undefined) return;
      if (inOpenPopup(event) || containsOpenPopup(components.get(openId))) return;
      event.preventDefault();
      state.close();
      void actions.get(openId)?.setFocus();
    },
    { capture: true },
  );

  shell.append(shellPanel);
  return { state, element: shellPanel, fill };
}

/** The content of a panel whose component couldn't be loaded or set up (D5). */
function failedNotice(heading: string): HTMLCalciteNoticeElement {
  const notice = document.createElement("calcite-notice");
  notice.open = true;
  notice.kind = "danger";
  notice.icon = true;
  notice.classList.add("panel-failed");
  const title = document.createElement("div");
  title.slot = "title";
  title.textContent = `${heading} couldn't be loaded`;
  const message = document.createElement("div");
  message.slot = "message";
  message.textContent = "Reload the page to try again.";
  notice.append(title, message);
  return notice;
}

const isOpenPopup = (node: unknown): boolean => {
  const tag = (node as Element | null)?.tagName;
  return (tag === "CALCITE-DIALOG" || tag === "CALCITE-POPOVER") && (node as { open?: boolean }).open === true;
};

/** Whether a key event comes from inside an open calcite-dialog or calcite-popover (D4). */
export function inOpenPopup(event: Event): boolean {
  return event.composedPath().some(isOpenPopup);
}

/**
 * Whether a panel component has an open calcite-dialog or calcite-popover, in its light DOM or
 * its shadow roots (D4). Covers Escape pressed on a popover's own button, outside the popover.
 */
export function containsOpenPopup(root: unknown): boolean {
  if (!(root instanceof Element)) return false;
  const stack: (Element | ShadowRoot)[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node instanceof Element) {
      if (isOpenPopup(node)) return true;
      if (node.shadowRoot) stack.push(node.shadowRoot);
    }
    for (const child of node.children) stack.push(child);
  }
  return false;
}
