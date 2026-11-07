import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { DEFAULTS } from "./types.ts";
import { validateConfig } from "./validate.ts";

const minimal = () => ({
  map: { basemap: "arcgis/streets", center: [-98.579404, 39.828127], zoom: 5 },
});

const paths = (problems: { path: string }[]) => problems.map((p) => p.path);

describe("defaults", () => {
  test("Minimal config: default title, portal URL, and fallback basemap", () => {
    const { config, errors, warnings } = validateConfig(minimal());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config?.app.title).toBe("ArcGIS Sidebar Viewer");
    expect(config?.portal.url).toBe("https://www.arcgis.com");
    expect(config?.map.fallbackBasemap).toBe("osm");
    expect(config?.app.title).toBe(DEFAULTS.app.title);
    expect(config?.map).toMatchObject(minimal().map);
    expect(config?.services).toEqual({});
    expect(config?.layers).toEqual([]);
    expect(config?.components).toEqual([]);
  });

  test("configured values override defaults", () => {
    const raw = {
      ...minimal(),
      app: { title: "County Viewer" },
      portal: { url: "https://gis.example.org/portal/" },
    };
    const { config } = validateConfig(raw);
    expect(config?.app.title).toBe("County Viewer");
    expect(config?.portal.url).toBe("https://gis.example.org/portal");
  });
});

describe("validation errors", () => {
  test("Out-of-range coordinate names map.center[1] as a latitude", () => {
    const raw = minimal();
    raw.map.center = [-98.5, 120];
    const { config, errors } = validateConfig(raw);
    expect(config).toBeUndefined();
    expect(errors).toEqual([
      { path: "map.center[1]", message: "Expected a latitude between -90 and 90." },
    ]);
  });

  test("out-of-range longitude names map.center[0]", () => {
    const raw = minimal();
    raw.map.center = [200, 10];
    expect(paths(validateConfig(raw).errors)).toEqual(["map.center[0]"]);
  });

  test("center that is not a pair is reported on map.center", () => {
    const raw = { map: { ...minimal().map, center: [1, 2, 3] } };
    expect(paths(validateConfig(raw).errors)).toEqual(["map.center"]);
  });

  test("Wrong type: map.zoom as a string must be a number 0 or greater", () => {
    const raw = { map: { ...minimal().map, zoom: "five" } };
    const { config, errors } = validateConfig(raw);
    expect(config).toBeUndefined();
    expect(errors).toEqual([{ path: "map.zoom", message: "Expected a number 0 or greater." }]);
  });

  test("negative zoom is rejected", () => {
    const raw = { map: { ...minimal().map, zoom: -1 } };
    expect(paths(validateConfig(raw).errors)).toEqual(["map.zoom"]);
  });

  test("Multiple problems are reported together", () => {
    const raw = {
      portal: { url: "http://www.arcgis.com" },
      map: { ...minimal().map, basemap: "" },
    };
    const { config, errors } = validateConfig(raw);
    expect(config).toBeUndefined();
    expect(paths(errors).sort()).toEqual(["map.basemap", "portal.url"]);
    expect(errors.find((e) => e.path === "portal.url")?.message).toMatch(/absolute https URL/);
  });

  test("relative portal URL is rejected", () => {
    const raw = { ...minimal(), portal: { url: "/portal" } };
    expect(paths(validateConfig(raw).errors)).toEqual(["portal.url"]);
  });

  test("missing map section is an error", () => {
    expect(paths(validateConfig({}).errors)).toEqual(["map"]);
  });

  test("non-object config is an error", () => {
    expect(paths(validateConfig([]).errors)).toEqual(["(root)"]);
    expect(paths(validateConfig(null).errors)).toEqual(["(root)"]);
  });

  test("section of the wrong type is reported by its name", () => {
    const raw = { ...minimal(), app: "My App" };
    expect(paths(validateConfig(raw).errors)).toEqual(["app"]);
  });

  test("fallback basemap that needs a key is rejected", () => {
    const raw = { map: { ...minimal().map, fallbackBasemap: "arcgis/topographic" } };
    expect(paths(validateConfig(raw).errors)).toEqual(["map.fallbackBasemap"]);
  });

  test("service URLs must be absolute https", () => {
    const ok = validateConfig({ ...minimal(), services: { routing: "https://route.example.com/x" } });
    expect(ok.config?.services).toEqual({ routing: "https://route.example.com/x" });
    const bad = validateConfig({ ...minimal(), services: { routing: "ftp://x" } });
    expect(paths(bad.errors)).toEqual(["services.routing"]);
  });
});

describe("initial view: zoom or scale", () => {
  const withView = (view: Record<string, unknown>) => ({
    map: { basemap: "arcgis/streets", center: [-98.579404, 39.828127], ...view },
  });

  test("Scale instead of zoom: valid, and the config carries scale only", () => {
    const { config, errors } = validateConfig(withView({ scale: 18489298 }));
    expect(errors).toEqual([]);
    expect(config?.map.scale).toBe(18489298);
    expect(config?.map).not.toHaveProperty("zoom");
  });

  test("zoom only: the config carries zoom only", () => {
    const { config } = validateConfig(withView({ zoom: 5 }));
    expect(config?.map.zoom).toBe(5);
    expect(config?.map).not.toHaveProperty("scale");
  });

  test("Both set: error at map says to set one, not both", () => {
    const { config, errors } = validateConfig(withView({ zoom: 5, scale: 18489298 }));
    expect(config).toBeUndefined();
    expect(errors).toEqual([{ path: "map", message: "Set either map.zoom or map.scale, not both." }]);
  });

  test("Neither set: error at map says zoom or scale is required", () => {
    const { config, errors } = validateConfig(withView({}));
    expect(config).toBeUndefined();
    expect(errors).toEqual([{ path: "map", message: "Required: map.zoom or map.scale." }]);
  });

  test.each([0, -100, "big", Number.NaN])("Invalid scale %s: names map.scale as greater than 0", (scale) => {
    const { config, errors } = validateConfig(withView({ scale }));
    expect(config).toBeUndefined();
    expect(errors).toEqual([{ path: "map.scale", message: "Expected a number greater than 0." }]);
  });
});

describe("credentials", () => {
  const secret = "AAPK-super-secret-value-123";

  test("API key placed in config fails, names portal.apiKey, and does not echo the value", () => {
    const raw = { ...minimal(), portal: { apiKey: secret } };
    const { config, errors } = validateConfig(raw);
    expect(config).toBeUndefined();
    expect(paths(errors)).toEqual(["portal.apiKey"]);
    expect(errors[0].message).toMatch(/VITE_ARCGIS_API_KEY/);
    expect(errors[0].message).toMatch(/build environment/);
    expect(JSON.stringify(errors)).not.toContain(secret);
  });

  test("credential keys are found at any depth, including in arrays", () => {
    const raw = {
      ...minimal(),
      token: secret,
      services: { clientSecret: secret },
      layers: [{ id: "a", type: "feature", url: "https://x.example.com/fs/0", options: { token: secret } }],
      components: [{ id: "h", type: "home", placement: "top-left", apikey: secret }],
    };
    const { errors, warnings } = validateConfig(raw);
    expect(paths(errors).sort()).toEqual(
      ["layers[0].options.token", "services.clientSecret", "token", "components[0].apikey"].sort(),
    );
    expect(JSON.stringify({ errors, warnings })).not.toContain(secret);
    // A top-level credential key is reported as an error, not also as an unknown setting.
    expect(warnings).toEqual([]);
  });
});

describe("tolerated and unknown settings", () => {
  test("All recognized settings present: no warnings", () => {
    const { config, errors, warnings } = validateConfig({
      ...minimal(),
      app: { title: "T" },
      portal: { url: "https://www.arcgis.com" },
      services: {},
      layers: [],
      components: [],
      debug: false,
      request: { proxyRules: [] },
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config).toBeDefined();
  });

  test("layers and components must be arrays", () => {
    const { errors } = validateConfig({ ...minimal(), layers: {} });
    expect(paths(errors)).toEqual(["layers"]);
  });

  test("debug defaults to false and accepts true", () => {
    expect(validateConfig(minimal()).config?.debug).toBe(false);
    expect(validateConfig({ ...minimal(), debug: true }).config?.debug).toBe(true);
  });

  test("Wrong type: debug must be true or false", () => {
    const { config, errors } = validateConfig({ ...minimal(), debug: "yes" });
    expect(config).toBeUndefined();
    expect(errors).toEqual([{ path: "debug", message: "Expected true or false." }]);
  });

  test("Unknown top-level setting produces one warning naming it", () => {
    const { config, errors, warnings } = validateConfig({ ...minimal(), colour: "blue" });
    expect(errors).toEqual([]);
    expect(config).toBeDefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe("colour");
  });

  test("legacy basemap ID warns and suggests the provider/style equivalent", () => {
    const raw = { map: { ...minimal().map, basemap: "streets-vector" } };
    const { config, errors, warnings } = validateConfig(raw);
    expect(errors).toEqual([]);
    expect(config?.map.basemap).toBe("streets-vector");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe("map.basemap");
    expect(warnings[0].message).toMatch(/legacy/);
    expect(warnings[0].message).toContain("arcgis/streets");
  });

  test("osm is not treated as legacy", () => {
    const raw = { map: { ...minimal().map, basemap: "osm" } };
    expect(validateConfig(raw).warnings).toEqual([]);
  });
});

describe("shipped default config", () => {
  test("public/config/viewer.json is valid with no warnings", () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../../public/config/viewer.json", import.meta.url), "utf8"),
    );
    const { config, errors, warnings } = validateConfig(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config?.map).toEqual({
      basemap: "arcgis/streets",
      fallbackBasemap: "osm",
      center: [-98.579404, 39.828127],
      scale: 18489298,
    });
    expect(config?.components).toEqual([
      { id: "home", type: "home", placement: "top-left", options: {} },
      // Placement omitted in the file: defaults to a sidebar panel.
      { id: "legend", type: "legend", placement: "panel", options: {} },
    ]);
    expect(config?.layers.map((l) => [l.id, l.type])).toEqual([["usa", "map-image"]]);
  });
});
