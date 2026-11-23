// The Sketch panel (map-sketches): Esri's arcgis-sketch docked in a sidebar panel, with the
// color strip, area fill, notes and saving ported from StewardshipOS (src/mapSketches.ts and
// HouseholdMap.vue there). See add-print-and-sketch-panels design D5 to D10.
import "@arcgis/map-components/components/arcgis-sketch";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-color-picker";
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-popover";
import "@esri/calcite-components/components/calcite-slider";
import "@esri/calcite-components/components/calcite-swatch";
import "@esri/calcite-components/components/calcite-swatch-group";
import "@esri/calcite-components/components/calcite-action";

import type Graphic from "@arcgis/core/Graphic.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import { appStorageKey, PANEL_CLOSE, PANEL_OPEN, requestPanelOpen } from "viewer";
import {
  addColorProblem,
  addCustomColor,
  chosenColor,
  cleanCustomColors,
  DEFAULT_SKETCH_COLORS,
  MAX_CUSTOM_COLORS,
  normalizeHex,
  removeCustomColor,
  type SketchColor,
} from "./palette.ts";
import { EDIT_SKETCH_ACTION_ID, sketchPopupTemplate } from "./popup.ts";
import { areaFillOpacity, setNoteText, sketchKind, sketchSymbol, styleSketch, noteText } from "./symbols.ts";
import { loadPref, loadSketches, PREF_KEYS, savePref, SketchSaver, type StorageLike } from "./storage.ts";

/** The sketch layer's id. */
export const SKETCH_LAYER_ID = "viewer-sketches";

/** Drawing tools (D6). Listing the freehand ones adds a Freehand segment to lines and polygons. */
const CREATE_TOOLS = ["point", "polyline", "freehandPolyline", "polygon", "freehandPolygon", "rectangle", "circle", "text"] as const;
/** Tools that draw: while one is active, clicks draw and popups wait (D7). */
const DRAWING_TOOLS = new Set<string>([...CREATE_TOOLS, "multipoint"]);

const FILL_PRESETS = [
  { label: "None", value: 0 },
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "Solid", value: 100 },
];

/** For this long after a sketch is selected, a popup that opens is closed again (D7). */
const SELECT_POPUP_GUARD_MS = 1000;

type Unit = "imperial" | "metric";
type MapReference = HTMLArcgisMapElement | string | undefined;

/** `localStorage`, reached on each call: reading the property itself can throw (D9). */
const browserStore: StorageLike = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

const STYLE = `
  :host { display: block; }
  .section { display: flex; flex-direction: column; gap: var(--calcite-spacing-xs); padding: var(--calcite-spacing-sm) var(--calcite-spacing-md); }
  .label { font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-3); }
  .colors { display: flex; flex-wrap: wrap; align-items: center; gap: var(--calcite-spacing-xs); }
  .custom { position: relative; display: inline-flex; cursor: pointer; border-radius: var(--calcite-corner-radius-round, 4px); }
  .custom:focus-visible { outline: 2px solid var(--calcite-color-brand); outline-offset: 2px; }
  .custom .remove { position: absolute; inset-block-start: -10px; inset-inline-end: -10px; opacity: 0; }
  .custom:hover .remove, .custom:focus-within .remove { opacity: 1; }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--calcite-spacing-xs); }
  .fill-panel, .add-color-panel { display: flex; flex-direction: column; gap: var(--calcite-spacing-sm); padding: var(--calcite-spacing-sm); min-inline-size: 260px; }
  .fill-track { display: flex; align-items: center; gap: var(--calcite-spacing-sm); }
  .fill-track calcite-slider { flex: 1; }
  .fill-end { font-size: var(--calcite-font-size--2); color: var(--calcite-color-text-3); }
  .presets { display: flex; gap: var(--calcite-spacing-xxs); }
  .footer { display: flex; justify-content: flex-end; gap: var(--calcite-spacing-xs); }
  [hidden] { display: none !important; }
`;

/** Create an element with properties. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") element.className = value as string;
    else (element as unknown as Record<string, unknown>)[key] = value;
  }
  element.append(...children);
  return element;
}

export class SketchPanel extends HTMLElement {
  /** Set by the component stage: the map this panel draws on. */
  referenceElement: MapReference;

  // Options from config (set as properties by the stage).
  #colors: readonly SketchColor[] = DEFAULT_SKETCH_COLORS;
  #fillPercentOption = 0;
  #unit: Unit = "imperial";

  readonly #store = browserStore;
  readonly #key = appStorageKey("sketches");

  // State.
  #customColors: string[] = [];
  #color = DEFAULT_SKETCH_COLORS[0].color;
  #fill = 0; // 0 to 1, for new areas
  #open = false;
  #selected: Graphic[] = [];
  #note: { graphic: Graphic; isNew: boolean } | undefined;
  #pendingEdit: Graphic | undefined;
  #selectedAt = 0;
  #saveFailed = false;
  #restoring = false;
  #started = false;

  // Map pieces.
  #map: HTMLArcgisMapElement | null = null;
  readonly #layer = new GraphicsLayer({ id: SKETCH_LAYER_ID, title: "Sketches", listMode: "show" });
  #saver = new SketchSaver(this.#store, this.#key, () => this.#layer.graphics.toArray(), (ok) => this.#onSaved(ok));

  // UI.
  readonly #sketch: HTMLArcgisSketchElement;
  /** Where the sketch toolbar goes once it is set up. */
  readonly #toolbarSlot: HTMLElement;
  readonly #swatchGroup: HTMLCalciteSwatchGroupElement;
  readonly #customBox: HTMLElement;
  readonly #addColorButton: HTMLCalciteActionElement;
  readonly #addColorPopover: HTMLCalcitePopoverElement;
  readonly #colorPicker: HTMLCalciteColorPickerElement;
  readonly #addColorNotice: HTMLCalciteNoticeElement;
  readonly #addColorConfirm: HTMLCalciteButtonElement;
  readonly #fillButton: HTMLCalciteButtonElement;
  readonly #fillPopover: HTMLCalcitePopoverElement;
  readonly #fillSlider: HTMLCalciteSliderElement;
  readonly #presetButtons: HTMLCalciteButtonElement[];
  readonly #clearSelectionButton: HTMLCalciteButtonElement;
  readonly #editNoteButton: HTMLCalciteButtonElement;
  readonly #clearAllButton: HTMLCalciteButtonElement;
  readonly #saveNotice: HTMLCalciteNoticeElement;
  readonly #noteDialog: HTMLCalciteDialogElement;
  readonly #noteInput: HTMLCalciteInputTextElement;
  readonly #noteConfirm: HTMLCalciteButtonElement;
  readonly #clearDialog: HTMLCalciteDialogElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });

    // No default layer: without this, the component makes its own "Sketch Layer" and adds it to
    // the map as soon as it finds the map, before it is given ours. Attached in #start, once it
    // has our layer and the map.
    this.#sketch = el("arcgis-sketch", { defaultGraphicsLayerDisabled: true });
    this.#toolbarSlot = el("div");

    // Colors: the configured ones in a swatch group, then added ones, then Add a color.
    this.#swatchGroup = el("calcite-swatch-group", { label: "Sketch color", selectionMode: "single-persist" });
    this.#swatchGroup.addEventListener("calciteSwatchGroupSelect", () => {
      const value = [...this.#swatchGroup.querySelectorAll("calcite-swatch")].find((s) => s.selected)?.value;
      if (typeof value === "string" && value !== this.#color) this.#chooseColor(value);
    });
    this.#customBox = el("span", { class: "colors" });
    this.#addColorButton = el("calcite-action", { icon: "plus", text: "Add a color", label: "Add a color", scale: "s" });
    this.#colorPicker = el("calcite-color-picker", { savedDisabled: true, channelsDisabled: true, scale: "s" });
    this.#colorPicker.addEventListener("calciteColorPickerInput", () => this.#renderAddColor());
    this.#addColorNotice = el("calcite-notice", { kind: "warning", scale: "s", open: false });
    this.#addColorNotice.append(el("div", { slot: "message" }));
    this.#addColorConfirm = el("calcite-button", { scale: "s" }, "Add");
    this.#addColorConfirm.addEventListener("click", () => this.#addColor());
    const addColorCancel = el("calcite-button", { scale: "s", appearance: "outline" }, "Cancel");
    addColorCancel.addEventListener("click", () => (this.#addColorPopover.open = false));
    this.#addColorPopover = el(
      "calcite-popover",
      { label: "Add a color", heading: "Add a color", referenceElement: this.#addColorButton, autoClose: true, overlayPositioning: "fixed", scale: "s", placement: "bottom-start" },
      el("div", { class: "add-color-panel" }, this.#colorPicker, this.#addColorNotice, el("div", { class: "footer" }, addColorCancel, this.#addColorConfirm)),
    );
    this.#addColorPopover.dataset.popover = "add-color";
    this.#addColorPopover.addEventListener("calcitePopoverBeforeOpen", () => {
      this.#colorPicker.value = this.#color;
      this.#renderAddColor();
    });

    // Area fill: a button showing the fill, opening a slider with presets.
    this.#fillButton = el("calcite-button", { iconStart: "paint-bucket", appearance: "outline", scale: "s", kind: "neutral" });
    this.#fillSlider = el("calcite-slider", { min: 0, max: 100, step: 5, label: "Area fill opacity", labelHandles: true });
    this.#fillSlider.addEventListener("calciteSliderInput", () => this.#setFill(Number(this.#fillSlider.value) / 100));
    this.#presetButtons = FILL_PRESETS.map((preset) => {
      const button = el("calcite-button", { scale: "s", appearance: "outline" }, preset.label);
      button.dataset.value = String(preset.value);
      button.addEventListener("click", () => this.#setFill(preset.value / 100));
      return button;
    });
    this.#fillPopover = el(
      "calcite-popover",
      { label: "Area fill", referenceElement: this.#fillButton, autoClose: true, overlayPositioning: "fixed", scale: "s", placement: "bottom-start" },
      el(
        "div",
        { class: "fill-panel" },
        el("div", { class: "fill-track" }, el("span", { class: "fill-end" }, "None"), this.#fillSlider, el("span", { class: "fill-end" }, "Solid")),
        el("div", { class: "presets" }, ...this.#presetButtons),
      ),
    );

    this.#fillPopover.dataset.popover = "fill";

    // Contextual actions.
    this.#clearSelectionButton = el("calcite-button", { iconStart: "clear-selection", appearance: "outline", scale: "s", kind: "neutral" }, "Clear selection");
    this.#clearSelectionButton.addEventListener("click", () => void this.#clearSelection());
    this.#editNoteButton = el("calcite-button", { iconStart: "notepad-edit", appearance: "outline", scale: "s", kind: "neutral" }, "Edit note");
    this.#editNoteButton.addEventListener("click", () => {
      const note = this.#selectedNote();
      if (note) this.#openNoteDialog(note, false);
    });
    this.#clearAllButton = el("calcite-button", { iconStart: "erase", appearance: "outline", scale: "s", kind: "danger" }, "Clear all");
    this.#clearAllButton.addEventListener("click", () => (this.#clearDialog.open = true));

    this.#saveNotice = el("calcite-notice", { kind: "danger", icon: "exclamation-mark-triangle", scale: "s", open: false });
    this.#saveNotice.append(el("div", { slot: "message" }, "The latest changes to your sketches weren't saved. This browser's storage for the viewer may be full or blocked."));

    // The note's text: the text tool only places the note.
    this.#noteInput = el("calcite-input-text", { label: "Note" });
    this.#noteInput.addEventListener("calciteInputTextInput", () => this.#renderNoteDialog());
    this.#noteInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.#closeNoteDialog(true);
    });
    this.#noteConfirm = el("calcite-button", { slot: "footer-end" }, "Add");
    this.#noteConfirm.addEventListener("click", () => this.#closeNoteDialog(true));
    const noteCancel = el("calcite-button", { slot: "footer-end", appearance: "outline" }, "Cancel");
    noteCancel.addEventListener("click", () => this.#closeNoteDialog(false));
    this.#noteDialog = el("calcite-dialog", { modal: true, widthScale: "s", heading: "Add a note" }, el("calcite-label", {}, "Note", this.#noteInput), noteCancel, this.#noteConfirm);
    this.#noteDialog.addEventListener("calciteDialogOpen", () => void this.#noteInput.setFocus());
    // Escape or the close button: as Cancel.
    this.#noteDialog.addEventListener("calciteDialogClose", () => this.#closeNoteDialog(false));

    const clearCancel = el("calcite-button", { slot: "footer-end", appearance: "outline" }, "Cancel");
    clearCancel.addEventListener("click", () => (this.#clearDialog.open = false));
    const clearConfirm = el("calcite-button", { slot: "footer-end", kind: "danger" }, "Clear all");
    clearConfirm.addEventListener("click", () => this.#clearAll());
    this.#clearDialog = el(
      "calcite-dialog",
      { modal: true, widthScale: "s", heading: "Clear all sketches?" },
      "All of your sketches will be deleted from the map and from this browser. They can't be brought back.",
      clearCancel,
      clearConfirm,
    );

    const style = el("style");
    style.textContent = STYLE;
    root.append(
      style,
      this.#toolbarSlot,
      el("div", { class: "section" }, el("span", { class: "label" }, "Color"), el("div", { class: "colors" }, this.#swatchGroup, this.#customBox, this.#addColorButton)),
      el("div", { class: "section" }, el("span", { class: "label" }, "Areas"), el("div", { class: "buttons" }, this.#fillButton)),
      el("div", { class: "section" }, el("div", { class: "buttons" }, this.#clearSelectionButton, this.#editNoteButton, this.#clearAllButton), this.#saveNotice),
      this.#addColorPopover,
      this.#fillPopover,
      this.#noteDialog,
      this.#clearDialog,
    );

    this.addEventListener(PANEL_OPEN, () => this.#setOpen(true));
    this.addEventListener(PANEL_CLOSE, () => void this.#setOpen(false));
  }

  // --- Options ---

  /** The `colors` option: the strip's colors (D5). */
  get colors(): readonly SketchColor[] {
    return this.#colors;
  }
  set colors(value: readonly SketchColor[]) {
    this.#colors = value.length > 0 ? value : DEFAULT_SKETCH_COLORS;
    if (this.#started) this.#loadPrefs();
  }

  /** The `fillPercent` option: new areas' fill until the user changes it (D9). */
  get fillPercent(): number {
    return this.#fillPercentOption;
  }
  set fillPercent(value: number) {
    this.#fillPercentOption = value;
    if (this.#started) this.#loadPrefs();
  }

  /** The `unit` option: measurement units in the drawing tooltips (D10). */
  get unit(): Unit {
    return this.#unit;
  }
  set unit(value: Unit) {
    this.#unit = value;
    this.#applyUnits();
  }

  /** The sketch layer, for the app. */
  get layer(): GraphicsLayer {
    return this.#layer;
  }

  connectedCallback(): void {
    if (this.#started) return;
    this.#started = true;
    void this.#start();
  }

  // --- Setup (D6) ---

  async #start(): Promise<void> {
    this.#loadPrefs();
    const map = this.#findMap();
    if (!map) return;
    this.#map = map;
    await map.viewOnReady();

    // Every sketch gets its popup, however it arrives: restored, drawn, duplicated, undone.
    const template = sketchPopupTemplate(() => this.#colors);
    this.#layer.graphics.on("after-add", (event: { item: Graphic }) => {
      event.item.popupTemplate = template;
    });
    this.#layer.graphics.on("change", () => {
      this.#renderContext();
      if (!this.#restoring) this.#saver.saveSoon();
    });
    map.map?.add(this.#layer);
    this.#restoring = true;
    this.#layer.addMany(loadSketches(this.#store, this.#key));
    this.#restoring = false;
    // A save still waiting when the page goes away.
    window.addEventListener("pagehide", () => this.#saver.flush());

    const sketch = this.#sketch;
    Object.assign(sketch, {
      referenceElement: map,
      layer: this.#layer,
      defaultGraphicsLayerDisabled: true,
      toolbarKind: "docked",
      creationMode: "single",
      availableCreateTools: [...CREATE_TOOLS],
      showCreateToolsFreehandPolyline: true,
      showCreateToolsFreehandPolygon: true,
      showCreateToolsText: true,
      hideCreateToolsMultipoint: true,
      hideSelectionToolsRectangleSelection: true,
      hideLabelsToggle: true,
      hideSnappingControlsElementsFeatureEnabledToggle: true,
      hideSnappingControlsElementsLayerList: true,
      hideSnappingControlsElementsGridEnabledToggle: true,
      hideSnappingControlsElementsGridControls: true,
      updateOnGraphicClickDisabled: !this.#open,
    });
    this.#applySymbols();
    this.#toolbarSlot.append(sketch);
    sketch.addEventListener("arcgisCreate", (event) => this.#onCreate(event.detail as { state: string; graphic?: Graphic | null }));
    sketch.addEventListener("arcgisUpdate", (event) => this.#onUpdate(event.detail as { state: string }));
    sketch.addEventListener("arcgisDelete", () => this.#updateSelection());
    sketch.addEventListener("arcgisUndo", () => this.#changed());
    sketch.addEventListener("arcgisRedo", () => this.#changed());
    sketch.addEventListener("arcgisDuplicate", () => this.#changed());
    sketch.addEventListener("arcgisPropertyChange", () => this.#updateDrawing());
    await sketch.componentOnReady();
    this.#applyUnits();

    // Edit sketch, from a sketch's popup (D7). The popup's events bubble out of the map element.
    map.addEventListener("arcgisTriggerAction", (event) => {
      const id = (event as CustomEvent<{ action?: { id?: string } }>).detail?.action?.id;
      if (id === EDIT_SKETCH_ACTION_ID) void this.#editFromPopup();
    });
    // Selecting a sketch would also open the popup of what lies under it (D7).
    map.addEventListener("arcgisPropertyChange", (event) => {
      const source = event.composedPath()[0] as (Element & { open?: boolean }) | undefined;
      if (source?.tagName !== "ARCGIS-POPUP" || !source.open) return;
      if (Date.now() - this.#selectedAt < SELECT_POPUP_GUARD_MS) void map.closePopup();
    });
    this.#render();
  }

  #findMap(): HTMLArcgisMapElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as HTMLArcgisMapElement | null;
    return ref ?? this.closest("arcgis-map");
  }

  /** The remembered color, added colors and fill, checked against the configured colors. */
  #loadPrefs(): void {
    this.#customColors = cleanCustomColors(loadPref(this.#store, PREF_KEYS.customColors), this.#colors);
    this.#color = chosenColor(loadPref(this.#store, PREF_KEYS.color), this.#colors, this.#customColors);
    const savedFill = loadPref(this.#store, PREF_KEYS.fillPercent);
    const percent = typeof savedFill === "number" && savedFill >= 0 && savedFill <= 100 ? savedFill : this.#fillPercentOption;
    this.#fill = percent / 100;
    this.#applySymbols();
    this.#render();
  }

  /** New sketches' symbols, as new instances, as the sketch component asks. */
  #applySymbols(): void {
    Object.assign(this.#sketch, {
      pointSymbol: sketchSymbol("point", this.#color),
      polylineSymbol: sketchSymbol("polyline", this.#color),
      polygonSymbol: sketchSymbol("polygon", this.#color, "", this.#fill),
      textSymbol: sketchSymbol("text", this.#color),
    });
  }

  /** Measurements in feet and miles, or meters and kilometers (D10). */
  #applyUnits(): void {
    const units = this.#unit;
    try {
      (this.#sketch as unknown as { valueOptions: unknown }).valueOptions = { displayUnits: { length: units, area: units, verticalLength: units } };
    } catch {
      // the SDK's default units, then
    }
  }

  // --- Open and close (D7) ---

  async #setOpen(open: boolean): Promise<void> {
    this.#open = open;
    const sketch = this.#sketch;
    if (open) {
      this.#layer.visible = true;
      sketch.updateOnGraphicClickDisabled = false;
      const pending = this.#pendingEdit;
      this.#pendingEdit = undefined;
      if (pending) await this.#select(pending);
      return;
    }
    this.#addColorPopover.open = false;
    this.#fillPopover.open = false;
    sketch.updateOnGraphicClickDisabled = true;
    if (sketch.state === "active") {
      // A sketch being drawn is discarded; an edit is kept and the selection ends.
      if (this.#creating()) await sketch.cancel();
      else await sketch.complete();
    }
    this.#setPopupsWaiting(false);
    this.#updateSelection();
  }

  #creating(): boolean {
    const tool = this.#sketch.activeTool;
    return typeof tool === "string" && DRAWING_TOOLS.has(tool);
  }

  /** Popups wait while a drawing tool is active (D7). */
  #updateDrawing(): void {
    this.#setPopupsWaiting(this.#open && this.#creating());
  }

  #setPopupsWaiting(waiting: boolean): void {
    const map = this.#map;
    if (!map || map.popupDisabled === waiting) return;
    if (waiting) void map.closePopup();
    map.popupDisabled = waiting;
  }

  // --- Sketch events ---

  #onCreate(detail: { state: string; graphic?: Graphic | null }): void {
    this.#updateDrawing();
    const { state, graphic } = detail;
    if (state !== "complete" || !graphic) return;
    // The tool drew it in the chosen color; the color and fill go on the graphic too, so it can
    // be recolored and restored.
    styleSketch(graphic, { color: this.#color, fillOpacity: this.#fill }, this.#colors[0].color);
    this.#changed();
    if (sketchKind(graphic) === "text") this.#openNoteDialog(graphic, true);
  }

  #onUpdate(detail: { state: string }): void {
    if (detail.state === "start") {
      this.#selectedAt = Date.now();
      void this.#map?.closePopup();
    }
    this.#updateSelection();
    this.#changed();
  }

  #changed(): void {
    if (!this.#restoring) this.#saver.saveSoon();
  }

  #updateSelection(): void {
    this.#selected = this.#sketch.updateGraphics?.toArray() ?? [];
    this.#renderFill();
    this.#renderContext();
  }

  #selectedNote(): Graphic | undefined {
    return this.#selected.length === 1 && sketchKind(this.#selected[0]) === "text" ? this.#selected[0] : undefined;
  }

  async #select(graphic: Graphic): Promise<void> {
    if (!this.#layer.graphics.includes(graphic)) return;
    await this.#sketch.componentOnReady();
    await this.#sketch.triggerUpdate(graphic);
    this.#selectedAt = Date.now();
    this.#updateSelection();
  }

  /** Clear selection: deselect, as Escape does. */
  async #clearSelection(): Promise<void> {
    await this.#sketch.complete();
    this.#updateSelection();
  }

  /** Edit sketch from a popup: close it, open the panel, select the sketch (D7). */
  async #editFromPopup(): Promise<void> {
    const map = this.#map;
    const graphic = (map?.popupElement as { selectedFeature?: Graphic | null } | null | undefined)?.selectedFeature;
    if (!map || !graphic || !this.#layer.graphics.includes(graphic)) return;
    void map.closePopup();
    if (this.#open) {
      await this.#select(graphic);
    } else {
      this.#pendingEdit = graphic;
      requestPanelOpen(this);
    }
  }

  // --- Colors ---

  /** New sketches get the color, and so do the selected ones. */
  #chooseColor(hex: string): void {
    this.#color = hex;
    savePref(this.#store, PREF_KEYS.color, hex);
    this.#applySymbols();
    for (const graphic of this.#selected) styleSketch(graphic, { color: hex }, this.#colors[0].color);
    if (this.#selected.length > 0) this.#changed();
    this.#renderColors();
  }

  #addColor(): void {
    const value = String(this.#colorPicker.value ?? "");
    if (addColorProblem(value, this.#colors, this.#customColors)) return;
    this.#customColors = addCustomColor(value, this.#colors, this.#customColors);
    savePref(this.#store, PREF_KEYS.customColors, this.#customColors);
    this.#addColorPopover.open = false;
    this.#chooseColor(normalizeHex(value)!);
  }

  /** Take an added color off the strip; sketches drawn in it keep it. */
  #removeColor(hex: string): void {
    this.#customColors = removeCustomColor(hex, this.#customColors);
    savePref(this.#store, PREF_KEYS.customColors, this.#customColors);
    if (this.#color === hex) {
      this.#color = this.#colors[0].color;
      savePref(this.#store, PREF_KEYS.color, this.#color);
      this.#applySymbols();
    }
    this.#renderColors();
  }

  // --- Area fill ---

  /** The fill new areas get and, as the slider moves, the selected areas' fill. */
  #setFill(opacity: number): void {
    this.#fill = Math.min(1, Math.max(0, Math.round(opacity * 100) / 100));
    savePref(this.#store, PREF_KEYS.fillPercent, Math.round(this.#fill * 100));
    this.#applySymbols();
    const areas = this.#selected.filter((g) => sketchKind(g) === "polygon");
    for (const graphic of areas) styleSketch(graphic, { fillOpacity: this.#fill }, this.#colors[0].color);
    if (areas.length > 0) this.#changed();
    this.#renderFill();
  }

  /** What Area fill shows: the selected areas' fill when any is selected, else new areas'. */
  #fillShown(): { percent: number; mixed: boolean; min: number; max: number } {
    const percents = this.#selected.filter((g) => sketchKind(g) === "polygon").map((g) => Math.round(areaFillOpacity(g) * 100));
    if (percents.length === 0) {
      const percent = Math.round(this.#fill * 100);
      return { percent, mixed: false, min: percent, max: percent };
    }
    const min = Math.min(...percents);
    const max = Math.max(...percents);
    return { percent: percents[0], mixed: min !== max, min, max };
  }

  // --- Notes ---

  #openNoteDialog(graphic: Graphic, isNew: boolean): void {
    this.#note = { graphic, isNew };
    this.#noteInput.value = isNew ? "" : noteText(graphic);
    this.#noteDialog.heading = isNew ? "Add a note" : "Edit note";
    this.#noteConfirm.textContent = isNew ? "Add" : "Save";
    this.#renderNoteDialog();
    this.#noteDialog.open = true;
  }

  /** Add or Save needs text. Cancelling a new note removes it, so no empty notes are left. */
  #closeNoteDialog(save: boolean): void {
    const note = this.#note;
    if (!note) return;
    const text = (this.#noteInput.value ?? "").trim();
    if (save && !text) return;
    this.#note = undefined;
    this.#noteDialog.open = false;
    if (save) setNoteText(note.graphic, text, this.#colors[0].color);
    else if (note.isNew) this.#layer.remove(note.graphic);
    this.#changed();
    this.#updateSelection();
  }

  // --- Clear all ---

  #clearAll(): void {
    this.#clearDialog.open = false;
    void this.#sketch.cancel();
    this.#restoring = true; // not a change to save: the key is removed below
    this.#layer.removeAll();
    this.#restoring = false;
    this.#saver.clear();
    this.#updateSelection();
  }

  #onSaved(ok: boolean): void {
    this.#saveFailed = !ok;
    this.#saveNotice.open = this.#saveFailed;
  }

  // --- Rendering ---

  #render(): void {
    this.#renderColors();
    this.#renderFill();
    this.#renderContext();
  }

  /** The color lists last drawn, so choosing a color only moves the selection (keeps focus). */
  #drawnColors = "";

  #renderColors(): void {
    const drawn = JSON.stringify([this.#colors, this.#customColors]);
    if (drawn === this.#drawnColors) {
      for (const swatch of this.#swatchGroup.querySelectorAll("calcite-swatch")) swatch.selected = swatch.value === this.#color;
      for (const wrapper of this.#customBox.querySelectorAll<HTMLElement>(".custom")) {
        const chosen = wrapper.dataset.color === this.#color;
        wrapper.querySelector("calcite-swatch")!.selected = chosen;
        wrapper.setAttribute("aria-pressed", String(chosen));
      }
      return;
    }
    this.#drawnColors = drawn;
    this.#swatchGroup.replaceChildren(
      ...this.#colors.map((c) => el("calcite-swatch", { color: c.color, label: c.name, value: c.color, selected: c.color === this.#color })),
    );
    this.#customBox.replaceChildren(
      ...this.#customColors.map((hex) => {
        const swatch = el("calcite-swatch", { color: hex, label: `Custom color ${hex}`, value: hex, selected: hex === this.#color, tabIndex: -1 });
        const remove = el("calcite-action", { class: "remove", icon: "x", text: `Remove custom color ${hex}`, label: `Remove custom color ${hex}`, scale: "s" });
        remove.title = "Remove this color (sketches drawn in it keep it)";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          this.#removeColor(hex);
        });
        const wrapper = el("span", { class: "custom", tabIndex: 0, title: `Custom color ${hex}` }, swatch, remove);
        wrapper.setAttribute("role", "button");
        wrapper.setAttribute("aria-label", `Custom color ${hex}`);
        wrapper.setAttribute("aria-pressed", String(hex === this.#color));
        wrapper.dataset.color = hex;
        wrapper.addEventListener("click", () => this.#chooseColor(hex));
        wrapper.addEventListener("keydown", (event) => {
          if (event.target !== wrapper || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          this.#chooseColor(hex);
        });
        return wrapper;
      }),
    );
    const full = this.#customColors.length >= MAX_CUSTOM_COLORS;
    this.#addColorButton.disabled = full;
    this.#addColorButton.title = full ? `Up to ${MAX_CUSTOM_COLORS} added colors: remove one to add another` : "Add a color";
  }

  #renderAddColor(): void {
    const problem = addColorProblem(String(this.#colorPicker.value ?? ""), this.#colors, this.#customColors);
    this.#addColorNotice.open = !!problem;
    this.#addColorNotice.querySelector('[slot="message"]')!.textContent = problem ?? "";
    this.#addColorConfirm.disabled = !!problem;
  }

  #renderFill(): void {
    const shown = this.#fillShown();
    const label = `Area fill: ${shown.mixed ? "mixed" : `${shown.percent}%`}`;
    this.#fillButton.textContent = label;
    this.#fillButton.title = label;
    this.#fillPopover.heading = shown.mixed ? `Area fill: mixed (${shown.min}–${shown.max}%)` : label;
    this.#fillSlider.value = shown.percent;
    for (const button of this.#presetButtons) {
      button.appearance = !shown.mixed && Number(button.dataset.value) === shown.percent ? "solid" : "outline";
    }
  }

  #renderContext(): void {
    this.#clearSelectionButton.hidden = this.#selected.length === 0;
    this.#editNoteButton.hidden = !this.#selectedNote();
    this.#clearAllButton.disabled = this.#layer.graphics.length === 0;
  }

  #renderNoteDialog(): void {
    this.#noteConfirm.disabled = !(this.#noteInput.value ?? "").trim();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-sketch": SketchPanel;
  }
}
