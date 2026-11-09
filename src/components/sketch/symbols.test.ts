import { describe, expect, test } from "vitest";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import type SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import type SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import type SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import type TextSymbol from "@arcgis/core/symbols/TextSymbol.js";
import { DEFAULT_SKETCH_COLORS } from "./palette.ts";
import { areaFillOpacity, describeSketch, noteText, setNoteText, sketchKind, sketchSymbol, styleSketch } from "./symbols.ts";

const BLUE = "#1f5fd1";
const sr = { wkid: 3857 };
const point = () => new Point({ x: 0, y: 0, spatialReference: sr });
const line = () => new Polyline({ paths: [[[0, 0], [10, 10]]], spatialReference: sr });
const area = () => new Polygon({ rings: [[[0, 0], [0, 10], [10, 10], [0, 0]]], spatialReference: sr });

const rgba = (c: { r: number; g: number; b: number; a: number } | null | undefined) => (c ? [c.r, c.g, c.b, c.a] : null);

describe("sketch symbols (map-sketches, design D8)", () => {
  test("Symbols: Blue at 25% fill", () => {
    const fill = sketchSymbol("polygon", BLUE, "", 0.25) as SimpleFillSymbol;
    expect(fill.type).toBe("simple-fill");
    expect(rgba(fill.color)).toEqual([31, 95, 209, 0.25]);
    expect(rgba(fill.outline?.color)).toEqual([31, 95, 209, 1]);

    const stroke = sketchSymbol("polyline", BLUE) as SimpleLineSymbol;
    expect(stroke.type).toBe("simple-line");
    expect(stroke.style).toBe("solid");
    expect(rgba(stroke.color)).toEqual([31, 95, 209, 1]);

    const marker = sketchSymbol("point", BLUE) as SimpleMarkerSymbol;
    expect(rgba(marker.outline?.color)).toEqual([255, 255, 255, 1]);

    const note = sketchSymbol("text", BLUE, "Meet here") as TextSymbol;
    expect(note.text).toBe("Meet here");
    expect(rgba(note.haloColor)).toEqual([255, 255, 255, 1]);
    expect(note.haloSize).toBeGreaterThan(0);
  });

  test("an unfilled area's fill is transparent, not absent", () => {
    const fill = sketchSymbol("polygon", BLUE) as SimpleFillSymbol;
    expect(fill.style).toBe("solid");
    expect(fill.color?.a).toBe(0);
  });

  test("sketchKind: a text symbol makes a note", () => {
    expect(sketchKind(new Graphic({ geometry: point(), symbol: sketchSymbol("text", BLUE, "x") }))).toBe("text");
    expect(sketchKind(new Graphic({ geometry: line() }))).toBe("polyline");
    expect(sketchKind(new Graphic({ geometry: area() }))).toBe("polygon");
    expect(sketchKind(new Graphic({}))).toBeNull();
  });

  test("styleSketch remembers the color, and an area's fill, on the graphic", () => {
    const g = new Graphic({ geometry: area() });
    styleSketch(g, { color: BLUE, fillOpacity: 0.55 });
    expect(g.attributes).toMatchObject({ sketchColor: BLUE, sketchFillOpacity: 0.55 });
    expect(areaFillOpacity(g)).toBe(0.55);

    const l = new Graphic({ geometry: line() });
    styleSketch(l, { color: BLUE });
    expect(l.attributes).toEqual({ sketchColor: BLUE });
  });

  test("Recolor keeps the fill: a 55% area recolored stays at 55%", () => {
    const g = new Graphic({ geometry: area() });
    styleSketch(g, { color: BLUE, fillOpacity: 0.55 });
    styleSketch(g, { color: "#1a9e3f" });
    expect(g.attributes.sketchFillOpacity).toBe(0.55);
    expect(rgba((g.symbol as SimpleFillSymbol).color)).toEqual([26, 158, 63, 0.55]);
  });

  test("recoloring a note keeps its text; setNoteText keeps its color", () => {
    const g = new Graphic({ geometry: point(), symbol: sketchSymbol("text", BLUE, "Meet here"), attributes: { sketchColor: BLUE } });
    styleSketch(g, { color: "#1a1a1a" });
    expect(noteText(g)).toBe("Meet here");
    setNoteText(g, "Gate 3");
    expect(noteText(g)).toBe("Gate 3");
    expect(rgba((g.symbol as TextSymbol).color)).toEqual([26, 26, 26, 1]);
  });

  test("an area saved without its fill attribute reads it from its symbol", () => {
    const g = new Graphic({ geometry: area(), symbol: sketchSymbol("polygon", BLUE, "", 0.4) });
    expect(areaFillOpacity(g)).toBeCloseTo(0.4);
  });
});

describe("sketch descriptions (map-sketches)", () => {
  const styled = (geometry: Point | Polyline | Polygon, color: string, fillOpacity?: number) => {
    const g = new Graphic({ geometry });
    styleSketch(g, { color, fillOpacity });
    return g;
  };

  test("Descriptions: a red line, an unfilled green area, a point in an added color", () => {
    expect(describeSketch(styled(line(), "#d7263d"), DEFAULT_SKETCH_COLORS)).toEqual({ title: "Sketch", text: "Red line" });
    expect(describeSketch(styled(area(), "#1a9e3f", 0), DEFAULT_SKETCH_COLORS)).toEqual({ title: "Sketch", text: "Green area, no fill" });
    expect(describeSketch(styled(point(), "#ff00ff"), DEFAULT_SKETCH_COLORS)).toEqual({ title: "Sketch", text: "Point in a custom color" });
  });

  test("a filled area gives its fill; an added color's area is a custom color", () => {
    expect(describeSketch(styled(area(), BLUE, 0.25), DEFAULT_SKETCH_COLORS).text).toBe("Blue area, 25% fill");
    expect(describeSketch(styled(area(), "#ff00ff", 0), DEFAULT_SKETCH_COLORS).text).toBe("Area in a custom color, no fill");
  });

  test("a note is titled Note, with its text", () => {
    const g = new Graphic({ geometry: point(), symbol: sketchSymbol("text", BLUE, "Meet here"), attributes: { sketchColor: BLUE } });
    expect(describeSketch(g, DEFAULT_SKETCH_COLORS)).toEqual({ title: "Note", text: "Meet here" });
  });

  test("names come from the configured colors", () => {
    const colors = [{ name: "Teal", color: "#1f6f8b" }];
    expect(describeSketch(styled(line(), "#1f6f8b"), colors).text).toBe("Teal line");
  });
});
