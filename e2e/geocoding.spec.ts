import type { Page } from "@playwright/test";
import { test, expect, hasApiKey, buildApiKey } from "./fixtures.ts";
import { fixture, hostOf, isBasemapStyleRequest, mapReady, serveGeocoder, serveModifiedConfig, serveRoute, settled, sidebarAction } from "./helpers.ts";

/** The geocoding section's sources, shared by Search and Directions (geocoding spec, design D16). */

const COUNTY_URL = "https://gis.example.org/arcgis/rest/services/Addresses/GeocodeServer";
const ROUTE_URL = "https://routing.example.com/arcgis/rest/services/SanDiego/NAServer/Route";
const PLACES_HOST = "places-api.arcgis.com";
const COUNTY = { url: COUNTY_URL, name: "County addresses" };

/** Names of a Search component's sources, and which is active (-1 is "All"). */
const searchSources = (page: Page) =>
  page.locator('[data-component-id="search"]').evaluate((el: HTMLArcgisSearchElement) => ({
    names: el.allSources.toArray().map((s) => (s as unknown as { name: string }).name),
    active: el.activeSourceIndex,
  }));

/** Answer Places near-point requests from a fixture; returns the request URLs. */
async function servePlaces(page: Page): Promise<URL[]> {
  const seen: URL[] = [];
  await page.route((url) => url.hostname === PLACES_HOST, (route) => {
    seen.push(new URL(route.request().url()));
    return route.fulfill({ status: 200, contentType: "application/json", body: fixture("places-union.json") });
  });
  return seen;
}

async function typeInSearch(page: Page, text: string): Promise<void> {
  await sidebarAction(page, "search").click();
  await page.locator("arcgis-search input").first().fill(text);
}

test.describe("additional geocoders", () => {
  test("Two geocoders: a source menu starting on All, and both are asked", async ({ page }) => {
    const answered = await serveGeocoder(page);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "search", type: "search", placement: "panel" }];
      c.geocoding = { geocoders: [COUNTY] };
    });
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "search")).toBeVisible();
    expect(await searchSources(page)).toEqual({ names: ["ArcGIS World Geocoding Service", "County addresses"], active: -1 });

    await typeInSearch(page, "Denv");
    await expect
      .poll(() => new Set(answered.map(hostOf)), { timeout: 15_000 })
      .toEqual(new Set(["geocode.arcgis.com", "gis.example.org"]));
  });

  test("Directions uses the same sources", async ({ page }) => {
    const answered = await serveGeocoder(page);
    await serveRoute(page, ROUTE_URL);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "directions", type: "directions", placement: "panel", options: { routeServiceUrl: ROUTE_URL } }];
      c.geocoding = { geocoders: [COUNTY] };
    });
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "directions").click();
    const names = await page
      .locator('[data-component-id="directions"]')
      .evaluate((el: HTMLArcgisDirectionsElement) => ((el.searchProperties as { sources?: { name: string }[] })?.sources ?? []).map((s) => s.name));
    expect(names).toEqual(["ArcGIS World Geocoding Service", "County addresses"]);

    // Directions starts "disabled" until its route service has loaded; type once it's ready.
    await expect
      .poll(() => page.locator('[data-component-id="directions"]').evaluate((el: HTMLArcgisDirectionsElement) => el.state), { timeout: 20_000 })
      .toBe("ready");
    await page.locator("arcgis-directions input").first().fill("Denv");
    await expect
      .poll(() => new Set(answered.map(hostOf)), { timeout: 15_000 })
      .toEqual(new Set(["geocode.arcgis.com", "gis.example.org"]));
  });

  test("One source only: no geocoding section, the world geocoder alone", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.components = [{ id: "search", type: "search", placement: "panel" }]));
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "search")).toBeVisible();
    expect((await searchSources(page)).names).toEqual(["ArcGIS World Geocoding Service"]);
  });

  test("Key not sent to an additional geocoder", async ({ page }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    const answered = await serveGeocoder(page);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "search", type: "search", placement: "panel" }];
      c.geocoding = { geocoders: [COUNTY] };
    });
    await page.goto("./");
    await mapReady(page);
    await typeInSearch(page, "Denv");
    await expect.poll(() => answered.filter((u) => hostOf(u) === "gis.example.org").length).toBeGreaterThan(0);
    const key = buildApiKey()!;
    for (const u of answered.filter((u) => hostOf(u) === "gis.example.org")) {
      expect(new URL(u).searchParams.has("token")).toBe(false);
      expect(u).not.toContain(key);
    }
  });
});

test.describe("Places search", () => {
  test("Suggest and choose a place: a near-point query at the map's center; the map goes there", async ({ page }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await serveGeocoder(page);
    const places = await servePlaces(page);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "search", type: "search", placement: "panel" }];
      c.map.center = [-105.0, 39.75];
      c.map.scale = 50000;
      c.geocoding = { places: { radius: 2000 } };
    });
    await page.goto("./");
    await mapReady(page);
    const start = await settled(page);

    await typeInSearch(page, "Union");
    await expect(page.getByRole("option", { name: /Union Station/ }).first()).toBeVisible({ timeout: 15_000 });
    // Choose it with the keyboard, as a user would: the search input overlaps the list, so a
    // mouse click on an option is intercepted in Playwright (see the add-panel-components notes).
    const names = await page.getByRole("option").allTextContents();
    const index = names.findIndex((n) => /Union Station/.test(n));
    const input = page.locator("arcgis-search input").first();
    for (let i = 0; i <= index; i++) await input.press("ArrowDown");
    await input.press("Enter");
    const s = await settled(page, (m) => Math.abs(m.center[0] - -105.0003) < 0.005 && Math.abs(m.center[1] - 39.753) < 0.005);
    expect(Math.abs(s.center[1] - 39.753)).toBeLessThan(0.005);

    const nearPoint = places.filter((u) => u.pathname.endsWith("/places/near-point"));
    expect(nearPoint.length).toBeGreaterThan(0);
    const q = nearPoint.at(-1)!.searchParams;
    expect(q.get("searchText")).toBe("Union");
    expect(q.get("radius")).toBe("2000");
    expect(Math.abs(Number(q.get("x")) - start.center[0])).toBeLessThan(0.01);
    expect(Math.abs(Number(q.get("y")) - start.center[1])).toBeLessThan(0.01);
  });

  test("Places requests carry the key; other new requests don't", async ({ page, log }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await serveGeocoder(page);
    const places = await servePlaces(page);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "search", type: "search", placement: "panel" }];
      c.map.center = [-105.0, 39.75];
      c.geocoding = { places: { radius: 2000 } };
    });
    await page.goto("./");
    await mapReady(page);
    const before = log.requests.length;
    await typeInSearch(page, "Union");
    await expect.poll(() => places.length).toBeGreaterThan(0);
    const key = buildApiKey()!;
    // Report hosts only, so a failure never prints the key.
    expect(places.filter((u) => !u.toString().includes(key)).map((u) => u.host), "Places requests without the key").toEqual([]);
    // The basemap keeps loading meanwhile, and its styles service is allowed the key.
    const others = log.requests
      .slice(before)
      .map((r) => r.url())
      .filter((u) => hostOf(u) !== PLACES_HOST && !isBasemapStyleRequest(u));
    expect(others.filter((u) => u.includes(key)).map(hostOf), "other requests carrying the key").toEqual([]);
  });

  test("Keyless build with Places configured: left out, one warning, no Places request", async ({ page, log }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await serveGeocoder(page);
    await serveModifiedConfig(page, (c) => {
      c.components = [{ id: "search", type: "search", placement: "panel" }];
      c.geocoding = { places: { radius: 2000 } };
    });
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "search")).toBeVisible();
    expect((await searchSources(page)).names).toEqual(["ArcGIS World Geocoding Service"]);
    await typeInSearch(page, "Union");
    await page.waitForTimeout(1500);
    const warnings = log.console.filter((m) => m.type() === "warning" && m.text().includes("geocoding.places"));
    expect(warnings).toHaveLength(1);
    expect(log.requests.filter((r) => hostOf(r.url()) === PLACES_HOST)).toEqual([]);
  });
});
