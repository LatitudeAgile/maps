import type Layer from "@arcgis/core/layers/Layer.js";
import { describe, expect, test } from "vitest";
import { AppModel } from "../app/AppModel.ts";
import type { ComponentConfig } from "../config/types.ts";
import { createComponents, type ComponentElement } from "./createComponents.ts";
import type { ComponentType } from "./registry.ts";

class FakeElement implements ComponentElement {
  slot = "";
  hidden = false;
  attributes: Record<string, string> = {};
  [key: string]: unknown;
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
}

const TYPES: Record<string, ComponentType> = {
  home: { tag: "arcgis-home", load: async () => undefined, options: { label: "string", icon: "string" } },
  "test-legend": { tag: "test-legend", load: async () => undefined, options: { layers: "layer[]", focus: "layer" } },
  broken: { tag: "x-broken", load: () => Promise.reject(new Error("chunk failed")), options: {} },
};

function setup(entries: ComponentConfig[]) {
  const app = new AppModel();
  const appended: FakeElement[] = [];
  const warnings: string[] = [];
  const reports: string[] = [];
  app.errors.subscribe((r) => reports.push(`${r.source}: ${r.message}`));
  const run = () =>
    createComponents({
      entries,
      app,
      types: TYPES,
      mapElement: { append: (...nodes) => appended.push(...(nodes as FakeElement[])) },
      createElement: (tag) => new FakeElement(tag),
      warn: (m) => warnings.push(m),
    });
  return { app, appended, warnings, reports, run };
}

const component = (id: string, extra: Partial<ComponentConfig> = {}): ComponentConfig => ({
  id,
  type: "home",
  placement: "top-left",
  options: {},
  ...extra,
});

describe("createComponents", () => {
  test("corner components are slotted in config order and marked with their id", async () => {
    const s = setup([component("first", { placement: "top-right" }), component("second", { placement: "top-right" })]);
    await s.run();
    expect(s.appended.map((e) => [e.tag, e.slot, e.attributes["data-component-id"]])).toEqual([
      ["arcgis-home", "top-right", "first"],
      ["arcgis-home", "top-right", "second"],
    ]);
    expect(s.app.getComponent("second")?.element).toBe(s.appended[1]);
  });

  test("supported options are applied as properties", async () => {
    const s = setup([component("home", { options: { label: "Full extent", icon: "home" } })]);
    await s.run();
    expect(s.appended[0].label).toBe("Full extent");
    expect(s.appended[0].icon).toBe("home");
  });

  test("Unsupported option: the component is still created (validation warned and dropped it)", async () => {
    // validateComponents drops unsupported options with a warning; creation sees only supported ones.
    const s = setup([component("home", { options: { label: "L" } })]);
    await s.run();
    expect(s.appended).toHaveLength(1);
    expect(s.appended[0]).not.toHaveProperty("colour");
  });

  test("Reference resolved: layer ids become the layer objects", async () => {
    const s = setup([component("legend", { type: "test-legend", placement: "none", options: { layers: ["parcels", "roads"], focus: "roads" } })]);
    const parcels = { id: "parcels" } as Layer;
    const roads = { id: "roads" } as Layer;
    s.app.addLayer({ entry: { id: "parcels", type: "geojson", options: {}, hooks: {} }, layer: parcels });
    s.app.addLayer({ entry: { id: "roads", type: "geojson", options: {}, hooks: {} }, layer: roads });
    await s.run();
    expect(s.appended[0].layers).toEqual([parcels, roads]);
    expect(s.appended[0].focus).toBe(roads);
  });

  test("none: attached hidden, without a slot, and registered", async () => {
    const s = setup([component("quiet", { placement: "none" })]);
    await s.run();
    expect(s.appended[0].hidden).toBe(true);
    expect(s.appended[0].slot).toBe("");
    expect(s.app.getComponent("quiet")?.element).toBe(s.appended[0]);
  });

  test("panel: not created, one warning naming each id, still registered", async () => {
    const s = setup([component("a", { placement: "panel" }), component("b", { placement: "panel" }), component("c")]);
    await s.run();
    expect(s.appended.map((e) => e.attributes["data-component-id"])).toEqual(["c"]);
    expect(s.warnings).toHaveLength(1);
    expect(s.warnings[0]).toContain("a, b");
    expect(s.app.getComponent("a")).toEqual({ entry: expect.objectContaining({ id: "a" }), element: undefined });
  });

  test("a component type that fails to load is reported; other components are still created", async () => {
    const s = setup([component("x", { type: "broken" }), component("home")]);
    await s.run();
    expect(s.appended.map((e) => e.attributes["data-component-id"])).toEqual(["home"]);
    expect(s.reports).toEqual(['component-type:broken: The "broken" component could not be loaded.']);
  });
});
