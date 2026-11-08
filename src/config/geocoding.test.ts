import { describe, expect, test } from "vitest";
import { validateConfig } from "./validate.ts";

const minimal = () => ({ map: { basemap: "osm", center: [-98.5, 39.8], zoom: 5 } });
const withGeocoding = (geocoding: unknown) => validateConfig({ ...minimal(), geocoding });
const paths = (problems: { path: string }[]) => problems.map((p) => p.path);
const COUNTY = "https://gis.example.org/arcgis/rest/services/Addresses/GeocodeServer";

describe("geocoding section (geocoding spec)", () => {
  test("absent: no extra geocoders and no Places", () => {
    expect(validateConfig(minimal()).config?.geocoding).toEqual({ geocoders: [] });
  });

  test("Valid section: geocoders kept in order, Places defaults filled", () => {
    const { config, errors, warnings } = withGeocoding({ geocoders: [{ url: COUNTY, name: "County addresses" }], places: { radius: 2000 } });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config?.geocoding).toEqual({
      geocoders: [{ url: COUNTY, name: "County addresses" }],
      places: { radius: 2000, categories: [], name: "Places" },
    });
  });

  test("Places with no settings: radius 5000, any category", () => {
    expect(withGeocoding({ places: {} }).config?.geocoding.places).toEqual({ radius: 5000, categories: [], name: "Places" });
  });

  test("Geocoder without a name", () => {
    expect(paths(withGeocoding({ geocoders: [{ url: COUNTY }] }).errors)).toEqual(["geocoding.geocoders[0].name"]);
  });

  test("Geocoder URL must be https", () => {
    expect(paths(withGeocoding({ geocoders: [{ url: "http://gis.example.org/GeocodeServer", name: "x" }] }).errors)).toEqual(["geocoding.geocoders[0].url"]);
  });

  test.each([20000, 0, 1.5, "5000"])("Radius out of range: %j", (radius) => {
    const { errors } = withGeocoding({ places: { radius } });
    expect(paths(errors)).toEqual(["geocoding.places.radius"]);
    expect(errors[0].message).toContain("whole number from 1 to 10000");
  });

  test("Too many categories", () => {
    const categories = Array.from({ length: 11 }, (_, i) => `cat${i}`);
    const { errors } = withGeocoding({ places: { categories } });
    expect(paths(errors)).toEqual(["geocoding.places.categories"]);
    expect(errors[0].message).toContain("At most 10");
  });

  test("unknown keys are warned about, not fatal", () => {
    const { errors, warnings } = withGeocoding({ geocoders: [], places: { radius: 100, colour: "red" }, extra: 1 });
    expect(errors).toEqual([]);
    expect(paths(warnings).sort()).toEqual(["geocoding.extra", "geocoding.places.colour"]);
  });

  test("not an object", () => {
    expect(paths(withGeocoding([]).errors)).toEqual(["geocoding"]);
  });
});
