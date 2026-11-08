import { describe, expect, test } from "vitest";
import type WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import { FREE_BASEMAP_IDS, freeBasemap, resolveBasemap } from "./freeBasemaps.ts";
import { isBasemapStyleId, LEGACY_BASEMAP_IDS } from "./basemapIds.ts";

const host = (template: string) => new URL(template.replace(/\{[a-z]+\}/g, "0")).host;

describe("built-in free basemaps (design D4)", () => {
  test("Hybrid layers: one imagery base layer and two reference layers on services.arcgisonline.com", () => {
    const basemap = freeBasemap("hybrid");
    expect(basemap).toBeDefined();
    expect(basemap!.id).toBe("hybrid");
    expect(basemap!.title).toBe("Satellite + roads");
    expect(basemap!.thumbnailUrl).toBe(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/6/3",
    );

    const base = basemap!.baseLayers.toArray() as WebTileLayer[];
    const reference = basemap!.referenceLayers.toArray() as WebTileLayer[];
    expect(base).toHaveLength(1);
    expect(reference).toHaveLength(2);
    expect(base[0].urlTemplate).toContain("/World_Imagery/MapServer/tile/{level}/{row}/{col}");
    expect(reference.map((l) => l.urlTemplate)).toEqual([
      expect.stringContaining("/Reference/World_Transportation/MapServer/tile/"),
      expect.stringContaining("/Reference/World_Boundaries_and_Places/MapServer/tile/"),
    ]);
    for (const layer of [...base, ...reference]) {
      expect(layer.type).toBe("web-tile");
      expect(host(layer.urlTemplate!)).toBe("services.arcgisonline.com");
      expect(layer.copyright).toBeTruthy();
    }
  });

  test("Free basemap layers: satellite, light, and dark", () => {
    const layers = (id: string) => {
      const b = freeBasemap(id)!;
      return { b, base: b.baseLayers.toArray() as WebTileLayer[], reference: b.referenceLayers.toArray() as WebTileLayer[] };
    };
    const satellite = layers("satellite");
    expect([satellite.base.length, satellite.reference.length]).toEqual([1, 0]);
    expect(satellite.base[0].urlTemplate).toContain("/World_Imagery/MapServer/tile/");
    for (const [id, service] of [["light", "Light_Gray"], ["dark", "Dark_Gray"]]) {
      const { base, reference } = layers(id);
      expect([base.length, reference.length]).toEqual([1, 1]);
      expect(base[0].urlTemplate).toContain(`/Canvas/World_${service}_Base/MapServer/tile/`);
      expect(reference[0].urlTemplate).toContain(`/Canvas/World_${service}_Reference/MapServer/tile/`);
    }
    for (const id of ["satellite", "light", "dark"]) {
      const { b, base, reference } = layers(id);
      expect(b.id).toBe(id);
      expect(b.title).toBeTruthy();
      expect(b.thumbnailUrl).toMatch(/^https:\/\/services\.arcgisonline\.com\/.*\/MapServer\/tile\/4\/6\/3$/);
      for (const layer of [...base, ...reference]) {
        expect(layer.type).toBe("web-tile");
        expect(host(layer.urlTemplate!)).toBe("services.arcgisonline.com");
        expect(layer.copyright).toBeTruthy();
      }
    }
    expect(FREE_BASEMAP_IDS).toEqual(["hybrid", "satellite", "light", "dark"]);
  });

  test("each call returns a new basemap, so the map and a toggle never share one", () => {
    expect(freeBasemap("hybrid")).not.toBe(freeBasemap("hybrid"));
  });

  test("other IDs are passed through to the SDK unchanged", () => {
    expect(freeBasemap("osm")).toBeUndefined();
    expect(resolveBasemap("osm")).toBe("osm");
    expect(resolveBasemap("arcgis/streets")).toBe("arcgis/streets");
    expect(typeof resolveBasemap("hybrid")).toBe("object");
  });

  test("free basemap IDs are neither legacy IDs nor basemap styles IDs", () => {
    for (const id of FREE_BASEMAP_IDS) {
      expect(Object.hasOwn(LEGACY_BASEMAP_IDS, id)).toBe(false);
      expect(isBasemapStyleId(id)).toBe(false);
    }
  });
});
