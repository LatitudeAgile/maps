// The tracks component: a library of GPX files from the user's device, kept in the browser for
// every app, with any number of them on the map in 2D or 3D. See README.md, and design.md in the
// add-tracks-extension change.
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-flow";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import Extent from "@arcgis/core/geometry/Extent.js";
import Point from "@arcgis/core/geometry/Point.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { findViewElement, PANEL_CLOSE, type ViewElement } from "viewer";
import { STYLE as DETAILS_STYLE, TrackDetails } from "./details.ts";
import { formatSummary, type Units } from "./format.ts";
import { bounds, GpxError, parseGpx, type GpxData } from "./gpx.ts";
import { contentHash } from "./hash.ts";
import { TrackLayers } from "./layers.ts";
import { Library, type LibraryEntry } from "./library.ts";
import { nextColor } from "./palette.ts";
import { computeStats, STATS_VERSION } from "./stats.ts";
import { loadVisible, saveVisible } from "./visibility.ts";

const STYLE = `
  :host { display: block; }
  calcite-flow { height: auto; }
  .top { display: flex; flex-direction: column; gap: var(--calcite-spacing-md); padding: var(--calcite-spacing-md); }
  .top:empty { display: none; }
  .hint { margin: 0; color: var(--calcite-color-text-3); font-size: var(--calcite-font-size--1); }
  .swatch { inline-size: 14px; block-size: 14px; border-radius: 50%; flex: none; margin-inline: var(--calcite-spacing-xxs);
    border: 1px solid var(--calcite-color-border-1); }
  calcite-notice ul { margin: 0; padding-inline-start: var(--calcite-spacing-lg); }
  [hidden] { display: none !important; }
  ${DETAILS_STYLE}
`;

/** A lone waypoint is shown at this scale. */
const POINT_SCALE = 24_000;
/** How much room to leave around tracks when going to them. */
const EXTENT_PADDING = 1.2;

export class Tracks extends HTMLElement {
  /** Set by the viewer in a sidebar panel. */
  referenceElement: ViewElement | string | undefined;

  #units: Units = "imperial";
  /** Bumped on every connect and disconnect, so a stale async step can tell it's stale. */
  #generation = 0;
  /** Opened once, on first connect. */
  #libraryPromise: Promise<Library> | undefined;
  #library: Library | undefined;
  /** Which entries are on in this app. */
  #visible = loadVisible();
  /** Parsed files, by entry id: an entry is parsed when first drawn or zoomed to. */
  #parsed = new Map<string, GpxData>();
  #view: MapView | SceneView | undefined;
  #layers: TrackLayers | undefined;
  #items = new Map<string, HTMLCalciteListItemElement>();
  #details: TrackDetails | undefined;
  #problemsNotice: HTMLCalciteNoticeElement | undefined;
  #storageNotice: HTMLCalciteNoticeElement | undefined;

  // Elements.
  #flow: HTMLCalciteFlowElement;
  #home: HTMLCalciteFlowItemElement;
  #notices: HTMLElement;
  #hint: HTMLElement;
  #list: HTMLCalciteListElement;
  #input: HTMLInputElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;

    this.#flow = document.createElement("calcite-flow");
    this.#home = document.createElement("calcite-flow-item");
    this.#home.selected = true;

    const top = document.createElement("div");
    top.className = "top";
    this.#input = document.createElement("input");
    this.#input.type = "file";
    this.#input.accept = ".gpx,application/gpx+xml";
    this.#input.multiple = true;
    this.#input.hidden = true;
    this.#input.addEventListener("change", () => {
      const files = Array.from(this.#input.files ?? []);
      // Cleared, so choosing the same file again still fires change.
      this.#input.value = "";
      if (files.length) void this.#openFiles(files);
    });
    const open = document.createElement("calcite-button");
    open.iconStart = "upload";
    open.width = "full";
    open.textContent = "Open GPX files";
    open.addEventListener("click", () => this.#input.click());
    this.#notices = document.createElement("div");
    this.#notices.className = "top";
    this.#notices.style.padding = "0";
    this.#hint = document.createElement("p");
    this.#hint.className = "hint";
    this.#hint.textContent =
      "Open GPX files from your device to see them on the map. They're kept in this browser for every app, and never uploaded.";
    top.append(this.#input, open, this.#notices, this.#hint);

    this.#list = document.createElement("calcite-list");
    this.#list.label = "Tracks";
    this.#list.selectionMode = "multiple";
    this.#list.selectionAppearance = "icon";
    this.#list.addEventListener("calciteListChange", () => {
      for (const [id, item] of this.#items) if (item.selected !== this.#visible.has(id)) this.#setVisible(id, item.selected);
    });

    this.#home.append(top, this.#list);
    this.#flow.append(this.#home);
    root.append(style, this.#flow);

    // Notes typed just before the panel closes are kept (design D8).
    this.addEventListener(PANEL_CLOSE, () => this.#details?.flushNotes());
  }

  /** The `units` option. The viewer sets it from config. */
  get units(): Units {
    return this.#units;
  }
  set units(value: Units | undefined) {
    this.#units = value ?? "imperial";
    this.#render();
  }

  connectedCallback(): void {
    void this.#start(++this.#generation);
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#details?.flushNotes();
    this.#layers?.destroy();
    this.#layers = undefined;
    this.#view = undefined;
  }

  /** Opens the library and lists it, then finds the map and draws the entries that are on. */
  async #start(generation: number): Promise<void> {
    const library = await this.#openLibrary();
    if (generation !== this.#generation) return;
    this.#render();
    const mapElement = this.#findMap();
    if (!mapElement) return;
    await mapElement.viewOnReady();
    if (generation !== this.#generation) return;
    this.#view = mapElement.view;
    this.#layers = new TrackLayers(mapElement.view);
    // Entries deleted elsewhere are dropped from this app's checkboxes.
    const stale = [...this.#visible].filter((id) => !library.get(id));
    if (stale.length) {
      for (const id of stale) this.#visible.delete(id);
      saveVisible(this.#visible);
    }
    // Oldest first, so the newest ends up on top.
    for (const entry of library.list().reverse()) if (this.#visible.has(entry.id)) this.#ensureLayer(entry);
  }

  async #openLibrary(): Promise<Library> {
    this.#libraryPromise ??= Library.open().then(async (library) => {
      this.#library = library;
      // Stats from an older version of the calculations are worked out again.
      for (const entry of library.list()) {
        if (entry.statsVersion === STATS_VERSION) continue;
        const data = this.#parse(entry);
        if (data) await library.put({ ...entry, stats: computeStats(data), statsVersion: STATS_VERSION });
      }
      this.#checkStorage();
      return library;
    });
    return this.#libraryPromise;
  }

  /** Reads, checks and adds the files the user chose, then shows them (design D8). */
  async #openFiles(files: File[]): Promise<void> {
    const generation = this.#generation;
    const library = await this.#openLibrary();
    const added: LibraryEntry[] = [];
    const problems: string[] = [];
    const now = Date.now();
    for (const [i, file] of files.entries()) {
      let text: string;
      try {
        text = await file.text();
      } catch {
        problems.push(`${file.name} couldn't be read.`);
        continue;
      }
      // Removed while reading: the map isn't changed afterwards.
      if (generation !== this.#generation) return;
      let data: GpxData;
      try {
        data = parseGpx(text);
      } catch (error) {
        problems.push(
          error instanceof GpxError && error.reason === "empty"
            ? `${file.name} has no tracks, routes or waypoints to show.`
            : `${file.name} couldn't be read: it isn't a GPX file.`,
        );
        continue;
      }
      const hash = contentHash(text);
      const existing = library.list().find((entry) => entry.hash === hash);
      if (existing) {
        problems.push(`${file.name} is already in the library, as "${existing.name}".`);
        continue;
      }
      const entry: LibraryEntry = {
        id: newId(),
        fileName: file.name,
        text,
        hash,
        name: data.name ?? data.firstLineName ?? file.name.replace(/\.gpx$/i, ""),
        notes: "",
        color: nextColor(library.list().map((e) => e.color)),
        // In the order chosen, so the last file chosen is the newest.
        addedAt: now + i,
        stats: computeStats(data),
        statsVersion: STATS_VERSION,
      };
      this.#parsed.set(entry.id, data);
      await library.put(entry);
      if (generation !== this.#generation) return;
      added.push(entry);
      this.#visible.add(entry.id);
    }

    if (added.length) saveVisible(this.#visible);
    for (const entry of added) this.#ensureLayer(entry);
    this.#render();
    this.#showProblems(problems);
    this.#checkStorage();
    if (added.length) this.#goTo(added.map((entry) => entry.id));
  }

  /** Builds an entry's layers if the map is ready and they aren't built yet. */
  #ensureLayer(entry: LibraryEntry): void {
    const layers = this.#layers;
    if (!layers || layers.has(entry.id)) return;
    const data = this.#parse(entry);
    if (!data) return;
    layers.add(entry.id, entry.name, entry.color, data, this.#visible.has(entry.id), (visible) => this.#onLayerVisible(entry.id, visible));
  }

  #parse(entry: LibraryEntry): GpxData | undefined {
    let data = this.#parsed.get(entry.id);
    if (!data) {
      try {
        data = parseGpx(entry.text);
      } catch (error) {
        console.warn(`[tracks] "${entry.name}" can't be read:`, error);
        return undefined;
      }
      this.#parsed.set(entry.id, data);
    }
    return data;
  }

  /** Turns an entry on or off from the panel. */
  #setVisible(id: string, visible: boolean): void {
    const entry = this.#library?.get(id);
    if (!entry) return;
    if (visible) this.#visible.add(id);
    else this.#visible.delete(id);
    saveVisible(this.#visible);
    if (visible) this.#ensureLayer(entry);
    this.#layers?.setVisible(id, visible);
    this.#renderItem(entry);
  }

  /** An entry's layer was shown or hidden, from the panel or the layer list. */
  #onLayerVisible(id: string, visible: boolean): void {
    if (visible === this.#visible.has(id)) return;
    this.#setVisible(id, visible);
  }

  /** Turns the entries on, and goes to them. */
  #zoomTo(ids: string[]): void {
    for (const id of ids) if (!this.#visible.has(id)) this.#setVisible(id, true);
    this.#goTo(ids);
  }

  #goTo(ids: string[]): void {
    const view = this.#view;
    if (!view) return;
    let [xmin, ymin, xmax, ymax] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
      const entry = this.#library?.get(id);
      const data = entry && this.#parse(entry);
      if (!data) continue;
      const [x0, y0, x1, y1] = bounds(data);
      [xmin, ymin, xmax, ymax] = [Math.min(xmin, x0), Math.min(ymin, y0), Math.max(xmax, x1), Math.max(ymax, y1)];
    }
    if (!Number.isFinite(xmin)) return;
    const target =
      xmin === xmax && ymin === ymax
        ? { target: new Point({ longitude: xmin, latitude: ymin }), scale: POINT_SCALE }
        : new Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }).expand(EXTENT_PADDING);
    // Interrupted when the user moves the map: nothing to do.
    view.goTo(target).catch(() => undefined);
  }

  /** Saves a change to an entry, and shows it everywhere. */
  async #update(id: string, change: Partial<Pick<LibraryEntry, "name" | "notes" | "color">>): Promise<void> {
    const library = this.#library;
    const entry = library?.get(id);
    if (!library || !entry) return;
    const updated = { ...entry, ...change };
    if (change.name !== undefined) this.#layers?.rename(id, change.name);
    if (change.color !== undefined) this.#layers?.recolor(id, change.color);
    await library.put(updated);
    this.#render();
    this.#checkStorage();
  }

  async #delete(id: string): Promise<void> {
    const library = this.#library;
    if (!library) return;
    await library.delete(id);
    this.#visible.delete(id);
    saveVisible(this.#visible);
    this.#layers?.remove(id);
    this.#parsed.delete(id);
    this.#closeDetails();
    this.#render();
    this.#checkStorage();
  }

  #download(id: string): void {
    const entry = this.#library?.get(id);
    if (!entry) return;
    const url = URL.createObjectURL(new Blob([entry.text], { type: "application/gpx+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = entry.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /**
   * Shows an entry's details over the list. Calcite's flow shows each item marked `selected`,
   * and its back button only moves that mark, so the item is removed on Back (as buffalo-river
   * does).
   */
  #openDetails(id: string): void {
    this.#closeDetails();
    const details = new TrackDetails(id, {
      rename: (name) => void this.#update(id, { name }),
      setNotes: (notes) => void this.#update(id, { notes }),
      setColor: (color) => void this.#update(id, { color }),
      zoom: () => this.#zoomTo([id]),
      download: () => this.#download(id),
      delete: () => void this.#delete(id),
    });
    this.#details = details;
    details.element.addEventListener("calciteFlowItemBack", () => requestAnimationFrame(() => this.#closeDetails()));
    this.#render();
    this.#home.selected = false;
    details.element.selected = true;
    this.#flow.append(details.element);
  }

  #closeDetails(): void {
    const details = this.#details;
    if (!details) return;
    this.#details = undefined;
    details.flushNotes();
    details.element.remove();
    this.#home.selected = true;
  }

  /** Brings the list and the details in line with the library. */
  #render(): void {
    const library = this.#library;
    if (!library) return;
    const entries = library.list();
    const ids = new Set(entries.map((entry) => entry.id));
    for (const [id, item] of this.#items) {
      if (ids.has(id)) continue;
      item.remove();
      this.#items.delete(id);
    }
    // Appending moves an item that's already listed, so this also puts them in order.
    for (const entry of entries) this.#list.append(this.#renderItem(entry));
    this.#hint.hidden = entries.length > 0;
    this.#list.hidden = entries.length === 0;
    if (this.#details) {
      const entry = library.get(this.#details.id);
      if (entry) this.#details.render(entry, this.#units);
      else this.#closeDetails();
    }
  }

  #renderItem(entry: LibraryEntry): HTMLCalciteListItemElement {
    let item = this.#items.get(entry.id);
    if (!item) {
      item = document.createElement("calcite-list-item");
      item.value = entry.id;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.slot = "content-start";
      swatch.setAttribute("aria-hidden", "true");
      const zoom = action("zoom-to-object", "Zoom to", () => this.#zoomTo([entry.id]));
      const details = action("chevron-right", "Details", () => this.#openDetails(entry.id));
      item.append(swatch, zoom, details);
      this.#items.set(entry.id, item);
    }
    item.label = entry.name;
    item.description = formatSummary(entry.stats, this.#units);
    item.selected = this.#visible.has(entry.id);
    (item.querySelector(".swatch") as HTMLElement).style.background = entry.color;
    return item;
  }

  #showProblems(problems: string[]): void {
    this.#problemsNotice?.remove();
    this.#problemsNotice = undefined;
    if (!problems.length) return;
    const title = problems.length === 1 ? "A file wasn't added" : `${problems.length} files weren't added`;
    this.#problemsNotice = this.#notice("warning", title, problems);
  }

  /** Says once, when the library can't be kept, that tracks are gone when the page closes. */
  #checkStorage(): void {
    if (this.#storageNotice || this.#library?.persistent !== false) return;
    this.#storageNotice = this.#notice("warning", "Tracks won't be kept", [
      "This browser can't keep the track library, so tracks opened now are gone when the page is closed.",
    ]);
  }

  #notice(kind: HTMLCalciteNoticeElement["kind"], title: string, lines: string[]): HTMLCalciteNoticeElement {
    const notice = document.createElement("calcite-notice");
    notice.kind = kind;
    notice.icon = true;
    notice.closable = true;
    notice.width = "full";
    notice.scale = "s";
    const heading = document.createElement("div");
    heading.slot = "title";
    heading.textContent = title;
    const message = document.createElement("div");
    message.slot = "message";
    if (lines.length === 1) message.textContent = lines[0];
    else {
      const list = document.createElement("ul");
      for (const line of lines) {
        const li = document.createElement("li");
        li.textContent = line;
        list.append(li);
      }
      message.append(list);
    }
    notice.append(heading, message);
    notice.addEventListener("calciteNoticeClose", () => notice.remove());
    this.#notices.append(notice);
    notice.open = true;
    return notice;
  }

  #findMap(): ViewElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as ViewElement | null;
    return ref ?? findViewElement(this);
  }
}

function action(icon: HTMLCalciteActionElement["icon"], text: string, onClick: () => void): HTMLCalciteActionElement {
  const element = document.createElement("calcite-action");
  element.icon = icon;
  element.text = text;
  element.slot = "actions-end";
  element.scale = "s";
  element.addEventListener("click", onClick);
  return element;
}

/** A random id. crypto.randomUUID needs a secure context, so there's a fallback. */
function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-tracks": Tracks;
  }
}
