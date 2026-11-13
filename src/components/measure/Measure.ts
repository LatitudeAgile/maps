// The measure component (map-measurements, P-67; add-map-expand-and-components D5, D6). It wraps
// the SDK's measuring components, one per tool, picked for the map element it works on: 2D
// distance and area in arcgis-map, direct-line and area in arcgis-scene. It adds what they lack:
// a switch between the tools, a Clear button for both, and stopping a measurement in progress
// when its panel or expand closes or the user switches tools. A finished measurement stays.
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";
import { findViewElement, type ViewElement } from "../../map/viewElement.ts";
import { PANEL_CLOSE } from "../../sidebar/panelEvents.ts";

import { MEASURE_TOOLS, type MeasureTool, type MeasureUnit } from "./options.ts";

/** The shape the four SDK measuring components share (SDK 5.2). */
type MeasuringElement = HTMLElement & {
  referenceElement: unknown;
  unit: string;
  readonly state: "disabled" | "ready" | "measuring" | "measured" | "unsupported";
  clear(): Promise<void>;
  componentOnReady(): Promise<unknown>;
};

const LABELS: Record<MeasureTool, string> = { distance: "Distance", area: "Area" };

/** Tag and loader for each tool, by the map element's tag. */
const SDK_TOOLS: Record<"arcgis-map" | "arcgis-scene", Record<MeasureTool, { tag: string; load: () => Promise<unknown> }>> = {
  "arcgis-map": {
    distance: { tag: "arcgis-distance-measurement-2d", load: () => import("@arcgis/map-components/components/arcgis-distance-measurement-2d") },
    area: { tag: "arcgis-area-measurement-2d", load: () => import("@arcgis/map-components/components/arcgis-area-measurement-2d") },
  },
  "arcgis-scene": {
    distance: { tag: "arcgis-direct-line-measurement-3d", load: () => import("@arcgis/map-components/components/arcgis-direct-line-measurement-3d") },
    area: { tag: "arcgis-area-measurement-3d", load: () => import("@arcgis/map-components/components/arcgis-area-measurement-3d") },
  },
};

const STYLE = `
  :host { display: block; }
  .measure { display: flex; flex-direction: column; gap: var(--calcite-spacing-sm); padding: var(--calcite-spacing-md); }
  .tools > [hidden] { display: none; }
`;

export class Measure extends HTMLElement {
  /** Set by the component stage in a sidebar panel or an expand; else the map is found as an ancestor. */
  referenceElement: ViewElement | undefined;
  /** The `tools` option, in the order shown. */
  tools: MeasureTool[] = [...MEASURE_TOOLS];
  /** The `unit` option: the unit system the tools start in. */
  unit: MeasureUnit = "imperial";

  #root: ShadowRoot;
  #switch: HTMLCalciteSegmentedControlElement;
  #toolsBox: HTMLElement;
  #clear: HTMLCalciteButtonElement;
  #elements = new Map<MeasureTool, MeasuringElement>();
  #active: MeasureTool | undefined;
  #started = false;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const box = document.createElement("div");
    box.className = "measure";
    this.#switch = document.createElement("calcite-segmented-control");
    this.#switch.width = "full";
    this.#switch.setAttribute("aria-label", "Measuring tool");
    this.#switch.hidden = true;
    this.#switch.addEventListener("calciteSegmentedControlChange", () => void this.#show(this.#switch.value as MeasureTool));
    this.#toolsBox = document.createElement("div");
    this.#toolsBox.className = "tools";
    const actions = document.createElement("div");
    actions.className = "actions";
    this.#clear = document.createElement("calcite-button");
    this.#clear.textContent = "Clear";
    this.#clear.iconStart = "trash";
    this.#clear.appearance = "outline";
    this.#clear.kind = "neutral";
    this.#clear.width = "full";
    this.#clear.disabled = true;
    this.#clear.addEventListener("click", () => void this.#clearAll());
    actions.append(this.#clear);
    box.append(this.#switch, this.#toolsBox, actions);
    this.#root.append(style, box);
    // Closing stops a measurement in progress; a finished one stays (D6). Opening needs nothing.
    this.addEventListener(PANEL_CLOSE, () => void this.#stopInProgress());
  }

  connectedCallback(): void {
    if (this.#started) return;
    this.#started = true;
    void this.#build();
  }

  /** Create one SDK measuring element per tool, for the map element's view (D5). */
  async #build(): Promise<void> {
    const map = this.referenceElement ?? findViewElement(this);
    if (!map) return;
    const kind = map.tagName.toLowerCase() === "arcgis-scene" ? "arcgis-scene" : "arcgis-map";
    const tools = this.tools.length > 0 ? this.tools : [...MEASURE_TOOLS];
    await Promise.all(tools.map((tool) => SDK_TOOLS[kind][tool].load()));
    for (const tool of tools) {
      const element = document.createElement(SDK_TOOLS[kind][tool].tag) as MeasuringElement;
      // In this element's shadow root, closest() can't reach the map element: point at it.
      element.referenceElement = map;
      element.unit = this.unit;
      element.hidden = true;
      element.addEventListener("arcgisPropertyChange", (event) => {
        if ((event as CustomEvent<{ name?: string }>).detail?.name === "state") this.#updateClear();
      });
      this.#toolsBox.append(element);
      this.#elements.set(tool, element);
    }
    if (tools.length > 1) {
      for (const tool of tools) {
        const item = document.createElement("calcite-segmented-control-item");
        item.value = tool;
        item.textContent = LABELS[tool];
        item.checked = tool === tools[0];
        this.#switch.append(item);
      }
      this.#switch.hidden = false;
    }
    await this.#show(tools[0]);
  }

  /** Show one tool. The one left stops a measurement in progress, and keeps a finished one (D6). */
  async #show(tool: MeasureTool): Promise<void> {
    if (tool === this.#active) return;
    const previous = this.#active ? this.#elements.get(this.#active) : undefined;
    this.#active = tool;
    if (previous?.state === "measuring") await previous.clear();
    for (const [name, element] of this.#elements) element.hidden = name !== tool;
  }

  async #stopInProgress(): Promise<void> {
    await Promise.all([...this.#elements.values()].filter((e) => e.state === "measuring").map((e) => e.clear()));
  }

  /** Remove every tool's measurement, and stop one in progress. */
  async #clearAll(): Promise<void> {
    await Promise.all([...this.#elements.values()].map((e) => e.clear()));
    this.#updateClear();
  }

  /** Clear is enabled while any tool has something on the map. */
  #updateClear(): void {
    this.#clear.disabled = ![...this.#elements.values()].some((e) => e.state === "measuring" || e.state === "measured");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-measure": Measure;
  }
}
