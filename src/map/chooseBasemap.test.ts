import { describe, expect, test } from "vitest";
import { chooseBasemap } from "./chooseBasemap.ts";

const config = (basemap: string, fallbackBasemap = "osm") => ({
  map: { basemap, fallbackBasemap, center: [0, 0] as [number, number], zoom: 5 },
});

describe("chooseBasemap", () => {
  test("no key + arcgis/streets falls back to the fallback basemap", () => {
    expect(chooseBasemap(config("arcgis/streets"), false)).toEqual({ basemap: "osm", fellBack: true });
  });

  test("no key + multi-segment style ID also falls back", () => {
    expect(chooseBasemap(config("arcgis/imagery/standard"), false).fellBack).toBe(true);
    expect(chooseBasemap(config("osm/standard"), false).fellBack).toBe(true);
  });

  test("key present uses the configured basemap", () => {
    expect(chooseBasemap(config("arcgis/streets"), true)).toEqual({
      basemap: "arcgis/streets",
      fellBack: false,
    });
  });

  test("osm configured needs no credential: no fallback", () => {
    expect(chooseBasemap(config("osm"), false)).toEqual({ basemap: "osm", fellBack: false });
  });
});
