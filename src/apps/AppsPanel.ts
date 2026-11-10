import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-chip";
import "@esri/calcite-components/components/calcite-flow";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";

import { PANEL_CLOSE, PANEL_OPEN } from "../sidebar/panelEvents.ts";
import type { AppDirectory, AppEntry } from "./AppDirectory.ts";
import { appUrl, createAppTile } from "./tile.ts";

/** More apps than this get a filter box. */
const FILTER_THRESHOLD = 6;

export interface AppsPanelOptions {
  /** The apps list; absent when only settings are shown (add-settings D4). */
  directory?: AppDirectory;
  /** The Settings section, placed after the list and outside it (add-settings D5). */
  settings?: HTMLElement;
  /** Opens an app; defaults to loading its address with a history entry (D9). */
  openApp?: (name: string) => void;
}

/**
 * The Apps and settings panel's content (add-app-selector D6, add-settings D5): a calcite-flow
 * whose first page lists the catalog's apps, one row each, in catalog order, then the Settings
 * section. Either can be absent. Rows update in place as listings arrive. The first time the
 * panel opens, it asks the directory to load listings, if startup hasn't yet.
 */
export function createAppsPanel({ directory, settings, openApp = (name) => location.assign(appUrl(name)) }: AppsPanelOptions): HTMLCalciteFlowElement {
  const flow = document.createElement("calcite-flow");
  flow.classList.add("apps-panel");

  const listPage = document.createElement("calcite-flow-item");
  listPage.classList.add("apps-list-page");
  flow.append(listPage);
  if (directory) addAppsList(flow, listPage, directory, openApp);
  // After the list, not in it, so the list's filter never hides it (add-settings D5).
  if (settings) listPage.append(settings);
  return flow;
}

/** The apps list and its detail pages (add-app-selector D6, D8). */
function addAppsList(
  flow: HTMLCalciteFlowElement,
  listPage: HTMLCalciteFlowItemElement,
  directory: AppDirectory,
  openApp: (name: string) => void,
): void {
  const list = document.createElement("calcite-list");
  list.label = "Apps";
  list.selectionMode = "none";
  // Many apps: a filter box over titles and summaries (D6).
  if (directory.entries.length > FILTER_THRESHOLD) {
    list.filterEnabled = true;
    list.filterProps = ["label", "description"];
    list.filterPlaceholder = "Find an app";
    list.filterLabel = "Find an app";
    const none = document.createElement("calcite-notice");
    none.slot = "filter-no-results";
    none.open = true;
    none.width = "full";
    const message = document.createElement("div");
    message.slot = "message";
    message.textContent = "No apps match";
    none.append(message);
    list.append(none);
  }
  listPage.append(list);

  const rows = new Map<string, HTMLCalciteListItemElement>();
  for (const entry of directory.entries) {
    const row = document.createElement("calcite-list-item");
    row.value = entry.name;
    row.dataset.app = entry.name;
    renderRow(row, entry, directory.currentName, openApp);
    list.append(row);
    rows.set(entry.name, row);
  }
  // The app's page (D6, D8): one at a time, pushed onto the flow over the list.
  let detail: { name: string; page: HTMLCalciteFlowItemElement } | undefined;
  const closeDetail = () => {
    detail?.page.remove();
    detail = undefined;
    listPage.selected = true;
  };
  list.addEventListener("calciteListItemSelect", (event) => {
    const row = event.target as HTMLCalciteListItemElement;
    const entry = directory.get(row.value as string);
    if (!entry) return;
    closeDetail();
    const page = document.createElement("calcite-flow-item");
    page.classList.add("apps-detail-page");
    renderDetail(page, entry, directory.currentName, openApp);
    // Calcite 5.2's flow shows each item marked `selected` (the last one is the current page),
    // and its back button only moves that mark back to the list. So the list is unmarked while
    // the page is shown, and the page is removed after Back, with focus returned to its row.
    page.addEventListener("calciteFlowItemBack", () => {
      requestAnimationFrame(() => {
        if (detail?.page === page) closeDetail();
        void row.setFocus();
      });
    });
    listPage.selected = false;
    page.selected = true;
    flow.append(page);
    detail = { name: entry.name, page };
  });

  directory.onChange((entry) => {
    const row = rows.get(entry.name);
    if (row) renderRow(row, entry, directory.currentName, openApp);
    if (detail?.name === entry.name) renderDetail(detail.page, entry, directory.currentName, openApp);
  });

  // Listings load after startup, or now if the panel opens first (D5). load() runs only once.
  flow.addEventListener(PANEL_OPEN, () => directory.load());
  // Reopening the panel shows the list (D6).
  flow.addEventListener(PANEL_CLOSE, closeDetail);
}

/** Fill an app's page from its entry (D8). Text only: nothing from a config is parsed as HTML. */
function renderDetail(page: HTMLCalciteFlowItemElement, entry: AppEntry, currentName: string, openApp: (name: string) => void): void {
  const ready = entry.state === "ready";
  const title = ready ? entry.listing.title : entry.name;
  page.heading = title;

  const body = document.createElement("div");
  body.classList.add("app-detail");

  const header = document.createElement("div");
  header.classList.add("app-detail-header");
  const tile = createAppTile(ready ? entry.listing : undefined, "detail");
  if (entry.state === "unavailable") tile.replaceChildren(unavailableIcon("l"));
  const names = document.createElement("div");
  const heading = document.createElement("h2");
  heading.classList.add("app-detail-title");
  heading.textContent = title;
  names.append(heading);
  if (ready && entry.listing.summary) {
    const summary = document.createElement("p");
    summary.classList.add("app-detail-summary");
    summary.textContent = entry.listing.summary;
    names.append(summary);
  }
  header.append(tile, names);
  body.append(header);

  if (entry.state === "unavailable") {
    const notice = document.createElement("calcite-notice");
    notice.open = true;
    notice.kind = "warning";
    notice.icon = true;
    const noticeTitle = document.createElement("div");
    noticeTitle.slot = "title";
    noticeTitle.textContent = "This app can't be opened";
    const message = document.createElement("div");
    message.slot = "message";
    message.textContent = entry.reason;
    notice.append(noticeTitle, message);
    body.append(notice);
  } else if (entry.state === "loading") {
    const note = document.createElement("p");
    note.classList.add("app-detail-note");
    note.textContent = "Loading…";
    body.append(note);
  } else if (entry.name === currentName) {
    const note = document.createElement("p");
    note.classList.add("app-detail-note");
    note.textContent = "You're using this app.";
    body.append(note);
  } else {
    const open = document.createElement("calcite-button");
    open.width = "full";
    open.iconStart = "launch";
    open.textContent = "Open app";
    open.label = `Open ${title}`;
    open.addEventListener("click", () => openApp(entry.name));
    body.append(open);
  }

  if (ready && entry.listing.description?.trim()) {
    const about = document.createElement("h3");
    about.classList.add("app-detail-about");
    about.textContent = "About";
    const description = document.createElement("div");
    description.classList.add("app-detail-description");
    for (const text of entry.listing.description.trim().split(/\n\s*\n/)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      description.append(paragraph);
    }
    body.append(about, description);
  }

  const copy = ready ? copyLinkButton(entry.name) : undefined;
  if (copy) body.append(copy);

  page.replaceChildren(body);
}

/**
 * Copy link (D8): copies the address Open loads. Left out when the browser has no clipboard
 * API, such as on a page not served over HTTPS. The button says how it went for 2 s.
 */
function copyLinkButton(name: string): HTMLCalciteButtonElement | undefined {
  if (typeof navigator.clipboard?.writeText !== "function") return undefined;
  const button = document.createElement("calcite-button");
  button.appearance = "outline";
  button.kind = "neutral";
  button.width = "full";
  const idle = () => {
    button.iconStart = "link";
    button.textContent = "Copy link";
  };
  idle();
  let timer: number | undefined;
  button.addEventListener("click", () => {
    void navigator.clipboard.writeText(appUrl(name)).then(
      () => {
        button.iconStart = "check";
        button.textContent = "Link copied";
      },
      () => {
        button.iconStart = "exclamation-mark-triangle";
        button.textContent = "Couldn't copy";
      },
    ).finally(() => {
      clearTimeout(timer);
      timer = window.setTimeout(idle, 2000);
    });
  });
  return button;
}

/** Fill one row from its entry, replacing what it showed before (D6). */
function renderRow(row: HTMLCalciteListItemElement, entry: AppEntry, currentName: string, openApp: (name: string) => void): void {
  const ready = entry.state === "ready";
  const title = ready ? entry.listing.title : entry.name;
  row.label = title;
  row.description = ready ? (entry.listing.summary ?? "") : entry.state === "loading" ? "Loading…" : "Unavailable";
  row.toggleAttribute("data-unavailable", entry.state === "unavailable");

  const parts: Element[] = [];
  const tile = createAppTile(ready ? entry.listing : undefined, "row");
  tile.slot = "content-start";
  if (entry.state === "unavailable") tile.replaceChildren(unavailableIcon());
  parts.push(tile);

  if (entry.name === currentName) {
    const chip = document.createElement("calcite-chip");
    chip.slot = "content-end";
    chip.scale = "s";
    chip.label = "Current app";
    chip.textContent = "Current";
    parts.push(chip);
  } else if (ready) {
    const open = document.createElement("calcite-action");
    open.slot = "actions-end";
    open.icon = "launch";
    open.text = "Open";
    open.textEnabled = true;
    open.label = `Open ${title}`;
    open.addEventListener("click", (event) => {
      event.stopPropagation();
      openApp(entry.name);
    });
    parts.push(open);
  }
  row.replaceChildren(...parts);
}

function unavailableIcon(scale: "m" | "l" = "m"): HTMLCalciteIconElement {
  const icon = document.createElement("calcite-icon");
  icon.icon = "exclamation-mark-triangle";
  icon.scale = scale;
  return icon;
}
