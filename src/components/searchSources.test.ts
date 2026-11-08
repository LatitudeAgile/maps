import { describe, expect, test } from "vitest";
import { DEFAULT_GEOCODER_URL } from "./geocoder.ts";
import { buildSearchSources } from "./searchSources.ts";

const COUNTY = { url: "https://gis.example.org/arcgis/rest/services/Addresses/GeocodeServer", name: "County addresses", placeholder: "County address" };
const PLACES = { radius: 2000, categories: [], name: "Places" };
/** Stands in for the Places module, so no SDK widget loads in Vitest. */
const fakePlaces = async () => ({ createPlacesSource: (s: { name: string }, key: string) => ({ places: s.name, key }) }) as never;

describe("shared search sources (geocoding spec, design D16)", () => {
  test("world geocoder only, when there is no geocoding section", async () => {
    const sources = await buildSearchSources(DEFAULT_GEOCODER_URL, undefined, "KEY", fakePlaces);
    expect(sources).toEqual([expect.objectContaining({ url: DEFAULT_GEOCODER_URL, name: "ArcGIS World Geocoding Service" })]);
  });

  test("order: world geocoder, additional geocoders, then Places; no key on any geocoder", async () => {
    const sources = await buildSearchSources(DEFAULT_GEOCODER_URL, { geocoders: [COUNTY], places: PLACES }, "KEY", fakePlaces);
    expect(sources).toEqual([
      expect.objectContaining({ url: DEFAULT_GEOCODER_URL }),
      expect.objectContaining({ url: COUNTY.url, name: "County addresses", placeholder: "County address" }),
      { places: "Places", key: "KEY" },
    ]);
    expect(JSON.stringify(sources.slice(0, 2))).not.toContain("KEY");
  });

  test("no Places without a key", async () => {
    const sources = await buildSearchSources(DEFAULT_GEOCODER_URL, { geocoders: [], places: PLACES }, undefined, fakePlaces);
    expect(sources).toHaveLength(1);
  });
});
