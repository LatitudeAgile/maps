// The print area on the map while Local print is open (3d-print D6): a frame in the printed
// map's shape, as large as fits in the view less its padding (the open sidebar), with the map
// outside it dimmed. It takes no pointer events, so the map still pans, zooms and rotates under it.
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";

export type PrintView = MapView | SceneView;

/** A rectangle in view pixels, from the view's top left (padding included). */
export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room left between the frame and the visible map's edges, so the frame's edge shows. */
const INSET = 16;
/** Below this the frame isn't drawn, and there's nothing to print. */
const MIN_SIZE = 100;

/** The largest rectangle of `aspect` (width / height) that fits in the view less its padding. */
export function printArea(view: PrintView, aspect: number): PrintArea | null {
  const p = view.padding;
  const padding = { top: p?.top ?? 0, right: p?.right ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0 };
  const room = {
    width: view.width - padding.left - padding.right - 2 * INSET,
    height: view.height - padding.top - padding.bottom - 2 * INSET,
  };
  if (room.width < MIN_SIZE || room.height < MIN_SIZE) return null;
  const width = Math.min(room.width, room.height * aspect);
  const height = width / aspect;
  return {
    x: Math.round(padding.left + INSET + (room.width - width) / 2),
    y: Math.round(padding.top + INSET + (room.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * The dim outside the frame: the modal scrim token (white in light mode, black in dark, at 85%)
 * mixed down so the map around the frame stays readable for framing. Set by eye: about 55% in
 * light mode, where a white wash shows less on light basemaps, and about 38% in dark mode.
 */
const DIM =
  "light-dark(color-mix(in srgb, var(--calcite-color-transparent-scrim) 65%, transparent), color-mix(in srgb, var(--calcite-color-transparent-scrim) 45%, transparent))";

/** The frame overlay over one view. `show` and `hide` follow the component's open and close. */
export class PrintFrame {
  readonly #view: PrintView;
  #aspect = 1;
  #overlay: HTMLDivElement | undefined;
  #box: HTMLDivElement | undefined;
  #watch: ResourceHandle | undefined;

  constructor(view: PrintView) {
    this.#view = view;
  }

  /** The frame's rectangle now, or null when it isn't shown or the view is too small. */
  get area(): PrintArea | null {
    return this.#overlay ? printArea(this.#view, this.#aspect) : null;
  }

  /** Show the frame in this shape, or change the shape of the one shown. */
  show(aspect: number): void {
    this.#aspect = aspect;
    if (!this.#overlay) {
      const container = this.#view.container;
      if (!container) return;
      const overlay = document.createElement("div");
      overlay.className = "viewer-print-area";
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none" });
      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "absolute",
        boxSizing: "border-box",
        border: "2px dashed var(--calcite-color-brand)",
        boxShadow: `0 0 0 100vmax ${DIM}`,
      });
      overlay.append(box);
      container.append(overlay);
      this.#overlay = overlay;
      this.#box = box;
      this.#watch = reactiveUtils.watch(
        () => {
          const p = this.#view.padding;
          return [this.#view.width, this.#view.height, p?.top, p?.right, p?.bottom, p?.left];
        },
        () => this.#draw(),
      );
    }
    this.#draw();
  }

  hide(): void {
    this.#watch?.remove();
    this.#watch = undefined;
    this.#overlay?.remove();
    this.#overlay = undefined;
    this.#box = undefined;
  }

  #draw(): void {
    if (!this.#box) return;
    const area = printArea(this.#view, this.#aspect);
    this.#box.hidden = !area;
    if (!area) return;
    Object.assign(this.#box.style, {
      left: `${area.x}px`,
      top: `${area.y}px`,
      width: `${area.width}px`,
      height: `${area.height}px`,
    });
  }
}
