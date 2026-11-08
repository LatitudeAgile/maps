import { describe, expect, test } from "vitest";
import { addRouteKeyScope, directionsKeyless, directionsSearchProperties, isArcGISRoutingHost } from "./directions.ts";
import { DEFAULT_GEOCODER_URL } from "./geocoder.ts";

const WORLD = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
const SAMPLE = "https://sampleserver6.arcgisonline.com/arcgis/rest/services/NetworkAnalysis/SanDiego/NAServer/Route";

describe("directions (design D4)", () => {
  test("ArcGIS routing hosts are route.arcgis.com and route-api.arcgis.com only", () => {
    expect(isArcGISRoutingHost(WORLD)).toBe(true);
    expect(isArcGISRoutingHost("https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World")).toBe(true);
    expect(isArcGISRoutingHost(SAMPLE)).toBe(false);
    expect(isArcGISRoutingHost("https://route.arcgis.com.example.net/x")).toBe(false);
    expect(isArcGISRoutingHost("https://myroute-api.arcgis.com.evil/x")).toBe(false);
    expect(isArcGISRoutingHost("not a url")).toBe(false);
  });

  test("the key scope is added once per route URL", () => {
    const config = { apiKeys: {} as { scopes?: { token: string; urls: string | RegExp | (string | RegExp)[] }[] } };
    addRouteKeyScope(config, "KEY", WORLD);
    addRouteKeyScope(config, "KEY", WORLD);
    expect(config.apiKeys.scopes).toEqual([{ token: "KEY", urls: [WORLD] }]);
    addRouteKeyScope(config, "KEY", SAMPLE);
    expect(config.apiKeys.scopes).toHaveLength(2);
  });

  test("without a key, Directions on an ArcGIS routing host is left out; another host is kept", () => {
    const out = directionsKeyless({ routeServiceUrl: WORLD, unit: "miles" });
    expect(out).toEqual({ leaveOut: "Directions' route service route-api.arcgis.com needs an API key" });
    expect(directionsKeyless({ routeServiceUrl: SAMPLE, unit: "miles" })).toEqual({ keep: { routeServiceUrl: SAMPLE, unit: "miles" } });
  });
});

describe("directions stop search (design D3)", () => {
  test("only the keyless geocoder: the portal's default source is turned off with the core Search property", () => {
    const props = directionsSearchProperties();
    expect(props.includeDefaultSources).toBe(false);
    expect(props).not.toHaveProperty("includeDefaultSourcesDisabled");
    expect(props.sources).toEqual([expect.objectContaining({ url: DEFAULT_GEOCODER_URL })]);
    // Directions' own defaults, restated because setting searchProperties replaces them.
    expect(props).toMatchObject({ popupEnabled: false, resultGraphicEnabled: false });
    // With more than one source, a search covers all of them (D16).
    expect(props.searchAllEnabled).toBe(true);
  });
});

