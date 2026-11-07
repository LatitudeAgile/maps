import { describe, expect, test } from "vitest";
import { COMPONENT_TYPES, type ComponentTypeSchema } from "../components/registry.ts";
import type { ConfigProblem } from "./types.ts";
import { validateConfig } from "./validate.ts";
import { validateComponents } from "./components.ts";

/** Registry with a test type whose options take layer references (no shipped component does yet). */
const TYPES: Record<string, ComponentTypeSchema> = {
  ...COMPONENT_TYPES,
  "test-legend": { options: { layers: "layer[]", focus: "layer", count: "number", on: "boolean" } },
};

function run(raw: unknown, layerIds: string[] = ["parcels", "roads"]) {
  const errors: ConfigProblem[] = [];
  const warnings: ConfigProblem[] = [];
  const components = validateComponents(raw, { types: TYPES, layerIds }, errors, warnings);
  return { components, errors, warnings, paths: errors.map((e) => e.path) };
}

const home = (extra: Record<string, unknown> = {}) => ({ id: "home", type: "home", placement: "top-left", ...extra });

describe("component entry validation", () => {
  test("a valid home component passes", () => {
    const { components, errors, warnings } = run([home({ options: { icon: "globe" } })]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(components).toEqual([{ id: "home", type: "home", placement: "top-left", options: { icon: "globe" } }]);
  });

  test("Unknown component type: lists the supported types", () => {
    const { paths, errors } = run([home({ type: "compass" })]);
    expect(paths).toEqual(["components[0].type"]);
    expect(errors[0].message).toContain("home");
  });

  test("Duplicate component ID", () => {
    const { paths, errors } = run([home(), home({ placement: "top-right" })]);
    expect(paths).toEqual(["components[1].id"]);
    expect(errors[0].message).toMatch(/unique/);
  });

  test("Invalid placement: lists the valid placements", () => {
    const { paths, errors } = run([home({ placement: "sidebar" })]);
    expect(paths).toEqual(["components[0].placement"]);
    for (const p of ["top-left", "bottom-end", "panel", "none"]) expect(errors[0].message).toContain(p);
  });

  test("Placement omitted: defaults to panel", () => {
    const { errors, components } = run([{ id: "h", type: "home" }]);
    expect(errors).toEqual([]);
    expect(components[0].placement).toBe("panel");
  });

  test("an explicit placement is kept, and a non-string placement is still an error", () => {
    expect(run([home({ placement: "bottom-left" })]).components[0].placement).toBe("bottom-left");
    expect(run([home({ placement: 5 })]).paths).toEqual(["components[0].placement"]);
  });

  test("every corner, panel, and none are accepted", () => {
    const placements = ["top-left", "top-right", "bottom-left", "bottom-right", "top-start", "top-end", "bottom-start", "bottom-end", "panel", "none"];
    const { errors, components } = run(placements.map((placement, i) => home({ id: `h${i}`, placement })));
    expect(errors).toEqual([]);
    expect(components.map((w) => w.placement)).toEqual(placements);
  });

  test("Unsupported option: warned with its path and dropped", () => {
    const { components, errors, warnings } = run([home({ options: { colour: "red", icon: "globe" } })]);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe("components[0].options.colour");
    expect(components[0].options).toEqual({ icon: "globe" });
  });

  test("option of the wrong kind is an error", () => {
    expect(run([home({ options: { icon: 5 } })]).paths).toEqual(["components[0].options.icon"]);
    expect(run([{ id: "t", type: "test-legend", placement: "none", options: { count: "x", on: 1 } }]).paths.sort()).toEqual([
      "components[0].options.count",
      "components[0].options.on",
    ]);
  });

  test("Unknown layer reference: names the option path and the id", () => {
    const { paths, errors } = run([
      { id: "legend", type: "test-legend", placement: "panel", options: { layers: ["parcels", "nope"], focus: "gone" } },
    ]);
    expect(paths.sort()).toEqual(["components[0].options.focus", "components[0].options.layers[1]"]);
    expect(errors.find((e) => e.path === "components[0].options.layers[1]")?.message).toContain('"nope" is not a configured layer');
  });

  test("known layer references are kept as ids for creation to resolve", () => {
    const { components, errors } = run([{ id: "legend", type: "test-legend", placement: "panel", options: { layers: ["roads"] } }]);
    expect(errors).toEqual([]);
    expect(components[0].options).toEqual({ layers: ["roads"] });
  });

  test("unknown entry keys warn", () => {
    expect(run([home({ tabOptions: {} })]).warnings.map((w) => w.path)).toEqual(["components[0].tabOptions"]);
  });
});

describe("validateConfig with components", () => {
  const base = { map: { basemap: "osm", center: [0, 0], scale: 1e6 } };

  test("layer references check against the configured layers", () => {
    const raw = {
      ...base,
      layers: [{ id: "parcels", type: "geojson", url: "https://x.example.com/p.geojson" }],
      components: [{ id: "legend", type: "test-legend", placement: "panel", options: { layers: ["parcels"] } }],
    };
    expect(validateConfig(raw, { componentTypes: TYPES }).errors).toEqual([]);
    const bad = { ...raw, components: [{ ...raw.components[0], options: { layers: ["nope"] } }] };
    expect(validateConfig(bad, { componentTypes: TYPES }).errors.map((e) => e.path)).toEqual(["components[0].options.layers[0]"]);
  });

  test("the built-in registry is used by default", () => {
    expect(validateConfig({ ...base, components: [home()] }).errors).toEqual([]);
  });
});

describe("panel settings (sidebar)", () => {
  const panelEntry = (panel: unknown, extra: Record<string, unknown> = {}) => ({ id: "h", type: "home", placement: "panel", panel, ...extra });

  test("heading and icon are kept on panel components", () => {
    const { components, errors, warnings } = run([panelEntry({ heading: "Start over", icon: "reset" })]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(components[0].panel).toEqual({ heading: "Start over", icon: "reset" });
  });

  test("panel is optional; omitted means type defaults", () => {
    const { components } = run([{ id: "h", type: "home", placement: "panel" }]);
    expect(components[0]).not.toHaveProperty("panel");
  });

  test("Wrong type: heading must be a non-empty string", () => {
    const { paths } = run([panelEntry({ heading: 5 })]);
    expect(paths).toEqual(["components[0].panel.heading"]);
    expect(run([panelEntry({ heading: " " })]).paths).toEqual(["components[0].panel.heading"]);
  });

  test("icon must be a non-empty string; panel must be an object", () => {
    expect(run([panelEntry({ icon: 3 })]).paths).toEqual(["components[0].panel.icon"]);
    expect(run([panelEntry("Legend")]).paths).toEqual(["components[0].panel"]);
  });

  test("Panel settings on a corner component: ignored with one warning", () => {
    const { components, errors, warnings } = run([panelEntry({ heading: "Home" }, { placement: "top-right" })]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([{ path: "components[0].panel", message: 'Only used when placement is "panel"; it is ignored.' }]);
    expect(components[0]).not.toHaveProperty("panel");
  });

  test("panel settings apply to the default placement too", () => {
    const { components, warnings } = run([{ id: "h", type: "home", panel: { heading: "Home view" } }]);
    expect(warnings).toEqual([]);
    expect(components[0]).toMatchObject({ placement: "panel", panel: { heading: "Home view" } });
  });

  test("unknown keys inside panel warn", () => {
    expect(run([panelEntry({ title: "x" })]).warnings.map((w) => w.path)).toEqual(["components[0].panel.title"]);
  });
});

describe("legend and layer-info[] (P-33)", () => {
  const legend = (options: Record<string, unknown>) => ({ id: "legend", type: "legend", options });

  test("legend is registered, defaults to a panel, and keeps valid layerInfos", () => {
    const { components, errors } = run([legend({ layerInfos: [{ layer: "parcels", title: "Parcels" }, { layer: "roads" }] })]);
    expect(errors).toEqual([]);
    expect(components[0]).toMatchObject({
      type: "legend",
      placement: "panel",
      options: { layerInfos: [{ layer: "parcels", title: "Parcels" }, { layer: "roads" }] },
    });
  });

  test("Unknown layer: error at layerInfos[i].layer naming the id", () => {
    const { paths, errors } = run([legend({ layerInfos: [{ layer: "nope" }] })]);
    expect(paths).toEqual(["components[0].options.layerInfos[0].layer"]);
    expect(errors[0].message).toContain('"nope" is not a configured layer');
  });

  test("title must be a string; entries must be objects; the option must be an array", () => {
    expect(run([legend({ layerInfos: [{ layer: "roads", title: 7 }] })]).paths).toEqual(["components[0].options.layerInfos[0].title"]);
    expect(run([legend({ layerInfos: ["roads"] })]).paths).toEqual(["components[0].options.layerInfos[0]"]);
    expect(run([legend({ layerInfos: { layer: "roads" } })]).paths).toEqual(["components[0].options.layerInfos"]);
  });

  test("boolean legend options are checked", () => {
    expect(run([legend({ basemapLegendVisible: true, hideLayersNotInCurrentView: false })]).errors).toEqual([]);
    expect(run([legend({ basemapLegendVisible: "yes" })]).paths).toEqual(["components[0].options.basemapLegendVisible"]);
  });

  test("every registered type has panel defaults", () => {
    for (const [name, type] of Object.entries(COMPONENT_TYPES)) {
      expect(type.panel.heading, name).not.toBe("");
      expect(type.panel.icon, name).not.toBe("");
    }
  });
});
