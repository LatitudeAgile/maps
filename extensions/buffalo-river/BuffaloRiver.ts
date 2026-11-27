// The buffalo-river component: the Buffalo River in Arkansas, coloured by an estimated floating
// level from live USGS gauges, with float-trip planning between its access points. Ported from
// brokan.xyz/buffalo with its author's permission. See README.md, and design.md in the
// add-buffalo-river-sample change.
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-flow";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-slider";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { ClickEvent } from "@arcgis/core/views/input/types.js";
import { findViewElement, PANEL_CLOSE, requestPanelOpen, type ViewElement } from "viewer";
import { RiverLayers } from "./layers.ts";
import { LevelKey, STYLE as KEY_STYLE } from "./levelKey.ts";
import { loadReadings, type Reading } from "./levels.ts";
import * as storage from "./storage.ts";
import { orderDownstream, tripDistanceMiles, tripLevelScore, tripStretch } from "./trip.ts";
import { STYLE as TRIP_STYLE, TripBlock } from "./tripBlock.ts";
import { STYLE as DETAILS_STYLE, TripDetails } from "./tripDetails.ts";
import { showSafetyWarning } from "./warning.ts";

const STYLE = `
  :host { display: block; }
  calcite-flow { height: auto; }
  .reading { display: flex; align-items: center; gap: var(--calcite-spacing-sm); margin: 0 0 var(--calcite-spacing-sm); }
  .reading-time { color: var(--calcite-color-text-1); font-weight: var(--calcite-font-weight-medium); font-variant-numeric: tabular-nums; }
  .reading-label { color: var(--calcite-color-text-3); }
  .reading calcite-action { margin-inline-start: auto; }
  .player { display: flex; align-items: center; gap: var(--calcite-spacing-xxs); }
  .player calcite-slider { flex: 1; min-width: 0; }
  .note { margin: var(--calcite-spacing-sm) 0 0; color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  calcite-notice { margin-block-end: var(--calcite-spacing-md); }
  [hidden] { display: none !important; }
  ${KEY_STYLE}
  ${TRIP_STYLE}
  ${DETAILS_STYLE}
`;

/** Wait after the last slider move before redrawing the river (design D4). */
const REDRAW_DELAY_MS = 500;
/** Pause between playback steps, after each redraw has finished. */
const PLAY_STEP_DELAY_MS = 400;

const formatReadingTime = (time: Date): string => time.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

type LoadState = "loading" | "ready" | "failed";

export class BuffaloRiver extends HTMLElement {
  /** Set by the viewer in a sidebar panel. */
  referenceElement: ViewElement | string | undefined;

  #layers: RiverLayers | undefined;
  /** Bumped on every connect and disconnect, so a stale async start can tell it's stale. */
  #generation = 0;
  /** Aborts the readings request in flight, on disconnect or a newer load. */
  #loadAbort: AbortController | undefined;
  #state: LoadState = "loading";
  /** The readings, oldest first; empty until loaded, or when loading failed. */
  #readings: Reading[] = [];
  /** The reading the slider shows. */
  #readingIndex = 0;
  /** The reading the river was last drawn for, or -1. */
  #drawnIndex = -1;
  #redrawTimer: ReturnType<typeof setTimeout> | undefined;
  #playTimer: ReturnType<typeof setTimeout> | undefined;
  #playing = false;
  #redrawing = false;
  /** What's kept per app in the browser. */
  #saved = storage.load();
  /** The trip's access points: none, the first picked, or [put-in, take-out]. */
  #trip: string[] = [];
  /** The trip's river distance, once measured. */
  #tripMiles: number | undefined;
  /** Bumped on every trip change, so a late distance can tell it's stale. */
  #tripRequest = 0;
  #tripBlock: TripBlock;
  #levelKey = new LevelKey();
  #clickHandle: ResourceHandle | undefined;
  #flow: HTMLCalciteFlowElement;
  #home: HTMLCalciteFlowItemElement;
  /** The Trip details page while it's shown. */
  #details: TripDetails | undefined;
  /** Removes the safety warning while it's shown. */
  #removeWarning: (() => void) | undefined;

  // Elements.
  #failure: HTMLCalciteNoticeElement;
  #levelsBlock: HTMLCalciteBlockElement;
  #readingTime: HTMLElement;
  #readingLoader: HTMLCalciteLoaderElement;
  #refresh: HTMLCalciteActionElement;
  #play: HTMLCalciteActionElement;
  #previous: HTMLCalciteActionElement;
  #next: HTMLCalciteActionElement;
  #slider: HTMLCalciteSliderElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;

    const flow = document.createElement("calcite-flow");
    const home = document.createElement("calcite-flow-item");
    home.selected = true;
    this.#flow = flow;
    this.#home = home;

    this.#failure = this.#buildFailureNotice();
    this.#levelsBlock = document.createElement("calcite-block");
    this.#levelsBlock.heading = "River levels";
    this.#levelsBlock.description = "Estimated from five USGS river gauges";
    this.#levelsBlock.expanded = true;

    const reading = document.createElement("div");
    reading.className = "reading";
    const label = document.createElement("span");
    label.className = "reading-label";
    label.textContent = "As of";
    this.#readingTime = document.createElement("span");
    this.#readingTime.className = "reading-time";
    this.#readingLoader = document.createElement("calcite-loader");
    this.#readingLoader.inline = true;
    this.#readingLoader.scale = "s";
    this.#readingLoader.label = "Drawing the river";
    this.#refresh = this.#action("refresh", "Refresh the readings", () => void this.#load());
    reading.append(label, this.#readingTime, this.#readingLoader, this.#refresh);

    const player = document.createElement("div");
    player.className = "player";
    this.#play = this.#action("play", "Play", () => this.#togglePlay());
    this.#previous = this.#action("chevron-left", "Previous reading", () => this.#step(-1));
    this.#next = this.#action("chevron-right", "Next reading", () => this.#step(1));
    this.#slider = document.createElement("calcite-slider");
    this.#slider.label = "Reading time";
    this.#slider.min = 0;
    this.#slider.step = 1;
    this.#slider.snap = true;
    this.#slider.addEventListener("calciteSliderInput", () => {
      this.#stopPlaying();
      this.#select(this.#slider.value as number);
    });
    player.append(this.#play, this.#previous, this.#slider, this.#next);

    const note = document.createElement("p");
    note.className = "note";
    note.textContent =
      "Levels are estimates from gauge readings and may differ from the river. Check conditions yourself before going on the water.";
    this.#levelsBlock.append(reading, player, this.#levelKey.element, note);

    this.#tripBlock = new TripBlock(
      () => this.#setTrip([]),
      () => this.#openTripDetails(),
    );
    home.append(this.#failure, this.#levelsBlock, this.#tripBlock.element);
    flow.append(home);
    root.append(style, flow);

    // Closing the panel pauses playback; the slider keeps its place (design D7).
    this.addEventListener(PANEL_CLOSE, () => this.#stopPlaying());
    this.#render();
  }

  connectedCallback(): void {
    void this.#start(++this.#generation);
    // Once per app in this browser, until acknowledged (design D8).
    if (!this.#saved.warningAcknowledged && !this.#removeWarning) {
      this.#removeWarning = showSafetyWarning(() => {
        this.#removeWarning = undefined;
        this.#saved.warningAcknowledged = true;
        storage.save(this.#saved);
      });
    }
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#removeWarning?.();
    this.#removeWarning = undefined;
    this.#loadAbort?.abort();
    this.#loadAbort = undefined;
    this.#stopPlaying();
    clearTimeout(this.#redrawTimer);
    this.#redrawTimer = undefined;
    this.#clickHandle?.remove();
    this.#clickHandle = undefined;
    this.#layers?.destroy();
    this.#layers = undefined;
    this.#drawnIndex = -1;
  }

  /** Find the scene, wait for its view, then add the river and load its levels. */
  async #start(generation: number): Promise<void> {
    const mapElement = this.#findMap();
    if (!mapElement) return;
    await mapElement.viewOnReady();
    if (generation !== this.#generation) return;
    // The manifest allows only 3D, so the view is a SceneView.
    const view = mapElement.view as SceneView;
    const layers = new RiverLayers(view);
    this.#layers = layers;
    this.#clickHandle = view.on("click", (event) => void this.#onMapClick(view, layers, event));
    // Added again after a removal: show the trip it still has.
    this.#setTrip(this.#trip);
    await this.#load();
  }

  /** A click on an access point adds it to the trip (design D6); any other click is ignored. */
  async #onMapClick(view: SceneView, layers: RiverLayers, event: ClickEvent): Promise<void> {
    const hit = await view.hitTest(event, { include: [layers.access] });
    if (layers !== this.#layers) return;
    const result = hit.results.find((r) => r.type === "graphic");
    const name = result?.type === "graphic" ? (result.graphic.attributes?.Name as string | undefined) : undefined;
    if (!name) return;
    requestPanelOpen(this);
    if (this.#trip.length === 1) {
      // The same point twice isn't a trip: wait for a different one.
      if (name !== this.#trip[0]) this.#setTrip(orderDownstream(this.#trip[0], name));
    } else {
      this.#setTrip([name]);
    }
  }

  /** Shows `points` as the trip, on the map and in the panel, and measures it when complete. */
  #setTrip(points: string[]): void {
    const request = ++this.#tripRequest;
    // Trip details belong to the trip they were opened for.
    if (points !== this.#trip) this.#closeTripDetails();
    this.#trip = points;
    this.#tripMiles = undefined;
    void this.#layers?.highlightAccessPoints(points);
    this.#layers?.setStretch(points.length === 2 ? tripStretch(points[0], points[1]) : null);
    this.#renderTrip();
    if (points.length === 2) {
      void tripDistanceMiles(points[0], points[1]).then((miles) => {
        if (request !== this.#tripRequest) return;
        this.#tripMiles = miles;
        this.#renderTrip();
      });
    }
  }

  /** The trip's level at the newest reading, or null without readings or a complete trip. */
  #tripLevel(): number | null {
    const newest = this.#readings.at(-1);
    if (this.#state !== "ready" || !newest || this.#trip.length !== 2) return null;
    return tripLevelScore(newest.scores, this.#trip[0], this.#trip[1]);
  }

  #renderTrip(): void {
    const levelScore = this.#tripLevel();
    this.#tripBlock.render({ points: this.#trip, miles: this.#tripMiles, levelScore });
    this.#levelKey.render({ tripScore: levelScore });
    if (this.#details && this.#trip.length === 2) {
      this.#details.render({
        putIn: this.#trip[0],
        takeOut: this.#trip[1],
        miles: this.#tripMiles,
        levelScore,
        readingTime: this.#state === "ready" ? this.#readings.at(-1)?.time : undefined,
      });
    }
  }

  /**
   * Shows Trip details over the panel's home page. Calcite 5.2's flow shows each item marked
   * `selected`, and its back button only moves that mark, so the page is removed on Back (as the
   * Apps panel does).
   */
  #openTripDetails(): void {
    if (this.#trip.length !== 2 || this.#details) return;
    const details = new TripDetails();
    this.#details = details;
    details.element.addEventListener("calciteFlowItemBack", () => requestAnimationFrame(() => this.#closeTripDetails()));
    this.#renderTrip();
    this.#home.selected = false;
    details.element.selected = true;
    this.#flow.append(details.element);
    // The panel keeps its scroll position, which was down at the Trip block: start at the top,
    // where the page's heading and Back button are.
    requestAnimationFrame(() => this.#flow.scrollIntoView({ block: "start" }));
  }

  #closeTripDetails(): void {
    if (!this.#details) return;
    this.#details.element.remove();
    this.#details = undefined;
    this.#home.selected = true;
  }

  /** Fetches the readings and draws the river at the newest one. */
  async #load(): Promise<void> {
    this.#loadAbort?.abort();
    const abort = new AbortController();
    this.#loadAbort = abort;
    this.#stopPlaying();
    this.#state = "loading";
    this.#render();
    try {
      const readings = await loadReadings(abort.signal);
      if (abort.signal.aborted) return;
      this.#readings = readings;
      this.#state = "ready";
      this.#drawnIndex = -1;
      this.#select(readings.length - 1, true);
      this.#renderTrip();
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn("[buffalo-river] Couldn't load the USGS readings:", error);
      this.#readings = [];
      this.#state = "failed";
      this.#drawnIndex = -1;
      this.#render();
      this.#renderTrip();
      await this.#layers?.setLevels(null);
    } finally {
      if (this.#loadAbort === abort) this.#loadAbort = undefined;
    }
  }

  /** Shows reading `index`, and redraws the river for it after a pause, or at once. */
  #select(index: number, immediate = false): void {
    if (this.#state !== "ready") return;
    this.#readingIndex = Math.max(0, Math.min(this.#readings.length - 1, index));
    clearTimeout(this.#redrawTimer);
    this.#redrawTimer = setTimeout(() => void this.#redraw(), immediate ? 0 : REDRAW_DELAY_MS);
    this.#render();
  }

  /** Draws the river for the selected reading; when playing, schedules the next step after it. */
  async #redraw(): Promise<void> {
    this.#redrawTimer = undefined;
    const index = this.#readingIndex;
    const layers = this.#layers;
    if (!layers || this.#state !== "ready") return;
    if (index !== this.#drawnIndex) {
      this.#redrawing = true;
      this.#render();
      try {
        await layers.setLevels(this.#readings[index].scores);
        this.#drawnIndex = index;
      } finally {
        this.#redrawing = false;
      }
    }
    // A newer selection came in while drawing: its own redraw takes over.
    if (this.#redrawTimer !== undefined || this.#readingIndex !== index) return;
    this.#render();
    if (this.#playing) this.#playTimer = setTimeout(() => this.#playStep(), PLAY_STEP_DELAY_MS);
  }

  #step(delta: number): void {
    this.#stopPlaying();
    this.#select(this.#readingIndex + delta);
  }

  #togglePlay(): void {
    if (this.#playing) {
      this.#stopPlaying();
      return;
    }
    this.#playing = true;
    // From the end, start again from the oldest reading.
    if (this.#readingIndex >= this.#readings.length - 1) this.#select(0, true);
    else this.#playStep();
    this.#render();
  }

  #playStep(): void {
    this.#playTimer = undefined;
    if (!this.#playing) return;
    if (this.#readingIndex >= this.#readings.length - 1) {
      this.#stopPlaying();
      return;
    }
    this.#select(this.#readingIndex + 1, true);
  }

  #stopPlaying(): void {
    if (!this.#playing && this.#playTimer === undefined) return;
    this.#playing = false;
    clearTimeout(this.#playTimer);
    this.#playTimer = undefined;
    this.#render();
  }

  /** Brings the panel's controls in line with the state. */
  #render(): void {
    const ready = this.#state === "ready";
    const count = this.#readings.length;
    this.#failure.open = this.#state === "failed";
    this.#failure.hidden = this.#state !== "failed";
    this.#levelsBlock.loading = this.#state === "loading";
    this.#levelKey.render({ visible: ready });
    this.#refresh.disabled = this.#state === "loading";
    this.#readingTime.textContent = ready ? formatReadingTime(this.#readings[this.#readingIndex].time) : this.#state === "loading" ? "Loading..." : "Unavailable";
    this.#readingLoader.hidden = !(ready && (this.#redrawing || this.#readingIndex !== this.#drawnIndex));
    this.#slider.disabled = !ready;
    this.#slider.max = Math.max(1, count - 1);
    this.#slider.value = ready ? this.#readingIndex : 0;
    this.#play.disabled = !ready;
    this.#play.icon = this.#playing ? "pause" : "play";
    this.#play.text = this.#playing ? "Pause" : "Play";
    this.#previous.disabled = !ready || this.#readingIndex <= 0;
    this.#next.disabled = !ready || this.#readingIndex >= count - 1;
  }

  #buildFailureNotice(): HTMLCalciteNoticeElement {
    const notice = document.createElement("calcite-notice");
    notice.kind = "warning";
    notice.icon = true;
    notice.width = "full";
    const title = document.createElement("div");
    title.slot = "title";
    title.textContent = "River levels are unavailable";
    const message = document.createElement("div");
    message.slot = "message";
    message.textContent = "The USGS gauge readings couldn't be loaded. Access points, points of interest and trips still work.";
    const retry = document.createElement("calcite-button");
    retry.slot = "actions-end";
    retry.appearance = "transparent";
    retry.kind = "neutral";
    retry.iconStart = "refresh";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => void this.#load());
    notice.append(title, message, retry);
    return notice;
  }

  #action(icon: HTMLCalciteActionElement["icon"], text: string, onClick: () => void): HTMLCalciteActionElement {
    const action = document.createElement("calcite-action");
    action.icon = icon;
    action.text = text;
    action.scale = "s";
    action.addEventListener("click", onClick);
    return action;
  }

  #findMap(): ViewElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as ViewElement | null;
    return ref ?? findViewElement(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-buffalo-river": BuffaloRiver;
  }
}
