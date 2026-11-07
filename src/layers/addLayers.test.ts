import type Layer from "@arcgis/core/layers/Layer.js";
import { describe, expect, test } from "vitest";
import { AppModel } from "../app/AppModel.ts";
import type { ErrorReport } from "../app/errors.ts";
import type { LayerConfig } from "../config/types.ts";
import type { LayerHook } from "../extensions/hooks.ts";
import { addLayers } from "./addLayers.ts";

/** A fake layer whose load() is controlled by the test. */
function fakeLayer(id: string, events: string[]) {
  let resolveLoad!: () => void;
  let rejectLoad!: (err: Error) => void;
  const loaded = new Promise<void>((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });
  const layer = {
    id,
    loadStatus: "not-loaded",
    load: () => {
      events.push(`load:${id}`);
      return loaded.then(() => {
        layer.loadStatus = "loaded";
        return layer;
      });
    },
  };
  return { layer: layer as unknown as Layer, resolveLoad, rejectLoad };
}

const entry = (id: string, hooks: LayerConfig["hooks"] = {}): LayerConfig => ({
  id,
  type: "geojson",
  url: `https://x.example.com/${id}.geojson`,
  options: {},
  hooks,
});

function setup(ids: string[], hooks: Record<string, LayerHook> = {}, entryHooks: Record<string, LayerConfig["hooks"]> = {}) {
  const events: string[] = [];
  const fakes = new Map(ids.map((id) => [id, fakeLayer(id, events)]));
  const added: string[][] = [];
  const map = {
    addMany: (layers: Layer[]) => {
      added.push(layers.map((l) => l.id));
      events.push(`addMany:${layers.map((l) => l.id).join(",")}`);
    },
  };
  const app = new AppModel();
  const reports: ErrorReport[] = [];
  app.errors.subscribe((r) => reports.push(r));
  const run = (settleTimeoutMs = 1_000) =>
    addLayers({
      entries: ids.map((id) => entry(id, entryHooks[id])),
      map,
      app,
      hooks,
      settleTimeoutMs,
      create: async (e) => fakes.get(e.id)!.layer,
    });
  return { events, fakes, added, app, reports, run };
}

describe("draw order", () => {
  test("layers are added in reverse so the first entry draws on top", async () => {
    const s = setup(["roads", "parcels"]);
    const done = s.run();
    for (const f of s.fakes.values()) f.resolveLoad();
    await done;
    expect(s.added).toEqual([["parcels", "roads"]]);
    expect(s.app.getLayer("roads")?.layer.id).toBe("roads");
  });
});

describe("hooks", () => {
  test("Hooks run in order: preLoad before the layer is on the map, onLoad once after load", async () => {
    const seen: string[] = [];
    const s = setup(
      ["parcels"],
      {
        before: (layer, ctx) => {
          seen.push(`preLoad:${layer.id}:${ctx.entry.id}`);
          s.events.push("preLoad");
        },
        after: (layer) => {
          seen.push(`onLoad:${layer.id}:${(layer as unknown as { loadStatus: string }).loadStatus}`);
          s.events.push("onLoad");
        },
      },
      { parcels: { preLoad: "before", onLoad: "after" } },
    );
    const done = s.run();
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(["preLoad:parcels:parcels"]); // onLoad must wait for the load
    s.fakes.get("parcels")!.resolveLoad();
    await done;
    expect(seen).toEqual(["preLoad:parcels:parcels", "onLoad:parcels:loaded"]);
    expect(s.events.indexOf("preLoad")).toBeLessThan(s.events.indexOf("addMany:parcels"));
    expect(s.events.filter((e) => e === "onLoad")).toHaveLength(1);
  });

  test("Hook throws: the layer stays, the viewer continues, and the error names the layer", async () => {
    const s = setup(["parcels"], { boom: () => Promise.reject(new Error("bad hook")) }, { parcels: { onLoad: "boom" } });
    const done = s.run();
    s.fakes.get("parcels")!.resolveLoad();
    const result = await done;
    expect(result.failed).toEqual([]);
    expect(s.added).toEqual([["parcels"]]);
    expect(s.app.getLayer("parcels")).toBeDefined();
    expect(s.reports).toHaveLength(1);
    expect(s.reports[0].source).toBe("layer:parcels");
    expect(s.reports[0].message).toContain("onLoad");
    expect(s.reports[0].detail).toBe("bad hook");
  });

  test("a throwing preLoad hook still adds the layer", async () => {
    const s = setup(
      ["parcels"],
      {
        boom: () => {
          throw new Error("x");
        },
      },
      { parcels: { preLoad: "boom" } },
    );
    const done = s.run();
    s.fakes.get("parcels")!.resolveLoad();
    await done;
    expect(s.added).toEqual([["parcels"]]);
    expect(s.reports.map((r) => r.source)).toEqual(["layer:parcels"]);
  });
});

describe("settling and failures", () => {
  test("Layer failure reported: one report naming the layer, other layers unaffected", async () => {
    const s = setup(["good", "bad"]);
    const done = s.run();
    s.fakes.get("good")!.resolveLoad();
    s.fakes.get("bad")!.rejectLoad(new Error("HTTP 404"));
    const result = await done;
    expect(result.failed).toEqual(["bad"]);
    expect(s.reports).toEqual([{ source: "layer:bad", message: 'Layer "bad" failed to load.', detail: "HTTP 404" }]);
    expect(s.app.getLayer("good")).toBeDefined();
  });

  test("a layer still pending when waiting stops is reported, and its onLoad still runs later", async () => {
    const onLoads: string[] = [];
    const s = setup(["slow"], { after: (l) => void onLoads.push(l.id) }, { slow: { onLoad: "after" } });
    const result = await s.run(50);
    expect(result.failed).toEqual(["slow"]);
    expect(s.reports[0].message).toMatch(/had not loaded/);
    s.fakes.get("slow")!.resolveLoad();
    await new Promise((r) => setTimeout(r, 10));
    expect(onLoads).toEqual(["slow"]);
  });

  test("a layer that can't be created is reported and skipped", async () => {
    const app = new AppModel();
    const reports: ErrorReport[] = [];
    app.errors.subscribe((r) => reports.push(r));
    const result = await addLayers({
      entries: [entry("x")],
      map: { addMany: () => undefined },
      app,
      create: () => Promise.reject(new Error("import failed")),
    });
    expect(result.failed).toEqual(["x"]);
    expect(reports[0].message).toContain("could not be created");
  });

  test("no layers: resolves at once with nothing failed", async () => {
    const s = setup([]);
    expect(await s.run()).toEqual({ failed: [] });
  });
});
