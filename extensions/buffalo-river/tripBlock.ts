// The panel's "Trip" block: the trip picked on the map, its distance, paddling time and level, a
// warning for a primitive access, and the way into Trip details. The element owns the trip; this
// only shows it. Ported from brokan.xyz/buffalo (TripDiv.tsx, PrimitiveAccessWarning.tsx).
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-notice";
import { bandFor } from "./levels.ts";
import { AVERAGE_PADDLING_SPEED_MPH, estimateTripMinutes, formatMinutes, isPrimitiveAccessPoint } from "./trip.ts";

/** What the block shows. */
export interface TripView {
  /** The picked access points: none, the first, or [put-in, take-out]. */
  points: readonly string[];
  /** The river distance in miles, or undefined while it's being measured. */
  miles: number | undefined;
  /** The trip's level score at the newest reading, or null when levels are unavailable. */
  levelScore: number | null;
}

export const STYLE = `
  .trip-prompt { margin: 0; color: var(--calcite-color-text-3); }
  .trip-ends { display: grid; grid-template-columns: auto 1fr; gap: var(--calcite-spacing-xxs) var(--calcite-spacing-sm); margin: 0 0 var(--calcite-spacing-md); }
  .trip-ends dt, .trip-facts dt { color: var(--calcite-color-text-3); }
  .trip-ends dd, .trip-facts dd { margin: 0; color: var(--calcite-color-text-1); overflow-wrap: anywhere; }
  .trip-facts { display: grid; grid-template-columns: auto 1fr; gap: var(--calcite-spacing-xxs) var(--calcite-spacing-sm); margin: 0; }
  .trip-facts dd { font-variant-numeric: tabular-nums; }
  .trip-note { margin: var(--calcite-spacing-xxs) 0 var(--calcite-spacing-md); color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  .level { display: flex; align-items: center; gap: var(--calcite-spacing-sm); }
  .swatch { width: 14px; height: 14px; border-radius: 3px; flex: none; border: 1px solid var(--calcite-color-border-1); }
  .guidance { margin: var(--calcite-spacing-xxs) 0 var(--calcite-spacing-md); color: var(--calcite-color-text-2); font-size: var(--calcite-font-size--1); }
  .trip-block calcite-notice { margin-block-end: var(--calcite-spacing-md); }
  .trip-block calcite-button { display: block; }
`;

/** "Dixon Ford is a primitive access", or both names; null when neither end is primitive. */
export function primitiveWarning(points: readonly string[]): string | null {
  const primitive = points.filter(isPrimitiveAccessPoint);
  if (primitive.length === 0) return null;
  const subject = primitive.length === 1 ? `${primitive[0]} is a primitive access` : `${primitive.join(" and ")} are primitive accesses`;
  return `${subject}. Expect an unimproved road, limited parking and no facilities. A high-clearance vehicle may be needed, especially after rain.`;
}

/** A level band as a swatch, its name and its guidance; or a line saying levels are unavailable. */
export function levelElements(score: number | null): HTMLElement[] {
  const line = document.createElement("div");
  line.className = "level";
  if (score === null) {
    line.textContent = "Unavailable";
    return [line];
  }
  const band = bandFor(score);
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = band.color;
  const name = document.createElement("span");
  name.textContent = band.label;
  line.append(swatch, name);
  const guidance = document.createElement("p");
  guidance.className = "guidance";
  guidance.textContent = band.guidance;
  return [line, guidance];
}

export class TripBlock {
  readonly element: HTMLCalciteBlockElement;
  #body: HTMLElement;
  #clear: HTMLCalciteActionElement;

  constructor(onClear: () => void, onDetails: () => void) {
    this.element = document.createElement("calcite-block");
    this.element.className = "trip-block";
    this.element.heading = "Trip";
    this.element.description = "Click two access points on the map";
    this.element.expanded = true;
    this.#clear = document.createElement("calcite-action");
    this.#clear.slot = "actions-end";
    this.#clear.icon = "x";
    this.#clear.text = "Clear the trip";
    this.#clear.addEventListener("click", onClear);
    this.#body = document.createElement("div");
    this.element.append(this.#clear, this.#body);
    this.#onDetails = onDetails;
  }

  #onDetails: () => void;

  render(view: TripView): void {
    const { points } = view;
    this.#clear.hidden = points.length === 0;
    const parts: HTMLElement[] = [];
    if (points.length === 0) {
      parts.push(paragraph("trip-prompt", "Click an access point on the map to start a trip, then click another to finish it."));
    } else {
      parts.push(ends(points));
      const warning = primitiveWarning(points);
      if (warning) parts.push(notice(warning));
      if (points.length === 1) {
        parts.push(paragraph("trip-prompt", "Select another access point."));
      } else {
        parts.push(...this.#facts(view));
      }
    }
    this.#body.replaceChildren(...parts);
  }

  #facts(view: TripView): HTMLElement[] {
    const facts = document.createElement("dl");
    facts.className = "trip-facts";
    const minutes = view.miles === undefined ? undefined : estimateTripMinutes(view.miles);
    addRow(facts, "Distance", view.miles === undefined ? "Measuring..." : `${view.miles.toFixed(2)} miles`);
    addRow(facts, "Estimated time", minutes === undefined ? "..." : formatMinutes(minutes));
    const note = paragraph(
      "trip-note",
      `At an average paddling speed of ${AVERAGE_PADDLING_SPEED_MPH} mph. Actual time varies with the water level, the current and stops along the way.`,
    );
    const levelTitle = document.createElement("div");
    levelTitle.className = "trip-note";
    levelTitle.style.margin = "0 0 var(--calcite-spacing-xxs)";
    levelTitle.textContent = "Level now, averaged over the trip";
    const details = document.createElement("calcite-button");
    details.width = "full";
    details.appearance = "outline";
    details.iconEnd = "chevron-right";
    details.textContent = "Trip details";
    details.addEventListener("click", () => this.#onDetails());
    return [facts, note, levelTitle, ...levelElements(view.levelScore), details];
  }
}

function ends(points: readonly string[]): HTMLElement {
  const list = document.createElement("dl");
  list.className = "trip-ends";
  if (points.length === 1) {
    addRow(list, "First point", points[0]);
  } else {
    addRow(list, "Put-in", points[0]);
    addRow(list, "Take-out", points[1]);
  }
  return list;
}

function notice(text: string): HTMLCalciteNoticeElement {
  const element = document.createElement("calcite-notice");
  element.open = true;
  element.kind = "warning";
  element.icon = true;
  element.scale = "s";
  element.width = "full";
  const message = document.createElement("div");
  message.slot = "message";
  message.textContent = text;
  element.append(message);
  return element;
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

export function addRow(list: HTMLElement, term: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}
