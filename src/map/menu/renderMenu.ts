// The map menu on screen (map-menu; add-map-menu D4): one calcite-dropdown per view element,
// refilled at each opening. It is anchored to an invisible, focusable element at the spot: the
// dropdown's arrow keys, Enter and Escape work through its reference element, which a virtual
// reference can't give. Calcite takes no boundary, so the menu measures itself and picks the side
// of the spot that has room in the map less its padding (the sidebar), and doesn't flip.
import "@esri/calcite-components/components/calcite-dropdown";
import "@esri/calcite-components/components/calcite-dropdown-group";
import "@esri/calcite-components/components/calcite-dropdown-item";

import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { ViewElement } from "../viewElement.ts";
import type { MenuGroup } from "./contents.ts";
import type { MapMenuItem } from "./registry.ts";

/** Room kept between the menu and the map's edges, in pixels. */
const EDGE = 8;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class MenuView {
  readonly #element: ViewElement;
  readonly #view: MapView | SceneView;
  readonly #dropdown: HTMLCalciteDropdownElement;
  readonly #anchor: HTMLDivElement;
  #opening = 0;

  constructor(element: ViewElement, view: MapView | SceneView) {
    this.#element = element;
    this.#view = view;
    this.#anchor = document.createElement("div");
    this.#anchor.className = "viewer-map-menu-anchor";
    this.#anchor.tabIndex = -1;
    this.#anchor.setAttribute("aria-hidden", "true");
    Object.assign(this.#anchor.style, { position: "fixed", width: "0", height: "0", outline: "none", pointerEvents: "none" });

    this.#dropdown = document.createElement("calcite-dropdown");
    this.#dropdown.className = "viewer-map-menu";
    this.#dropdown.overlayPositioning = "fixed";
    this.#dropdown.flipPlacements = [];
    this.#dropdown.referenceElement = this.#anchor;
    this.#dropdown.setAttribute("aria-label", "Map menu");
    this.#dropdown.addEventListener("calciteDropdownClose", () => {
      // Closed by Escape or a pick, focus was on the anchor: give it back to the map.
      if (document.activeElement === this.#anchor) this.#view.focus();
      this.#anchor.remove();
    });
    // In the map element, so the menu takes the map's color mode.
    element.append(this.#dropdown);
  }

  get isOpen(): boolean {
    return this.#dropdown.open;
  }

  /** Open the menu at `at` (view pixels) with `groups`; `onPick` runs after it closes. */
  async open(at: { x: number; y: number }, groups: readonly MenuGroup[], onPick: (item: MapMenuItem) => void): Promise<void> {
    const opening = ++this.#opening;
    this.close();
    const bounds = this.#bounds();
    const host = this.#element.getBoundingClientRect();
    const x = Math.min(Math.max(host.left + at.x, bounds.left), bounds.right);
    const y = Math.min(Math.max(host.top + at.y, bounds.top), bounds.bottom);
    Object.assign(this.#anchor.style, { left: `${x}px`, top: `${y}px` });
    document.body.append(this.#anchor);

    this.#dropdown.replaceChildren(...groups.map((group) => this.#group(group, onPick)));
    this.#dropdown.placement = "bottom-start";
    // Measured before it's shown, then placed where it fits.
    this.#dropdown.style.visibility = "hidden";
    const opened = new Promise((resolve) => this.#dropdown.addEventListener("calciteDropdownOpen", resolve, { once: true }));
    this.#dropdown.open = true;
    await opened;
    if (opening !== this.#opening) return;
    const size = this.#size();
    const below = y + size.height <= bounds.bottom || bounds.bottom - y >= y - bounds.top;
    const after = x + size.width <= bounds.right || bounds.right - x >= x - bounds.left;
    this.#dropdown.placement = `${below ? "bottom" : "top"}-${after ? "start" : "end"}`;
    await this.#dropdown.reposition();
    if (opening !== this.#opening) return;
    this.#dropdown.style.visibility = "";
    this.#anchor.focus({ preventScroll: true });
  }

  close(): void {
    if (this.#dropdown.open) this.#dropdown.open = false;
  }

  /** The map less its padding (the sidebar and its bar), less a small margin. */
  #bounds(): Box {
    const rect = this.#element.getBoundingClientRect();
    const p = this.#view.padding;
    return {
      left: rect.left + (p?.left ?? 0) + EDGE,
      top: rect.top + (p?.top ?? 0) + EDGE,
      right: rect.right - (p?.right ?? 0) - EDGE,
      bottom: rect.bottom - (p?.bottom ?? 0) - EDGE,
    };
  }

  /** The open menu's size: its groups, which fill its panel. */
  #size(): { width: number; height: number } {
    const rects = [...this.#dropdown.children].map((c) => c.getBoundingClientRect());
    if (rects.length === 0) return { width: 0, height: 0 };
    const width = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
    const height = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
    return { width: width + 2, height: height + 2 };
  }

  #group(group: MenuGroup, onPick: (item: MapMenuItem) => void): HTMLCalciteDropdownGroupElement {
    const el = document.createElement("calcite-dropdown-group");
    el.selectionMode = "none";
    if (group.title) el.groupTitle = group.title;
    for (const item of group.items) {
      const entry = document.createElement("calcite-dropdown-item");
      entry.textContent = item.label;
      if (item.icon) entry.iconStart = item.icon as HTMLCalciteDropdownItemElement["iconStart"];
      entry.addEventListener("calciteDropdownItemSelect", () => onPick(item));
      el.append(entry);
    }
    return el;
  }
}
