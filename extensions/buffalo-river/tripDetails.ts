// The "Trip details" page of the panel: a date to plan for, the level (for today only), daylight
// and the latest launch, maps of the stretch, the points of interest along it, and directions.
// The element owns the trip; this page keeps only the chosen date. Ported from brokan.xyz/buffalo
// (TripDetails.tsx, TripPointsOfInterest.tsx). See design D7.
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-chip";
import "@esri/calcite-components/components/calcite-chip-group";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-input-date-picker";
import "@esri/calcite-components/components/calcite-link";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import {
  formatDayLabel,
  fromDateInputValue,
  getDateRelation,
  getQuickPickDates,
  getUpcomingWeekendDate,
  isSameDate,
  toDateInputValue,
} from "./dates.ts";
import { POI_ICONS } from "./layers.ts";
import { bandFor } from "./levels.ts";
import { overviewView, stretchView } from "./minimap.ts";
import { describePlace } from "./poiPopup.ts";
import { sunTimes } from "./sun.ts";
import {
  estimateTripDays,
  estimateTripMinutes,
  formatMinutes,
  getAccessPoint,
  PADDLING_HOURS_PER_DAY,
  tripPointsOfInterest,
  type TripPointOfInterest,
} from "./trip.ts";
import { addRow, levelElements, primitiveWarning } from "./tripBlock.ts";

/** What the page shows, besides its own date. */
export interface TripDetailsView {
  putIn: string;
  takeOut: string;
  /** The river distance in miles, or undefined while it's being measured. */
  miles: number | undefined;
  /** The trip's level score at the newest reading, or null when levels are unavailable. */
  levelScore: number | null;
  /** The newest reading's time, when there is one. */
  readingTime: Date | undefined;
}

export const STYLE = `
  .details-title { margin: 0 0 var(--calcite-spacing-md); font-size: var(--calcite-font-size-1); color: var(--calcite-color-text-1); }
  .details-title .arrow { color: var(--calcite-color-text-3); }
  .dates { display: flex; flex-direction: column; gap: var(--calcite-spacing-sm); }
  .muted { color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); margin: var(--calcite-spacing-xxs) 0 0; }
  .daylight { margin: 0; }
  .daylight strong { font-weight: var(--calcite-font-weight-medium); }
  .advice { margin: var(--calcite-spacing-sm) 0 0; }
  .advice.warning { color: var(--calcite-color-status-warning); }
  .maps { display: flex; gap: var(--calcite-spacing-md); align-items: flex-start; }
  .maps figure { margin: 0; }
  .maps .stretch { flex: 1; min-width: 0; }
  .maps .overview { width: 110px; flex: none; text-align: center; }
  .maps svg { width: 100%; height: auto; display: block; }
  .maps figcaption { color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--2); }
  .river-all { fill: none; stroke: var(--calcite-color-border-1); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .river-trip { fill: none; stroke: var(--calcite-color-brand); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .end { fill: var(--calcite-color-foreground-1); stroke: var(--calcite-color-text-1); stroke-width: 1.5; }
  .end-label { fill: var(--calcite-color-text-1); font-size: 13px; font-family: inherit; }
  .poi-icon { width: 22px; height: 22px; }
  .directions { display: grid; grid-template-columns: 1fr auto; gap: var(--calcite-spacing-sm) var(--calcite-spacing-md); align-items: center; margin: 0; }
  .directions dt { margin: 0; color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  .directions dd { margin: 0; overflow-wrap: anywhere; }
  .directions .place { grid-column: 1; }
  .directions calcite-link { grid-column: 2; white-space: nowrap; }
`;

const SVG = "http://www.w3.org/2000/svg";
/** Points of interest shown before "Show all", and how many must be hidden to bother hiding them. */
const COLLAPSED_COUNT = 6;
const MIN_HIDDEN_TO_COLLAPSE = 3;
/** Closer than this, a point is "at the put-in": snapping to the path is less precise than that. */
const AT_PUT_IN_MILES = 0.05;

const formatTime = (date: Date): string => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const formatReading = (date: Date): string => date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const directionsTo = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
const directionsBetween = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}`;

export class TripDetails {
  readonly element: HTMLCalciteFlowItemElement;
  #date = getUpcomingWeekendDate();
  #view: TripDetailsView | undefined;
  #showAllPoints = false;

  constructor() {
    this.element = document.createElement("calcite-flow-item");
    this.element.className = "trip-details";
    this.element.heading = "Trip details";
  }

  /** Shows `view`, keeping the chosen date. */
  render(view: TripDetailsView): void {
    if (this.#view && (this.#view.putIn !== view.putIn || this.#view.takeOut !== view.takeOut)) this.#showAllPoints = false;
    this.#view = view;
    const { putIn, takeOut } = view;
    this.element.description = `${putIn} to ${takeOut}`;
    const parts: HTMLElement[] = [this.#summaryBlock(view), this.#mapBlock(putIn, takeOut)];
    const points = tripPointsOfInterest(putIn, takeOut);
    if (points.length > 0) parts.push(this.#pointsBlock(points));
    parts.push(this.#directionsBlock(putIn, takeOut));
    this.element.replaceChildren(...parts);
  }

  #rerender(): void {
    if (this.#view) this.render(this.#view);
  }

  #summaryBlock(view: TripDetailsView): HTMLCalciteBlockElement {
    const block = blockOf("Plan the day");
    const title = document.createElement("p");
    title.className = "details-title";
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = " → ";
    title.append(view.putIn, arrow, view.takeOut);
    block.append(title);

    const warning = primitiveWarning([view.putIn, view.takeOut]);
    if (warning) block.append(noticeOf("warning", warning));

    block.append(this.#datePicker());

    const facts = document.createElement("dl");
    facts.className = "trip-facts";
    const minutes = view.miles === undefined ? undefined : estimateTripMinutes(view.miles);
    addRow(facts, "Distance", view.miles === undefined ? "Measuring..." : `${view.miles.toFixed(2)} miles`);
    addRow(facts, "Estimated time", minutes === undefined ? "..." : formatMinutes(minutes));
    facts.style.marginBlockStart = "var(--calcite-spacing-md)";
    block.append(facts, paragraph("muted", "Estimated time is at an average paddling speed of 2.5 mph."));

    block.append(...this.#levelPart(view));
    block.append(...this.#daylightPart(minutes));
    return block;
  }

  /** Quick picks for the coming days, and a date picker for any other day. */
  #datePicker(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "dates";
    const label = paragraph("muted", "Planning for");
    const chips = document.createElement("calcite-chip-group");
    chips.label = "Planning for";
    chips.selectionMode = "single";
    for (const pick of getQuickPickDates()) {
      const chip = document.createElement("calcite-chip");
      chip.scale = "s";
      chip.value = toDateInputValue(pick.date);
      chip.label = pick.label;
      chip.textContent = pick.label;
      chip.selected = isSameDate(pick.date, this.#date);
      chips.append(chip);
    }
    chips.addEventListener("calciteChipGroupSelect", () => {
      const chosen = chips.selectedItems[0];
      const date = chosen ? fromDateInputValue(chosen.value as string) : null;
      if (date) this.#setDate(date);
      else this.#rerender(); // a chip can't be cleared: show the chosen date's chip again
    });
    const picker = document.createElement("calcite-input-date-picker");
    picker.label = "Another date";
    picker.scale = "s";
    picker.overlayPositioning = "fixed";
    picker.value = toDateInputValue(this.#date);
    picker.addEventListener("calciteInputDatePickerChange", () => {
      const date = typeof picker.value === "string" ? fromDateInputValue(picker.value) : null;
      if (date) this.#setDate(date);
    });
    wrap.append(label, chips, picker);
    return wrap;
  }

  #setDate(date: Date): void {
    this.#date = date;
    this.#rerender();
  }

  /** The level for today; for any other day, why there isn't one. */
  #levelPart(view: TripDetailsView): HTMLElement[] {
    const heading = paragraph("muted", "Estimated level");
    const relation = getDateRelation(this.#date);
    if (relation === "today") {
      const parts = [heading, ...levelElements(view.levelScore)];
      if (view.levelScore !== null && view.readingTime) parts.push(paragraph("muted", `Based on gauge readings as of ${formatReading(view.readingTime)}.`));
      return parts;
    }
    const day = formatDayLabel(this.#date);
    const title = relation === "future" ? `No water level forecast for ${day}` : `No water level history for ${day}`;
    const message =
      relation === "future"
        ? "Levels are estimated from current gauge readings, so there's no forecast for a future day."
        : "Levels for past days aren't available.";
    const now =
      view.levelScore !== null && view.readingTime
        ? ` Right now the river is running ${bandFor(view.levelScore).label} as of ${formatReading(view.readingTime)}. Check again closer to your trip.`
        : "";
    return [heading, noticeOf("info", message + now, title)];
  }

  /** Sunrise and sunset at the put-in, and when to launch to finish in daylight. */
  #daylightPart(minutes: number | undefined): HTMLElement[] {
    const coord = this.#view ? getAccessPoint(this.#view.putIn)?.coord : undefined;
    if (!coord) return [];
    const { sunrise, sunset } = sunTimes(this.#date, coord.latitude, coord.longitude);
    const day = formatDayLabel(this.#date);
    const daylight = document.createElement("p");
    daylight.className = "daylight";
    daylight.style.marginBlockStart = "var(--calcite-spacing-md)";
    const times = document.createElement("strong");
    times.textContent = sunrise && sunset ? `${formatTime(sunrise)} to ${formatTime(sunset)}` : "not available";
    daylight.append(`Daylight on ${day}: `, times);
    const parts: HTMLElement[] = [daylight];
    if (minutes === undefined || !sunrise || !sunset) return parts;
    const daylightMinutes = (sunset.getTime() - sunrise.getTime()) / 60000;
    if (minutes <= daylightMinutes) {
      const launch = new Date(sunset.getTime() - minutes * 60000);
      const advice = document.createElement("p");
      advice.className = "advice";
      const time = document.createElement("strong");
      time.textContent = formatTime(launch);
      advice.append("Launch by ", time, " to reach the take-out before sunset.");
      parts.push(advice);
    } else {
      const days = estimateTripDays(minutes);
      parts.push(
        paragraph(
          "advice warning",
          `This stretch takes longer than the daylight on ${day} (${formatMinutes(Math.round(daylightMinutes))}). ` +
            `At about ${PADDLING_HOURS_PER_DAY} hours of paddling a day, plan for ${days} ${days === 1 ? "day" : "days"} on the river.`,
        ),
      );
    }
    return parts;
  }

  /** The stretch close up, and where it is on the whole river. */
  #mapBlock(putIn: string, takeOut: string): HTMLCalciteBlockElement {
    const block = blockOf("Map");
    const maps = document.createElement("div");
    maps.className = "maps";

    const zoomed = stretchView(putIn, takeOut);
    const stretch = svgOf(zoomed.width, zoomed.height, `The Buffalo River from ${putIn} to ${takeOut}`);
    stretch.append(
      polyline(zoomed.stretch, "river-trip"),
      endMark(zoomed.putIn, 6, "Put-in"),
      endMark(zoomed.takeOut, 6, "Take-out"),
    );
    const stretchFigure = document.createElement("figure");
    stretchFigure.className = "stretch";
    stretchFigure.append(stretch);

    const whole = overviewView(putIn, takeOut);
    const overview = svgOf(whole.width, whole.height, `The whole Buffalo River, with the stretch from ${putIn} to ${takeOut} marked`);
    overview.append(polyline(whole.river, "river-all"), polyline(whole.stretch, "river-trip"), endMark(whole.putIn, 5), endMark(whole.takeOut, 5));
    const overviewFigure = document.createElement("figure");
    overviewFigure.className = "overview";
    const caption = document.createElement("figcaption");
    caption.textContent = "On the whole river";
    overviewFigure.append(overview, caption);

    maps.append(stretchFigure, overviewFigure);
    block.append(maps);
    return block;
  }

  /** The points of interest in downstream order, the first few until "Show all". */
  #pointsBlock(points: TripPointOfInterest[]): HTMLCalciteBlockElement {
    const block = blockOf("Along the way", `${points.length} ${points.length === 1 ? "point" : "points"} of interest`);
    const collapsible = points.length >= COLLAPSED_COUNT + MIN_HIDDEN_TO_COLLAPSE;
    const shown = collapsible && !this.#showAllPoints ? points.slice(0, COLLAPSED_COUNT) : points;
    const list = document.createElement("calcite-list");
    list.label = "Points of interest along the trip";
    list.selectionMode = "none";
    list.interactionMode = "static";
    for (const poi of shown) {
      const item = document.createElement("calcite-list-item");
      item.label = poi.name;
      item.description = whereOnTrip(poi);
      const icon = document.createElement("img");
      icon.slot = "content-start";
      icon.className = "poi-icon";
      icon.src = POI_ICONS[poi.type];
      icon.alt = "";
      item.append(icon);
      list.append(item);
    }
    block.append(list);
    if (collapsible) {
      const toggle = document.createElement("calcite-button");
      toggle.appearance = "transparent";
      toggle.kind = "neutral";
      toggle.width = "full";
      toggle.textContent = this.#showAllPoints ? "Show fewer" : `Show all ${points.length}`;
      toggle.addEventListener("click", () => {
        this.#showAllPoints = !this.#showAllPoints;
        this.#rerender();
      });
      block.append(toggle);
    }
    return block;
  }

  /** Directions to each end, and for the shuttle from the take-out back to the put-in. */
  #directionsBlock(putIn: string, takeOut: string): HTMLCalciteBlockElement {
    const block = blockOf("Directions");
    const list = document.createElement("dl");
    list.className = "directions";
    const from = getAccessPoint(putIn)?.coord;
    const to = getAccessPoint(takeOut)?.coord;
    if (from) addDirections(list, "Put-in", putIn, directionsTo(from.latitude, from.longitude), "pin");
    if (to) addDirections(list, "Take-out", takeOut, directionsTo(to.latitude, to.longitude), "pin");
    if (from && to) addDirections(list, "Shuttle", "Take-out to put-in", directionsBetween(to, from), "car");
    block.append(list, paragraph("muted", "Leave a car at the take-out before driving to the put-in, so you have a ride back at the end."));
    return block;
  }
}

/** "River left · 3.62 mi · about 1 hr 27 min in", or "At the put-in". */
function whereOnTrip(poi: TripPointOfInterest): string {
  const side = poi.side ? `River ${poi.side}` : null;
  const position =
    poi.milesFromPutIn < AT_PUT_IN_MILES
      ? "At the put-in"
      : `${poi.milesFromPutIn.toFixed(1)} mi · about ${formatMinutes(estimateTripMinutes(poi.milesFromPutIn))} in`;
  return [describePlace({ ...poi, side: undefined }), side, position].filter(Boolean).join(" · ");
}

function addDirections(list: HTMLElement, label: string, place: string, href: string, icon: "pin" | "car"): void {
  const term = document.createElement("dt");
  term.className = "place";
  term.textContent = label;
  const value = document.createElement("dd");
  value.className = "place";
  value.textContent = place;
  const link = document.createElement("calcite-link");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.iconStart = icon;
  link.iconEnd = "launch";
  link.textContent = "Directions";
  link.setAttribute("aria-label", `Directions: ${label}, ${place} (opens Google Maps in a new tab)`);
  // Two rows per place: its label, then its name beside the link.
  const spacer = document.createElement("span");
  list.append(term, spacer, value, link);
}

function blockOf(heading: string, description?: string): HTMLCalciteBlockElement {
  const block = document.createElement("calcite-block");
  block.heading = heading;
  if (description) block.description = description;
  block.expanded = true;
  return block;
}

function noticeOf(kind: "warning" | "info", text: string, title?: string): HTMLCalciteNoticeElement {
  const notice = document.createElement("calcite-notice");
  notice.open = true;
  notice.kind = kind;
  notice.icon = true;
  notice.scale = "s";
  notice.width = "full";
  if (title) {
    const t = document.createElement("div");
    t.slot = "title";
    t.textContent = title;
    notice.append(t);
  }
  const message = document.createElement("div");
  message.slot = "message";
  message.textContent = text;
  notice.append(message);
  return notice;
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

function svgOf(width: number, height: number, label: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  return svg;
}

function polyline(points: string, className: string): SVGPolylineElement {
  const line = document.createElementNS(SVG, "polyline");
  line.setAttribute("points", points);
  line.setAttribute("class", className);
  return line;
}

function endMark([x, y]: [number, number], radius: number, label?: string): SVGGElement {
  const group = document.createElementNS(SVG, "g");
  const circle = document.createElementNS(SVG, "circle");
  circle.setAttribute("cx", x.toFixed(1));
  circle.setAttribute("cy", y.toFixed(1));
  circle.setAttribute("r", String(radius));
  circle.setAttribute("class", "end");
  group.append(circle);
  if (label) {
    const text = document.createElementNS(SVG, "text");
    text.setAttribute("x", x.toFixed(1));
    text.setAttribute("y", (y - 12).toFixed(1));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "end-label");
    text.textContent = label;
    group.append(text);
  }
  return group;
}
