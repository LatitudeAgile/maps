import Viewpoint from "@arcgis/core/Viewpoint.js";
import { describe, expect, test } from "vitest";
import { AppModel } from "./AppModel.ts";
import { ErrorChannel } from "./errors.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("AppModel lookups", () => {
  test("Unknown ID: getLayer and getComponent return undefined without throwing", () => {
    const app = new AppModel();
    expect(app.getLayer("nope")).toBeUndefined();
    expect(app.getComponent("nope")).toBeUndefined();
  });

  test("registered records are returned by config id", () => {
    const app = new AppModel();
    const entry = { id: "parcels", type: "geojson" as const, options: {}, hooks: {} };
    const layer = { id: "parcels" } as never;
    app.addLayer({ entry, layer });
    expect(app.getLayer("parcels")).toEqual({ entry, layer });
    expect(app.layers).toHaveLength(1);
  });

  test("view state is undefined before the map exists", () => {
    const app = new AppModel();
    expect([app.extent, app.center, app.zoom, app.scale]).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe("AppModel.watch over a real Accessor (design D7)", () => {
  test("a getter over an Accessor property is tracked", async () => {
    // Viewpoint is an Accessor with a reactive `scale`, standing in for the MapView.
    const viewpoint = new Viewpoint({ scale: 1000 });
    const app = new AppModel();
    app.view = viewpoint as never;
    const seen: (number | undefined)[] = [];
    const handle = app.watch("scale", (scale) => seen.push(scale));
    viewpoint.scale = 2000;
    await tick();
    handle.remove();
    viewpoint.scale = 3000;
    await tick();
    expect(seen).toEqual([2000]);
    expect(app.scale).toBe(3000);
  });
});

describe("ErrorChannel", () => {
  test("subscribers receive source and message", () => {
    const channel = new ErrorChannel();
    const seen: unknown[] = [];
    channel.subscribe((r) => seen.push(r));
    channel.report({ source: "layer:parcels", message: "Failed to load" });
    expect(seen).toEqual([{ source: "layer:parcels", message: "Failed to load" }]);
  });

  test("unsubscribe stops delivery", () => {
    const channel = new ErrorChannel();
    const seen: unknown[] = [];
    const unsubscribe = channel.subscribe((r) => seen.push(r));
    unsubscribe();
    channel.report({ source: "map", message: "x" });
    expect(seen).toEqual([]);
  });

  test("the API key is redacted, plain and URL-encoded, before subscribers see it", () => {
    const key = "AAPT+secret/key=";
    const channel = new ErrorChannel([key]);
    const seen: { message: string; detail?: string }[] = [];
    channel.subscribe((r) => seen.push(r));
    channel.report({
      source: "layer:x",
      message: `Request failed: https://x.example.com/q?token=${key}`,
      detail: `https://x.example.com/q?token=${encodeURIComponent(key)}`,
    });
    expect(JSON.stringify(seen)).not.toContain(key);
    expect(JSON.stringify(seen)).not.toContain(encodeURIComponent(key));
    expect(seen[0].message).toContain("[redacted]");
    expect(seen[0].detail).toContain("[redacted]");
  });

  test("a throwing subscriber does not stop the others", () => {
    const channel = new ErrorChannel();
    const seen: unknown[] = [];
    channel.subscribe(() => {
      throw new Error("boom");
    });
    channel.subscribe((r) => seen.push(r));
    expect(() => channel.report({ source: "map", message: "x" })).not.toThrow();
    expect(seen).toHaveLength(1);
  });
});
