// Sketch symbols and descriptions (add-print-and-sketch-panels D8), ported from StewardshipOS's
// mapSketches.ts. Only simple symbol types, which the print service draws on its server: no
// CIM line casing, and the SDK's default font for notes.
import Color from "@arcgis/core/Color.js";
import type Graphic from "@arcgis/core/Graphic.js";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import TextSymbol from "@arcgis/core/symbols/TextSymbol.js";
import { colorName, type SketchColor } from "./palette.ts";

export type SketchKind = "point" | "polyline" | "polygon" | "text";

/** The color a graphic's sketch was drawn in, `#rrggbb`. */
export const COLOR_ATTRIBUTE = "sketchColor";
/** An area's fill opacity, 0 to 1. */
export const FILL_ATTRIBUTE = "sketchFillOpacity";

const EDGE_WIDTH = 2.5;

function rgba(hex: string, alpha = 1): Color {
  const c = new Color(hex);
  c.a = alpha;
  return c;
}

/**
 * A sketch's symbol from its kind and color, an area's fill opacity (0 to 1) and a note's text.
 * At 0 an area's fill is fully transparent rather than absent, so clicking inside still hits it.
 */
export function sketchSymbol(kind: SketchKind, hex: string, text = "", fillOpacity = 0): SimpleMarkerSymbol | SimpleLineSymbol | SimpleFillSymbol | TextSymbol {
  switch (kind) {
    case "point":
      return new SimpleMarkerSymbol({ style: "circle", size: 12, color: rgba(hex), outline: { color: "white", width: 1.5 } });
    case "polyline":
      return new SimpleLineSymbol({ style: "solid", color: rgba(hex), width: EDGE_WIDTH, cap: "round", join: "round" });
    case "polygon":
      return new SimpleFillSymbol({ style: "solid", color: rgba(hex, fillOpacity), outline: { color: rgba(hex), width: EDGE_WIDTH } });
    case "text":
      return new TextSymbol({ text, color: rgba(hex), haloColor: "white", haloSize: 1.5, font: { size: 12 } });
  }
}

/** A sketch graphic's kind: a note is a point with a text symbol. */
export function sketchKind(graphic: Graphic): SketchKind | null {
  if (graphic.symbol?.type === "text") return "text";
  const type = graphic.geometry?.type;
  return type === "point" || type === "polyline" || type === "polygon" ? type : null;
}

/** An area's fill opacity, 0 to 1: from its attributes, else from its symbol. */
export function areaFillOpacity(graphic: Graphic): number {
  const saved = graphic.attributes?.[FILL_ATTRIBUTE];
  if (typeof saved === "number") return saved;
  const symbol = graphic.symbol as SimpleFillSymbol | null;
  return symbol?.type === "simple-fill" ? (symbol.color?.a ?? 0) : 0;
}

/**
 * Give a graphic the symbol for a color and, for an area, a fill opacity, keeping a note's text,
 * and remember both on it. Either left out keeps the graphic's own.
 */
export function styleSketch(graphic: Graphic, style: { color?: string; fillOpacity?: number }, fallbackColor = "#d7263d"): void {
  const kind = sketchKind(graphic);
  if (!kind) return;
  const hex = style.color ?? graphic.attributes?.[COLOR_ATTRIBUTE] ?? fallbackColor;
  const fillOpacity = style.fillOpacity ?? areaFillOpacity(graphic);
  const text = kind === "text" ? ((graphic.symbol as TextSymbol).text ?? "") : "";
  graphic.symbol = sketchSymbol(kind, hex, text, fillOpacity);
  graphic.attributes = {
    ...(graphic.attributes ?? {}),
    [COLOR_ATTRIBUTE]: hex,
    ...(kind === "polygon" ? { [FILL_ATTRIBUTE]: fillOpacity } : {}),
  };
}

/** Set a note's text, keeping its color. */
export function setNoteText(graphic: Graphic, text: string, fallbackColor = "#d7263d"): void {
  const hex = graphic.attributes?.[COLOR_ATTRIBUTE] ?? fallbackColor;
  graphic.symbol = sketchSymbol("text", hex, text);
}

/** A note's text, or "" for anything else. */
export function noteText(graphic: Graphic): string {
  return graphic.symbol?.type === "text" ? ((graphic.symbol as TextSymbol).text ?? "") : "";
}

/**
 * What a sketch is, for its popup: { title: "Sketch", text: "Blue area, 25% fill" }, or for a
 * note { title: "Note", text: <its text> }. A color not among `colors` is "a custom color".
 */
export function describeSketch(graphic: Graphic, colors: readonly SketchColor[]): { title: string; text: string } {
  const kind = sketchKind(graphic);
  const name = colorName(graphic.attributes?.[COLOR_ATTRIBUTE], colors);
  const what = (noun: string) => (name ? `${name} ${noun}` : `${noun[0].toUpperCase()}${noun.slice(1)} in a custom color`);
  switch (kind) {
    case "text":
      return { title: "Note", text: noteText(graphic) };
    case "polygon": {
      const fill = Math.round(areaFillOpacity(graphic) * 100);
      return { title: "Sketch", text: `${what("area")}, ${fill > 0 ? `${fill}% fill` : "no fill"}` };
    }
    case "polyline":
      return { title: "Sketch", text: what("line") };
    case "point":
      return { title: "Sketch", text: what("point") };
    default:
      return { title: "Sketch", text: "" };
  }
}
