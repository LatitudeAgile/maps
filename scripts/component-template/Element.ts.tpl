// The {{name}} component, made with npm run new:component. Replace the example content with your
// own; see docs/components/getting-started.md.
//
// What's here:
// - finding the map, in a map corner (inside the map element) or in the sidebar or an expand
//   (where the viewer sets referenceElement), in a 2D map or a 3D scene;
// - following the view with reactiveUtils, and cleaning up when removed;
//#if options
// - the options from config, each set as a property by the viewer;
//#endif
//#if follows
// - knowing when its panel or expand opens and closes;
//#endif
//#if saves
// - keeping a note per app in the browser;
//#endif
// - Calcite components and design tokens only.
import "@esri/calcite-components/components/calcite-block";
//#if saves
import "@esri/calcite-components/components/calcite-input-text";
//#endif
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
{{typeImports}}
import { {{viewerImports}} } from "viewer";

const STYLE = `
  :host { display: block; }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: var(--calcite-spacing-xxs) var(--calcite-spacing-sm); }
  dt { color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  dd { margin: 0; color: var(--calcite-color-text-1); font-size: var(--calcite-font-size--1); overflow-wrap: anywhere; }
//#if saves
  calcite-input-text { margin-block-start: var(--calcite-spacing-md); }
//#endif
`;
//#if saves

/** Where this app's note is kept: viewer:{{name}}:<app>. */
const NOTE_KEY = appStorageKey("{{name}}");
//#endif

export class {{Name}} extends HTMLElement {
  /** Set by the viewer in a sidebar panel or an expand; unset straight in a map corner. */
  referenceElement: ViewElement | string | undefined;
{{optionFields}}
  #rows = new Map<string, HTMLElement>();
  #watch: ResourceHandle | undefined;
  /** Bumped on every connect and disconnect, so a stale async start can tell it's stale. */
  #generation = 0;
//#if saves
  #note: HTMLCalciteInputTextElement;
//#endif

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const block = document.createElement("calcite-block");
    block.heading = "{{headingJs}}";
    block.expanded = true;
    const list = document.createElement("dl");
    // Your code: replace these rows with your component's content.
    this.#row(list, "Scale");
//#if follows
    this.#row(list, "Panel").textContent = "Closed";
//#endif
{{optionRows}}
    block.append(list);
//#if saves
    this.#note = document.createElement("calcite-input-text");
    this.#note.label = "Note";
    this.#note.placeholder = "A note, kept for this app";
    this.#note.value = loadNote();
    this.#note.addEventListener("calciteInputTextInput", () => saveNote(this.#note.value));
    block.append(this.#note);
//#endif
    root.append(style, block);
//#if follows

    // The viewer sends these when the panel or expand holding this element opens and closes.
    // Nothing sends them straight in a map corner, or with placement none.
    this.addEventListener(PANEL_OPEN, () => this.#containerChanged(true));
    this.addEventListener(PANEL_CLOSE, () => this.#containerChanged(false));
//#endif
  }
{{optionAccessors}}
  connectedCallback(): void {
    void this.#follow(++this.#generation);
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#watch?.remove();
    this.#watch = undefined;
  }
//#if follows

  #containerChanged(open: boolean): void {
    this.#rows.get("Panel")!.textContent = open ? "Open" : "Closed";
    // Your code: start work when shown, and pause it or end anything half done when hidden.
  }
//#endif

  /** Find the map, wait for its view, then show its scale as it changes. */
  async #follow(generation: number): Promise<void> {
    const mapElement = this.#findMap();
    if (!mapElement) return;
    await mapElement.viewOnReady();
    // Removed, or removed and added again, while waiting: let the newer start do the work.
    if (generation !== this.#generation) return;
    const view = mapElement.view; // a MapView in 2D, a SceneView in 3D
    this.#watch = reactiveUtils.watch(
      () => view.scale,
      (scale) => {
        this.#rows.get("Scale")!.textContent = `1:${Math.round(scale).toLocaleString("en-US")}`;
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
    list.append(term, value);
    this.#rows.set(label, value);
    return value;
  }
}
//#if options

/** A short text for an option's value. */
function describe(value: unknown): string {
  if (value === undefined) return "(not set)";
  if (Array.isArray(value)) return value.map(describe).join(", ");
  if (typeof value === "object" && value !== null) {
    const { title, name, id } = value as { title?: unknown; name?: unknown; id?: unknown };
    return String(title ?? name ?? id ?? JSON.stringify(value));
  }
  return String(value);
}
//#endif
//#if saves

// Storage can be missing or full, as in a private window: keep working without it.
function loadNote(): string {
  try {
    return globalThis.localStorage?.getItem(NOTE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveNote(text: string): void {
  try {
    globalThis.localStorage?.setItem(NOTE_KEY, text);
  } catch {
    // Not saved: the note lasts until the page is reloaded.
  }
}
//#endif

declare global {
  interface HTMLElementTagNameMap {
    "{{tag}}": {{Name}};
  }
}
