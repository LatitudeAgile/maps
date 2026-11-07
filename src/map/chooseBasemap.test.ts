import { describe, expect, test } from "vitest";
import type { ComponentConfig } from "../config/types.ts";
import { chooseBasemap, leaveOutKeyedToggles } from "./chooseBasemap.ts";

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

describe("leaveOutKeyedToggles (design D5)", () => {
  const toggle = (id: string, nextBasemap: string): ComponentConfig => ({
    id,
    type: "basemap-toggle",
    placement: "top-right",
    options: { nextBasemap },
  });
  const home: ComponentConfig = { id: "home", type: "home", placement: "top-left", options: {} };

  test("without a key, a toggle to a basemap styles style is left out; others are kept", () => {
    const { kept, leftOut } = leaveOutKeyedToggles(
      [home, toggle("styled", "arcgis/imagery/standard"), toggle("free", "hybrid"), toggle("osm", "osm")],
      false,
    );
    expect(kept.map((c) => c.id)).toEqual(["home", "free", "osm"]);
    expect(leftOut.map((c) => c.id)).toEqual(["styled"]);
  });

  test("with a key, every toggle is kept", () => {
    const { kept, leftOut } = leaveOutKeyedToggles([home, toggle("styled", "arcgis/imagery/standard")], true);
    expect(kept).toHaveLength(2);
    expect(leftOut).toEqual([]);
  });
});
