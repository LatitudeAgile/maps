import { describe, expect, test } from "vitest";
import { validateLayers } from "./layers.ts";
import type { ConfigProblem } from "./types.ts";
import { validateConfig } from "./validate.ts";

const CONFIG_URL = "https://viewer.example.org/config/viewer.json";

function run(raw: unknown, hookNames: string[] = []) {
  const errors: ConfigProblem[] = [];
  const warnings: ConfigProblem[] = [];
  const layers = validateLayers(raw, { hookNames, configUrl: CONFIG_URL }, errors, warnings);
  return { layers, errors, warnings, paths: errors.map((e) => e.path) };
}

const feature = (extra: Record<string, unknown> = {}) => ({
  id: "parcels",
  type: "feature",
  url: "https://services.example.com/arcgis/rest/services/Parcels/FeatureServer/0",
  ...extra,
});

describe("layer entry validation", () => {
  test("a valid entry passes with defaults for options and hooks", () => {
    const { layers, errors, warnings } = run([feature({ title: "Parcels", opacity: 0.5, visible: false })]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(layers).toEqual([
      {
        id: "parcels",
        type: "feature",
        url: "https://services.example.com/arcgis/rest/services/Parcels/FeatureServer/0",
        title: "Parcels",
        opacity: 0.5,
        visible: false,
        options: {},
        hooks: {},
      },
    ]);
  });

  test("Duplicate ID: second entry's id is reported as not unique", () => {
    const { paths, errors } = run([feature(), feature()]);
    expect(paths).toEqual(["layers[1].id"]);
    expect(errors[0].message).toMatch(/unique/);
  });

  test("Unknown type: lists the supported types", () => {
    const { paths, errors } = run([feature({ type: "kml" })]);
    expect(paths).toEqual(["layers[0].type"]);
    for (const t of ["feature", "map-image", "vector-tile", "tile", "geojson", "imagery"]) {
      expect(errors[0].message).toContain(t);
    }
  });

  test("Source missing or doubled: exactly one of url or portalItem", () => {
    const both = run([feature({ portalItem: { id: "a".repeat(32) } })]);
    const neither = run([{ id: "x", type: "feature" }]);
    for (const r of [both, neither]) {
      expect(r.paths).toEqual(["layers[0]"]);
      expect(r.errors[0].message).toBe("Set exactly one of url or portalItem.");
    }
  });

  test("portal item source is accepted with a 32-character ID", () => {
    const id = "0123456789abcdef0123456789abcdef";
    const { layers, errors } = run([{ id: "x", type: "vector-tile", portalItem: { id } }]);
    expect(errors).toEqual([]);
    expect(layers[0].portalItem).toEqual({ id });
    expect(run([{ id: "x", type: "tile", portalItem: { id: "short" } }]).paths).toEqual(["layers[0].portalItem.id"]);
  });

  test("Insecure URL: http feature layer is rejected", () => {
    const { paths, errors } = run([feature({ url: "http://services.example.com/fs/0" })]);
    expect(paths).toEqual(["layers[0].url"]);
    expect(errors[0].message).toBe("Expected an absolute https URL.");
  });

  test("relative URLs are rejected for non-GeoJSON types", () => {
    expect(run([feature({ url: "data/parcels" })]).paths).toEqual(["layers[0].url"]);
  });

  test("Relative GeoJSON URL: resolved against the config file's location", () => {
    const { layers, errors } = run([{ id: "sites", type: "geojson", url: "data/sites.geojson" }]);
    expect(errors).toEqual([]);
    expect(layers[0].url).toBe("https://viewer.example.org/config/data/sites.geojson");
  });

  test("protocol-relative GeoJSON URL is rejected", () => {
    expect(run([{ id: "s", type: "geojson", url: "//evil.example.com/x.geojson" }]).paths).toEqual(["layers[0].url"]);
  });

  test("Out-of-range opacity", () => {
    const { paths, errors } = run([feature({ opacity: 2 })]);
    expect(paths).toEqual(["layers[0].opacity"]);
    expect(errors[0].message).toBe("Expected a number between 0 and 1.");
  });

  test("wrong types for visible, popupEnabled, title, and options", () => {
    const { paths } = run([feature({ visible: "yes", popupEnabled: 1, title: "", options: [] })]);
    expect(paths.sort()).toEqual(["layers[0].options", "layers[0].popupEnabled", "layers[0].title", "layers[0].visible"]);
  });

  test("Unknown hook name: lists the available hooks", () => {
    const { paths, errors } = run([feature({ hooks: { onLoad: "noSuchHook" } })], ["labelParcels"]);
    expect(paths).toEqual(["layers[0].hooks.onLoad"]);
    expect(errors[0].message).toContain("labelParcels");
  });

  test("with no hooks registered, the message says none are available", () => {
    const { errors } = run([feature({ hooks: { preLoad: "x" } })]);
    expect(errors[0].message).toContain("none");
  });

  test("known hook names are kept", () => {
    const { layers } = run([feature({ hooks: { preLoad: "a", onLoad: "b" } })], ["a", "b"]);
    expect(layers[0].hooks).toEqual({ preLoad: "a", onLoad: "b" });
  });

  test("unknown keys in an entry warn, naming the path", () => {
    const { warnings, errors } = run([feature({ colour: "red", hooks: {} })]);
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.path)).toEqual(["layers[0].colour"]);
  });

  test("invalid id is reported", () => {
    expect(run([feature({ id: "has space" })]).paths).toEqual(["layers[0].id"]);
  });

  test("non-array section and non-object entry", () => {
    expect(run({}).paths).toEqual(["layers"]);
    expect(run(["x"]).paths).toEqual(["layers[0]"]);
  });
});

describe("validateConfig with layers", () => {
  const base = { map: { basemap: "osm", center: [0, 0], scale: 1e6 } };

  test("an invalid layer stops startup like any other invalid setting", () => {
    const { config, errors } = validateConfig({ ...base, layers: [feature({ opacity: 2 })] });
    expect(config).toBeUndefined();
    expect(errors.map((e) => e.path)).toEqual(["layers[0].opacity"]);
  });

  test("valid layers are carried on the config, with relative GeoJSON resolved", () => {
    const { config } = validateConfig(
      { ...base, layers: [{ id: "s", type: "geojson", url: "sites.geojson" }] },
      { configUrl: CONFIG_URL },
    );
    expect(config?.layers[0].url).toBe("https://viewer.example.org/config/sites.geojson");
  });
});
