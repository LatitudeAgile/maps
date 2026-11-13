// The hello-world component: a template for your own component types. Copy this folder, rename
// it, and change the names inside it; nothing outside the folder needs an edit. See
// docs/components/getting-started.md.
//
// What it shows:
// - an option from config (`greeting`), set as a property by the component stage;
// - finding the map, in a 2D map (arcgis-map) or a 3D scene (arcgis-scene), whether placed in a
//   map corner (inside the map element) or in the sidebar (where the stage sets
//   `referenceElement` to the map element);
// - following the view live with reactiveUtils, and cleaning up when removed;
// - Calcite components and design tokens only.
import "@esri/calcite-components/components/calcite-block";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { findViewElement, type ViewElement } from "viewer";
import { formatCenter, formatScale } from "./format.ts";

/** The map element (arcgis-map or arcgis-scene), or its id, that a component in the sidebar works on. */
type MapReference = ViewElement | string | undefined;

const STYLE = `
  :host { display: block; }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: var(--calcite-spacing-xxs) var(--calcite-spacing-sm); }
  dt { color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  dd { margin: 0; color: var(--calcite-color-text-1); font-size: var(--calcite-font-size--1); font-variant-numeric: tabular-nums; }
`;

export class HelloWorld extends HTMLElement {
  /** Set by the component stage for sidebar panels; unset in a map corner. */
  referenceElement: MapReference;

  #greeting = "Hello, world";
  #block: HTMLCalciteBlockElement;
  #center: HTMLElement;
  #scale: HTMLElement;
  #watch: ResourceHandle | undefined;
  /** Bumped on every connect and disconnect, so a stale async start can tell it's stale. */
  #generation = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.#block = document.createElement("calcite-block");
    this.#block.heading = this.#greeting;
    this.#block.expanded = true;
    const list = document.createElement("dl");
    this.#center = this.#row(list, "Center");
    this.#scale = this.#row(list, "Scale");
    this.#block.append(list);
    root.append(style, this.#block);
  }

  /** The `greeting` option from config. */
  get greeting(): string {
    return this.#greeting;
  }
  set greeting(value: string) {
    this.#greeting = value;
    this.#block.heading = value;
  }

  connectedCallback(): void {
    void this.#follow(++this.#generation);
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#watch?.remove();
    this.#watch = undefined;
  }

  /** Find the map, wait for its view, then show the center and scale as they change. */
  async #follow(generation: number): Promise<void> {
    const mapElement = this.#findMap();
    if (!mapElement) return;
    await mapElement.viewOnReady();
    // Removed (or re-added) while waiting: let the newer start do the work.
    if (generation !== this.#generation) return;
    const view = mapElement.view;
    this.#watch = reactiveUtils.watch(
      () => [view.center, view.scale] as const,
      ([center, scale]) => {
        this.#center.textContent = formatCenter(center.longitude ?? NaN, center.latitude ?? NaN);
        this.#scale.textContent = formatScale(scale);
      },
      { initial: true },
    );
  }

  #findMap(): ViewElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as ViewElement | null;
    return ref ?? findViewElement(this);
  }

  #row(list: HTMLElement, label: string): HTMLElement {
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    value.dataset.value = label.toLowerCase();
    list.append(term, value);
    return value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-hello-world": HelloWorld;
  }
}
