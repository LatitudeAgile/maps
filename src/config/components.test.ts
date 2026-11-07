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

  test("placement is required", () => {
    expect(run([{ id: "h", type: "home" }]).paths).toEqual(["components[0].placement"]);
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
