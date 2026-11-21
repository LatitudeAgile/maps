// The detail flow item for one library entry (design D8): its name, notes and color, which the
// user can change, its stats, and Zoom to, Download and Delete. The element owns the entry; this
// only renders it and reports what the user did.
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-swatch";
import "@esri/calcite-components/components/calcite-swatch-group";
import "@esri/calcite-components/components/calcite-text-area";
import { formatDate, formatDistance, formatDuration, formatHeight, type Units } from "./format.ts";
import type { LibraryEntry } from "./library.ts";
import { PALETTE } from "./palette.ts";

export const STYLE = `
  .details { display: flex; flex-direction: column; gap: var(--calcite-spacing-md); padding: var(--calcite-spacing-md); }
  .details calcite-label { --calcite-label-margin-bottom: 0; }
  .stats { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: var(--calcite-spacing-xxs) var(--calcite-spacing-md); }
  .stats dt { color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  .stats dd { margin: 0; color: var(--calcite-color-text-1); font-size: var(--calcite-font-size--1); font-variant-numeric: tabular-nums; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--calcite-spacing-sm); }
`;

/** How long to wait after the last keystroke in Notes before saving them. */
const NOTES_DELAY_MS = 600;

export interface DetailsHandlers {
  rename(name: string): void;
  setNotes(notes: string): void;
  setColor(color: string): void;
  zoom(): void;
  download(): void;
  delete(): void;
}

export class TrackDetails {
  readonly element: HTMLCalciteFlowItemElement;
  readonly id: string;
  #handlers: DetailsHandlers;
  #name: HTMLCalciteInputTextElement;
  #notes: HTMLCalciteTextAreaElement;
  #swatches: HTMLCalciteSwatchGroupElement;
  #stats: HTMLElement;
  #notesTimer: ReturnType<typeof setTimeout> | undefined;
  #savedName = "";
  #savedNotes = "";

  constructor(id: string, handlers: DetailsHandlers) {
    this.id = id;
    this.#handlers = handlers;
    const item = document.createElement("calcite-flow-item");
    this.element = item;
    const body = document.createElement("div");
    body.className = "details";

    this.#name = document.createElement("calcite-input-text");
    this.#name.addEventListener("calciteInputTextChange", () => {
      const name = this.#name.value.trim();
      // A cleared name keeps the previous one.
      if (!name) this.#name.value = this.#savedName;
      else if (name !== this.#savedName) {
        this.#savedName = name;
        handlers.rename(name);
      }
    });

    this.#notes = document.createElement("calcite-text-area");
    this.#notes.rows = 4;
    this.#notes.resize = "vertical";
    this.#notes.placeholder = "Notes for yourself";
    this.#notes.addEventListener("calciteTextAreaInput", () => {
      clearTimeout(this.#notesTimer);
      this.#notesTimer = setTimeout(() => this.flushNotes(), NOTES_DELAY_MS);
    });
    this.#notes.addEventListener("calciteTextAreaChange", () => this.flushNotes());

    this.#swatches = document.createElement("calcite-swatch-group");
    this.#swatches.label = "Color";
    this.#swatches.selectionMode = "single-persist";
    for (const { color, label } of PALETTE) {
      const swatch = document.createElement("calcite-swatch");
      swatch.color = color;
      swatch.value = color;
      swatch.label = label;
      this.#swatches.append(swatch);
    }
    this.#swatches.addEventListener("calciteSwatchGroupSelect", () => {
      const color = this.#swatches.selectedItems[0]?.value as string | undefined;
      if (color) handlers.setColor(color);
    });

    this.#stats = document.createElement("dl");
    this.#stats.className = "stats";

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      button("zoom-to-object", "Zoom to", "outline", () => handlers.zoom()),
      button("download", "Download", "outline", () => handlers.download()),
      button("trash", "Delete", "outline", () => this.#confirmDelete(), "danger"),
    );

    body.append(labelled("Name", this.#name), labelled("Notes", this.#notes), labelled("Color", this.#swatches), this.#stats, actions);
    item.append(body);
  }

  render(entry: LibraryEntry, units: Units): void {
    this.element.heading = entry.name;
    this.element.description = entry.fileName;
    this.#savedName = entry.name;
    this.#savedNotes = entry.notes;
    // Don't overwrite what the user is typing.
    if (this.#name.value !== entry.name && !this.#name.matches(":focus-within")) this.#name.value = entry.name;
    if (this.#notesTimer === undefined && this.#notes.value !== entry.notes && !this.#notes.matches(":focus-within")) this.#notes.value = entry.notes;
    for (const swatch of this.#swatches.querySelectorAll("calcite-swatch")) swatch.selected = swatch.value === entry.color;
    this.#renderStats(entry, units);
  }

  /** Saves notes typed but not yet saved, as when the panel closes. */
  flushNotes(): void {
    clearTimeout(this.#notesTimer);
    this.#notesTimer = undefined;
    const notes = this.#notes.value;
    if (notes === this.#savedNotes) return;
    this.#savedNotes = notes;
    this.#handlers.setNotes(notes);
  }

  #renderStats(entry: LibraryEntry, units: Units): void {
    const { stats } = entry;
    const rows: [string, string][] = [];
    if (stats.distance !== undefined) rows.push(["Distance", formatDistance(stats.distance, units)]);
    if (stats.gain !== undefined && stats.loss !== undefined) {
      rows.push(["Elevation gain", formatHeight(stats.gain, units)]);
      rows.push(["Elevation loss", formatHeight(stats.loss, units)]);
    }
    if (stats.start !== undefined) rows.push(["Date", formatDate(stats.start)]);
    if (stats.duration !== undefined) rows.push(["Duration", formatDuration(stats.duration)]);
    if (stats.moving !== undefined) rows.push(["Moving time", formatDuration(stats.moving)]);
    if (stats.lines) rows.push([stats.lines === 1 ? "Line" : "Lines", String(stats.lines)]);
    if (stats.waypoints) rows.push([stats.waypoints === 1 ? "Waypoint" : "Waypoints", String(stats.waypoints)]);
    this.#stats.replaceChildren(
      ...rows.flatMap(([term, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }

  /** Asks before deleting. The dialog goes on document.body, so it covers the whole page. */
  #confirmDelete(): void {
    const dialog = document.createElement("calcite-dialog");
    dialog.heading = `Delete "${this.#savedName}"?`;
    dialog.modal = true;
    dialog.widthScale = "s";
    const message = document.createElement("p");
    message.style.margin = "0";
    message.textContent = "It's removed from the library in every app. This can't be undone.";
    dialog.append(message);
    const cancel = button(undefined, "Cancel", "outline", () => close());
    cancel.slot = "footer-end";
    const confirm = button("trash", "Delete", "solid", () => {
      close();
      this.#handlers.delete();
    }, "danger");
    confirm.slot = "footer-end";
    dialog.append(cancel, confirm);
    const close = () => {
      dialog.open = false;
      dialog.remove();
    };
    dialog.addEventListener("calciteDialogClose", () => dialog.remove());
    document.body.append(dialog);
    dialog.open = true;
  }
}

function labelled(text: string, control: HTMLElement): HTMLCalciteLabelElement {
  const label = document.createElement("calcite-label");
  label.textContent = text;
  label.append(control);
  return label;
}

function button(
  icon: string | undefined,
  text: string,
  appearance: HTMLCalciteButtonElement["appearance"],
  onClick: () => void,
  kind: HTMLCalciteButtonElement["kind"] = "neutral",
): HTMLCalciteButtonElement {
  const element = document.createElement("calcite-button");
  if (icon) element.iconStart = icon as HTMLCalciteButtonElement["iconStart"];
  element.appearance = appearance;
  element.kind = kind;
  element.scale = "s";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}
