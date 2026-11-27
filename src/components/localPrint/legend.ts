// The printed legend and credits (3d-print D8, D9), from the map's visible layers. Generalized
// from StewardshipOS src/print/mapLegend.ts, which was specific to its ward layer.
import type Layer from "@arcgis/core/layers/Layer.js";
import type { SymbolUnion } from "@arcgis/core/unionTypes.js";
import * as symbolUtils from "@arcgis/core/symbols/support/symbolUtils.js";
import type { PrintView } from "./frame.ts";

/** A legend swatch: a PNG at 300 DPI, and its size on the page in points. */
export interface Swatch {
  dataUrl: string;
  width: number;
  height: number;
}

/** One legend row: a layer with its symbol, a layer's title over its classes, or a class. */
export interface LegendRow {
  label: string;
  /** A class under its layer's title. */
  indent: boolean;
  swatch: Swatch | null;
}

/** The legend cut to its grid: the rows that fit, and how many were left out. */
export interface FittedLegend {
  rows: LegendRow[];
  more: number;
}

/** Swatches are drawn at their size in points, at most this. */
const SWATCH_SIZE = 12;
/** Pixels per CSS pixel for 300 DPI. */
const PRINT_SCALE = 300 / 96;

type AnyLayer = Layer & Record<string, any>;

/** In its scale range at the view's scale (0 means no limit). */
function inScale(layer: AnyLayer, scale: number): boolean {
  const min = layer.minScale ?? 0;
  const max = layer.maxScale ?? 0;
  return (min === 0 || scale <= min) && (max === 0 || scale >= max);
}

/**
 * The visible operational layers, top to bottom as the layer list shows them, going into groups
 * (whose own visibility the walk checks on the way down). Groups themselves aren't listed.
 */
function visibleLayers(view: PrintView, forLegend: boolean): AnyLayer[] {
  const out: AnyLayer[] = [];
  const walk = (layers: readonly AnyLayer[]) => {
    for (const layer of [...layers].reverse()) {
      if (!layer.visible || !inScale(layer, view.scale)) continue;
      if (forLegend && (layer.legendEnabled === false || layer.listMode === "hide")) continue;
      // A graphics layer with nothing on it, such as the Sketch panel's before any sketch
      if (forLegend && layer.type === "graphics" && layer.graphics.length === 0) continue;
      if (layer.type === "group") walk(layer.layers.toArray());
      else out.push(layer);
    }
  };
  walk(view.map?.layers.toArray() ?? []);
  return out;
}

/** The rows a layer gives, by its renderer (D8). */
async function layerRows(layer: AnyLayer): Promise<LegendRow[]> {
  const title = layer.title || "Layer";
  const renderer = layer.renderer;
  const titleOnly: LegendRow[] = [{ label: title, indent: false, swatch: null }];
  if (renderer?.type === "simple") {
    // A color that varies by value, in classes with labels: a row per class, in the symbol
    // drawn in each class's color (as the SDK's legend shows it).
    const colors = (renderer.visualVariables ?? []).find((v: any) => v.type === "color" && v.stops?.length);
    if (colors && renderer.symbol && "color" in renderer.symbol) {
      const rows = await Promise.all(
        colors.stops.map(async (stop: any) => {
          const symbol = renderer.symbol.clone();
          symbol.color = stop.color;
          return { label: stop.label ?? String(stop.value), indent: true, swatch: await swatchFor(symbol) };
        }),
      );
      return [...titleOnly, ...rows];
    }
    return [{ label: title, indent: false, swatch: await swatchFor(renderer.symbol) }];
  }
  if (renderer?.type === "unique-value") {
    const infos = (renderer.uniqueValueInfos ?? []).map((info: any) => ({ label: info.label ?? String(info.value), symbol: info.symbol }));
    if (renderer.defaultSymbol) infos.push({ label: renderer.defaultLabel || "Others", symbol: renderer.defaultSymbol });
    return [...titleOnly, ...(await classRows(infos))];
  }
  if (renderer?.type === "class-breaks") {
    const infos = (renderer.classBreakInfos ?? []).map((info: any) => ({
      label: info.label ?? `${info.minValue} – ${info.maxValue}`,
      symbol: info.symbol,
    }));
    return [...titleOnly, ...(await classRows(infos))];
  }
  return titleOnly;
}

async function classRows(infos: { label: string; symbol: SymbolUnion | null }[]): Promise<LegendRow[]> {
  return Promise.all(infos.map(async (info) => ({ label: info.label, indent: true, swatch: info.symbol ? await swatchFor(info.symbol) : null })));
}

/** The legend's rows for the map as it is now. */
export async function legendRows(view: PrintView): Promise<LegendRow[]> {
  const rows = await Promise.all(visibleLayers(view, true).map(layerRows));
  return rows.flat();
}

/** Fit rows to a grid of `cells`; when they don't fit, the last cell says how many more. */
export function fitLegend(rows: LegendRow[], cells: number): FittedLegend {
  if (rows.length <= cells) return { rows, more: 0 };
  return { rows: rows.slice(0, cells - 1), more: rows.length - (cells - 1) };
}

/** A symbol's swatch, from symbolUtils.renderPreviewHTML, as a 300 DPI PNG; null if it can't be drawn. */
async function swatchFor(symbol: SymbolUnion | null | undefined): Promise<Swatch | null> {
  if (!symbol) return null;
  try {
    // For a line, `size` sets the stroke's width, which draws a blob: lines keep their own width
    // and are scaled to the swatch box when drawn.
    const line = symbol.type === "simple-line" || symbol.type === "line-3d";
    const preview = await symbolUtils.renderPreviewHTML(symbol, line ? {} : { size: SWATCH_SIZE, maxSize: SWATCH_SIZE });
    return preview ? await rasterize(preview) : null;
  } catch {
    return null;
  }
}

/** Draw a preview (an SVG, an image or a canvas) to a PNG at print resolution. */
async function rasterize(preview: HTMLElement): Promise<Swatch | null> {
  const svg = preview instanceof SVGSVGElement ? preview : preview.querySelector("svg");
  const img = preview instanceof HTMLImageElement ? preview : preview.querySelector("img");
  const canvas = preview instanceof HTMLCanvasElement ? preview : preview.querySelector("canvas");
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  if (svg) {
    width = Number(svg.getAttribute("width")) || SWATCH_SIZE;
    height = Number(svg.getAttribute("height")) || SWATCH_SIZE;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    await inlineImages(copy);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    await image.decode();
    source = image;
  } else if (img) {
    await img.decode().catch(() => undefined);
    width = img.width || parseFloat(img.style.width) || img.naturalWidth;
    height = img.height || parseFloat(img.style.height) || img.naturalHeight;
    source = img;
  } else if (canvas) {
    width = parseFloat(canvas.style.width) || canvas.width;
    height = parseFloat(canvas.style.height) || canvas.height;
    source = canvas;
  } else {
    return null;
  }
  if (!width || !height) return null;
  const out = document.createElement("canvas");
  out.width = Math.ceil(width * PRINT_SCALE);
  out.height = Math.ceil(height * PRINT_SCALE);
  out.getContext("2d")!.drawImage(source, 0, 0, out.width, out.height);
  // CSS pixels to points
  return { dataUrl: out.toDataURL("image/png"), width: width * 0.75, height: height * 0.75 };
}

/** An SVG drawn as an image loads nothing from outside: inline its pictures as data URLs. */
async function inlineImages(svg: SVGSVGElement): Promise<void> {
  const XLINK = "http://www.w3.org/1999/xlink";
  await Promise.all(
    [...svg.querySelectorAll("image")].map(async (image) => {
      // The SDK writes the attribute as "xlink:href", with or without its namespace
      const href = image.getAttribute("href") ?? image.getAttributeNS(XLINK, "href") ?? image.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        const blob = await (await fetch(href)).blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        image.removeAttributeNS(XLINK, "href");
        image.removeAttribute("xlink:href");
        image.setAttribute("href", dataUrl);
      } catch {
        // Left as it is: the swatch draws without that picture.
      }
    }),
  );
}

// Credits can run to paragraphs; the print's credit line keeps each to its start
// (StewardshipOS shortCredit).
const MAX_CREDIT = 100;
function shortCredit(text: string): string {
  // Without HTML: tags dropped and entities such as &copy; decoded
  const html = new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
  const plain = html.replace(/\s+/g, " ").trim();
  if (plain.length <= MAX_CREDIT) return plain;
  const cut = plain.slice(0, MAX_CREDIT);
  return cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : MAX_CREDIT).replace(/[\s,.;:]+$/, "") + "…";
}

/**
 * The credit line (D9): the basemap's base and reference layers, the ground's elevation layers
 * in 3D, and the visible operational layers, each once, then "Powered by Esri", as on the map.
 */
export function credits(view: PrintView): string {
  const map = view.map;
  const basemap = map?.basemap;
  const layers: AnyLayer[] = [
    ...(basemap?.baseLayers.toArray() ?? []),
    ...(basemap?.referenceLayers.toArray() ?? []),
    ...(view.type === "3d" ? (map?.ground?.layers.toArray() ?? []) : []),
    ...visibleLayers(view, false),
  ].filter((layer: AnyLayer) => layer.visible !== false);
  const texts = layers
    .map((layer) => layer.copyright || layer.sourceJSON?.copyrightText)
    .filter((text): text is string => typeof text === "string")
    .map(shortCredit)
    .filter(Boolean);
  return [...new Set(texts), "Powered by Esri"].join(" · ");
}
