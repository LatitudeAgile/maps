import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import type TextSymbol from "@arcgis/core/symbols/TextSymbol.js";
import { sketchSymbol, styleSketch } from "./symbols.ts";
import { loadPref, loadSketches, SAVE_DELAY_MS, saveSketches, savePref, SketchSaver, sketchesKey, type StorageLike } from "./storage.ts";

/** An in-memory store; `failWrites` makes setItem throw, as a full or blocked storage does. */
class MemoryStore implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("quota", "QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const sr = { wkid: 3857 };
const KEY = sketchesKey("viewer");

const curvedLine = () => {
  // A line with a circular-arc segment, as the curved segment tool draws.
  const g = new Graphic({
    geometry: Polyline.fromJSON({ curvePaths: [[[0, 0], { c: [[100, 0], [50, 30]] }]], spatialReference: sr }),
  });
  styleSketch(g, { color: "#1f5fd1" });
  return g;
};
const note = (text: string) =>
  new Graphic({ geometry: new Point({ x: 5, y: 5, spatialReference: sr }), symbol: sketchSymbol("text", "#1a1a1a", text), attributes: { sketchColor: "#1a1a1a" } });

describe("sketch storage (map-sketches, design D9)", () => {
  test("keys: sketches per config name", () => {
    expect(sketchesKey("viewer")).toBe("viewer:sketches:viewer");
    expect(sketchesKey("county")).not.toBe(sketchesKey("viewer"));
  });

  test("a round trip keeps a curved line's curve and a note's text, without the popup", () => {
    const store = new MemoryStore();
    const line = curvedLine();
    line.popupTemplate = new PopupTemplate({ title: "Sketch" });
    expect(saveSketches(store, KEY, [line, note("Meet here")])).toBe(true);
    expect(store.getItem(KEY)).not.toContain("popupInfo");

    const [restoredLine, restoredNote] = loadSketches(store, KEY);
    expect((restoredLine.geometry as Polyline).toJSON()).toEqual((line.geometry as Polyline).toJSON());
    expect(restoredLine.geometry!.toJSON()).toHaveProperty("curvePaths");
    expect(restoredLine.attributes.sketchColor).toBe("#1f5fd1");
    expect((restoredNote.symbol as TextSymbol).text).toBe("Meet here");
  });

  test("Unreadable saved sketch: the readable ones are restored", () => {
    const store = new MemoryStore();
    saveSketches(store, KEY, [curvedLine(), note("Meet here")]);
    const saved = JSON.parse(store.getItem(KEY)!);
    saved.graphics.splice(1, 0, { geometry: { x: "not a number" }, symbol: { type: "esriBogus" } }, 42);
    store.setItem(KEY, JSON.stringify(saved));
    expect(loadSketches(store, KEY)).toHaveLength(2);
  });

  test("a note without text is dropped; garbage, another version, or nothing gives none", () => {
    const store = new MemoryStore();
    saveSketches(store, KEY, [note("  ")]);
    expect(loadSketches(store, KEY)).toEqual([]);
    store.setItem(KEY, "{not json");
    expect(loadSketches(store, KEY)).toEqual([]);
    store.setItem(KEY, JSON.stringify({ v: 2, graphics: [] }));
    expect(loadSketches(store, KEY)).toEqual([]);
    expect(loadSketches(new MemoryStore(), KEY)).toEqual([]);
  });

  test("saving nothing removes the key; a throwing store reports a failed save", () => {
    const store = new MemoryStore();
    saveSketches(store, KEY, [note("x")]);
    expect(saveSketches(store, KEY, [])).toBe(true);
    expect(store.getItem(KEY)).toBeNull();
    store.failWrites = true;
    expect(saveSketches(store, KEY, [note("x")])).toBe(false);
  });

  test("preferences round-trip, and failures are ignored", () => {
    const store = new MemoryStore();
    savePref(store, "p", ["#123456"]);
    expect(loadPref(store, "p")).toEqual(["#123456"]);
    expect(loadPref(store, "missing")).toBeUndefined();
    store.setItem("bad", "{");
    expect(loadPref(store, "bad")).toBeUndefined();
    store.failWrites = true;
    expect(() => savePref(store, "p", 1)).not.toThrow();
  });
});

describe("SketchSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("quick changes in a row are saved once, after the pause", () => {
    const store = new MemoryStore();
    const results: boolean[] = [];
    const graphics = [note("a")];
    const saver = new SketchSaver(store, KEY, () => graphics, (ok) => results.push(ok));
    saver.saveSoon();
    saver.saveSoon();
    expect(store.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(results).toEqual([true]);
    expect(loadSketches(store, KEY)).toHaveLength(1);
  });

  test("Storage full: a failed save is reported, and a later one that works clears it", () => {
    const store = new MemoryStore();
    store.failWrites = true;
    const results: boolean[] = [];
    const saver = new SketchSaver(store, KEY, () => [note("a")], (ok) => results.push(ok));
    saver.saveSoon();
    saver.flush();
    store.failWrites = false;
    saver.saveSoon();
    saver.flush();
    expect(results).toEqual([false, true]);
  });

  test("flush saves only a waiting save; clear removes everything", () => {
    const store = new MemoryStore();
    const results: boolean[] = [];
    const saver = new SketchSaver(store, KEY, () => [note("a")], (ok) => results.push(ok));
    saver.flush();
    expect(results).toEqual([]);
    saver.saveSoon();
    expect(saver.pending).toBe(true);
    saver.clear();
    expect(saver.pending).toBe(false);
    expect(store.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(results).toEqual([true]);
  });
});
