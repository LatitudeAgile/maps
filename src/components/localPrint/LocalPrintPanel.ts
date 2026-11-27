// The Local print component (map-printing; 3d-print D1, D10): prints the map in the browser, in
// 2D and 3D, with nothing sent to a print service. While it's open the map shows the print area
// (frame.ts); Export captures it (capture.ts) and saves a Letter PDF (pdf.ts, loaded on the first
// PDF) or the map alone as a JPEG. Ported from StewardshipOS MapPrintPanel.vue and the print
// parts of HouseholdMap.vue.
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";

import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import { findViewElement, PANEL_CLOSE, PANEL_OPEN, type ViewElement } from "viewer";
import { isTilted, placeOnGround, takePicture } from "./capture.ts";
import { PrintFrame, type PrintView } from "./frame.ts";
import { credits, fitLegend, legendRows } from "./legend.ts";
import { mapPage } from "./page.ts";
import type { PdfInput } from "./pdf.ts";

export type PrintOrientation = "landscape" | "portrait";
export type PrintFormat = "pdf" | "jpg";

const STYLE = `
  :host { display: block; }
  /* In a corner or its expand, a panel's width, which the hint's text would otherwise widen. */
  :host(.viewer-corner-panel) { max-inline-size: var(--arcgis-internal-panel-width, 300px); }
  .print { display: flex; flex-direction: column; gap: var(--calcite-spacing-md); padding: var(--calcite-spacing-md); }
  calcite-label { --calcite-label-margin-bottom: 0; }
  .hint { margin: 0; font-size: var(--calcite-font-size--1); color: var(--calcite-color-text-3); }
  calcite-notice { margin-inline: 0; }
  [hidden] { display: none !important; }
`;

/** Characters Windows doesn't allow in file names, and control characters. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g;

/** The file name for a print: the title, or the app's title when it's empty (D10). */
export function fileName(title: string, appTitle: string, format: PrintFormat): string {
  const name = (title.trim() || appTitle.trim() || "Map").replace(FORBIDDEN, "-");
  return `${name}.${format}`;
}

/** A data URL's bytes. */
function dataUrlBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Save a file through a temporary download link. */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export class LocalPrintPanel extends HTMLElement {
  /** Set by the component stage in a sidebar panel or an expand; else the map is found as an ancestor. */
  referenceElement: ViewElement | undefined;
  /** The `title` option: the starting title. The app's title when unset. */
  printTitle: string | undefined;
  /** The `orientation` option: the starting orientation. */
  orientation: PrintOrientation = "landscape";
  /** The `format` option: the starting output. */
  format: PrintFormat = "pdf";

  #root: ShadowRoot;
  #title: HTMLCalciteInputTextElement;
  #orientation: HTMLCalciteSegmentedControlElement;
  #format: HTMLCalciteSegmentedControlElement;
  #tiltNotice: HTMLCalciteNoticeElement;
  #errorNotice: HTMLCalciteNoticeElement;
  #errorText: HTMLElement;
  #export: HTMLCalciteButtonElement;
  #started = false;
  #open = false;
  #busy = false;
  #view: PrintView | undefined;
  #frame: PrintFrame | undefined;
  #tiltWatch: ResourceHandle | undefined;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const box = document.createElement("div");
    box.className = "print";

    this.#title = document.createElement("calcite-input-text");
    this.#orientation = segmented("Orientation", [
      ["landscape", "Landscape"],
      ["portrait", "Portrait"],
    ]);
    this.#orientation.addEventListener("calciteSegmentedControlChange", () => this.#showFrame());
    this.#format = segmented("Output", [
      ["pdf", "PDF layout"],
      ["jpg", "Map image"],
    ]);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Pan and zoom the map so what you want is inside the frame. PDF layout is a Letter page with a title, legend and scale, which map apps such as Avenza Maps can place you on. Map image is the map alone, as a JPEG. Nothing is sent to a print service.";

    this.#tiltNotice = notice("warning", "exclamation-mark-triangle");
    this.#tiltNotice.querySelector("[slot=message]")!.textContent =
      "The view is tilted, so the print won't be to scale. Look straight down for a scale bar and a located PDF.";
    this.#errorNotice = notice("danger", "exclamation-mark-triangle");
    this.#errorText = this.#errorNotice.querySelector("[slot=message]")!;

    this.#export = document.createElement("calcite-button");
    this.#export.textContent = "Export";
    this.#export.iconStart = "print";
    this.#export.width = "full";
    this.#export.addEventListener("click", () => void this.#exportPrint());

    box.append(
      labelled("Title", this.#title),
      labelled("Orientation", this.#orientation),
      labelled("Output", this.#format),
      hint,
      this.#tiltNotice,
      this.#errorNotice,
      this.#export,
    );
    this.#root.append(style, box);

    this.addEventListener(PANEL_OPEN, () => this.#setOpen(true));
    this.addEventListener(PANEL_CLOSE, () => this.#setOpen(false));
  }

  connectedCallback(): void {
    if (this.#started) return;
    this.#started = true;
    // The starting choices, from the options (the title defaults to the app's title).
    this.#title.value = this.printTitle ?? document.title;
    choose(this.#orientation, this.orientation);
    choose(this.#format, this.format);
    // Straight in a map corner, without an expand, it's always open.
    if (!this.closest("arcgis-expand") && findViewElement(this)) this.#setOpen(true);
  }

  disconnectedCallback(): void {
    if (this.isConnected) return;
    this.#setOpen(false);
  }

  get #landscape(): boolean {
    return this.#orientation.value !== "portrait";
  }

  async #getView(): Promise<PrintView | undefined> {
    if (this.#view) return this.#view;
    const element = this.referenceElement ?? findViewElement(this);
    if (!element) return undefined;
    await element.viewOnReady();
    this.#view = element.view as PrintView;
    this.#frame = new PrintFrame(this.#view);
    return this.#view;
  }

  async #setOpen(open: boolean): Promise<void> {
    this.#open = open;
    if (!open) {
      this.#frame?.hide();
      this.#tiltWatch?.remove();
      this.#tiltWatch = undefined;
      return;
    }
    const view = await this.#getView();
    if (!view || !this.#open) return;
    this.#showFrame();
    // The tilt notice follows the camera while open (D7).
    this.#tiltWatch ??= reactiveUtils.watch(
      () => (view.type === "3d" ? view.camera.tilt : 0),
      () => (this.#tiltNotice.open = isTilted(view)),
      { initial: true },
    );
  }

  #showFrame(): void {
    if (!this.#open || !this.#frame) return;
    const page = mapPage(this.#landscape);
    this.#frame.show(page.mapWidth / page.mapHeight);
  }

  /** Export (D10): one print at a time; a failure is said in the component, with the choices kept. */
  async #exportPrint(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#export.loading = true;
    this.#export.disabled = true;
    this.#errorNotice.open = false;
    try {
      const view = await this.#getView();
      const area = this.#frame?.area;
      if (!view || !area) return;
      const landscape = this.#landscape;
      const format = this.#format.value === "jpg" ? "jpg" : "pdf";
      const title = (this.#title.value ?? "").trim();
      const page = mapPage(landscape);
      const placement = await placeOnGround(view, area, page);
      const picture = await takePicture(view, area, page);
      let blob: Blob;
      if (format === "jpg") {
        blob = new Blob([dataUrlBytes(picture.dataUrl)], { type: "image/jpeg" });
      } else {
        const rows = await legendRows(view);
        const cells = page.legendColumns * (landscape ? 3 : 4);
        const input: PdfInput = {
          title,
          landscape,
          image: picture.dataUrl,
          date: new Date().toLocaleDateString(),
          legend: fitLegend(rows, cells),
          credits: credits(view),
          placement,
        };
        const { makePdf } = await import("./pdf.ts");
        const bytes = await makePdf(input);
        blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
      }
      download(blob, fileName(title, document.title, format));
    } catch (error) {
      console.error("[viewer] Local print failed:", error);
      const tainted = (error as { name?: string } | null)?.name === "SecurityError";
      this.#errorText.textContent = tainted
        ? "The map couldn't be printed. A layer's server doesn't allow its images to be copied."
        : "The map couldn't be printed.";
      this.#errorNotice.open = true;
    } finally {
      this.#busy = false;
      this.#export.loading = false;
      this.#export.disabled = false;
    }
  }
}

function labelled(text: string, control: HTMLElement): HTMLCalciteLabelElement {
  const label = document.createElement("calcite-label");
  label.append(text, control);
  return label;
}

function segmented(name: string, items: [string, string][]): HTMLCalciteSegmentedControlElement {
  const control = document.createElement("calcite-segmented-control");
  control.width = "full";
  control.setAttribute("aria-label", name);
  for (const [value, text] of items) {
    const item = document.createElement("calcite-segmented-control-item");
    item.value = value;
    item.textContent = text;
    control.append(item);
  }
  return control;
}

function choose(control: HTMLCalciteSegmentedControlElement, value: string): void {
  for (const item of control.querySelectorAll("calcite-segmented-control-item")) item.checked = item.value === value;
}

function notice(kind: "warning" | "danger", icon: HTMLCalciteNoticeElement["icon"]): HTMLCalciteNoticeElement {
  const element = document.createElement("calcite-notice");
  element.kind = kind;
  element.icon = icon;
  element.scale = "s";
  element.width = "full";
  const message = document.createElement("div");
  message.slot = "message";
  element.append(message);
  return element;
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-local-print": LocalPrintPanel;
  }
}
