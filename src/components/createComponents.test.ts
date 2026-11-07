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
  home: { tag: "arcgis-home", load: async () => undefined, options: { label: "string", icon: "string" }, panel: { heading: "Home", icon: "home" } },
  "test-legend": {
    tag: "test-legend",
    load: async () => undefined,
    options: { layers: "layer[]", focus: "layer", layerInfos: "layer-info[]" },
    panel: { heading: "Test", icon: "list" },
  },
  broken: { tag: "x-broken", load: () => Promise.reject(new Error("chunk failed")), options: {}, panel: { heading: "B", icon: "x" } },
};

function setup(entries: ComponentConfig[]) {
  const app = new AppModel();
  const appended: FakeElement[] = [];
  const reports: string[] = [];
  app.errors.subscribe((r) => reports.push(`${r.source}: ${r.message}`));
  const mapElement = { append: (...nodes: unknown[]) => appended.push(...(nodes as FakeElement[])) };
  const run = () =>
    createComponents({
      entries,
      app,
      types: TYPES,
      mapElement,
      createElement: (tag) => new FakeElement(tag),
    });
  return { app, appended, reports, run, mapElement };
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

  test("layer-info[] options resolve layer ids to { layer, title } with the layer objects", async () => {
    const s2 = setup([
      component("legend", { type: "test-legend", placement: "none", options: { layerInfos: [{ layer: "sites", title: "Survey sites" }, { layer: "roads" }] } }),
    ]);
    const sites = { id: "sites" } as Layer;
    const roads = { id: "roads" } as Layer;
    s2.app.addLayer({ entry: { id: "sites", type: "geojson", options: {}, hooks: {} }, layer: sites });
    s2.app.addLayer({ entry: { id: "roads", type: "geojson", options: {}, hooks: {} }, layer: roads });
    await s2.run();
    expect(s2.appended[0].layerInfos).toEqual([{ layer: sites, title: "Survey sites" }, { layer: roads }]);
  });

  test("none: attached hidden, without a slot, and registered", async () => {
    const s = setup([component("quiet", { placement: "none" })]);
    await s.run();
    expect(s.appended[0].hidden).toBe(true);
    expect(s.appended[0].slot).toBe("");
    expect(s.app.getComponent("quiet")?.element).toBe(s.appended[0]);
  });

  test("panel: created outside the map, referencing it, and returned in config order", async () => {
    const s = setup([component("a", { placement: "panel" }), component("c"), component("b", { placement: "panel" })]);
    const { panels } = await s.run();
    // Only the corner component goes into the map.
    expect(s.appended.map((e) => e.attributes["data-component-id"])).toEqual(["c"]);
    expect(panels.map((p) => p.entry.id)).toEqual(["a", "b"]);
    for (const p of panels) {
      expect((p.element as FakeElement).referenceElement).toBe(s.mapElement);
      expect(p.element.slot).toBe("");
      expect(s.app.getComponent(p.entry.id)?.element).toBe(p.element);
    }
  });

  test("panel heading and icon: config settings win, type defaults fill gaps", async () => {
    const s = setup([
      component("plain", { placement: "panel" }),
      component("custom", { placement: "panel", panel: { heading: "Start over" } }),
      component("both", { placement: "panel", panel: { heading: "Key", icon: "list" } }),
    ]);
    const { panels } = await s.run();
    expect(panels.map((p) => [p.heading, p.icon])).toEqual([
      ["Home", "home"],
      ["Start over", "home"],
      ["Key", "list"],
    ]);
  });

  test("no panel components: nothing for the sidebar", async () => {
    const s = setup([component("c")]);
    expect((await s.run()).panels).toEqual([]);
  });

  test("a component type that fails to load is reported; other components are still created", async () => {
    const s = setup([component("x", { type: "broken" }), component("home")]);
    await s.run();
    expect(s.appended.map((e) => e.attributes["data-component-id"])).toEqual(["home"]);
    expect(s.reports).toEqual(['component-type:broken: The "broken" component could not be loaded.']);
  });
});
