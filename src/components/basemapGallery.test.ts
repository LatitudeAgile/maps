import { describe, expect, test } from "vitest";
import { basemapGalleryKeyless, galleryBasemap, galleryBasemapNeedsKey } from "./basemapGallery.ts";

describe("basemap gallery (design D5)", () => {
  test("style IDs, and legacy IDs that map to them, need a key; free IDs don't", () => {
    for (const id of ["arcgis/streets", "arcgis/imagery", "streets-vector", "topo"]) expect(galleryBasemapNeedsKey(id)).toBe(true);
    for (const id of ["osm", "hybrid", "satellite", "light", "dark"]) expect(galleryBasemapNeedsKey(id)).toBe(false);
  });

  test("without a key, only the free basemaps are kept; with none left, the gallery is left out", () => {
    expect(basemapGalleryKeyless({ basemaps: ["osm", "arcgis/streets", "light", "topo"] })).toEqual({ keep: { basemaps: ["osm", "light"] } });
    expect(basemapGalleryKeyless({ basemaps: ["arcgis/streets"] })).toEqual({
      leaveOut: "none of the basemap gallery's basemaps work without an API key",
    });
  });

  test("entries: free IDs are the built-in basemaps; style IDs keep their style", () => {
    expect(galleryBasemap("light").title).toBe("Light gray");
    expect(galleryBasemap("arcgis/topographic").style?.id).toBe("arcgis/topographic");
    expect(galleryBasemap("topo").style?.id).toBe("arcgis/topographic");
  });
});
