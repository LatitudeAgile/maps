import type { Page } from "@playwright/test";
import { test, expect, hasApiKey, buildApiKey } from "./fixtures.ts";
import { mapReady, serveGeocoder, serveModifiedConfig, serveRoute, sidebarAction } from "./helpers.ts";

/** A route service on a host that isn't an ArcGIS routing host, answered from fixtures. */
const OTHER_ROUTE = "https://routing.example.com/arcgis/rest/services/SanDiego/NAServer/Route";
const WORLD_ROUTE = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

async function serveDirections(page: Page, options: Record<string, unknown>): Promise<void> {
  await serveModifiedConfig(page, (c) => {
    c.map.center = [-117.16, 32.72];
    c.map.scale = 72000;
    c.components = [{ id: "directions", type: "directions", options }];
  });
}

/** Type each stop into the next stop box and choose the first suggestion with the keyboard. */
async function enterStops(page: Page, stops: [string, RegExp][]): Promise<void> {
  await sidebarAction(page, "directions").click();
  // The stop boxes take typing only once Directions has loaded its route service.
  await page.waitForFunction(
    () => (document.querySelector("arcgis-directions") as unknown as { viewModel?: { state?: string } })?.viewModel?.state === "ready",
    undefined,
    { timeout: 20_000 },
  );
  // Stop boxes, by the placeholder of the viewer's geocoder source; the travel-mode box is also an input.
  const inputs = page.locator('arcgis-directions input[placeholder="Find address or place"]');
  for (const [k, [text, first]] of stops.entries()) {
    const input = inputs.nth(k);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill(text);
    await expect(page.getByRole("option", { name: first }).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
    await input.press("ArrowDown");
    await input.press("Enter");
  }
}

/** The solved route's total length in miles, read from the component, once it has one. */
async function solvedMiles(page: Page): Promise<number> {
  const handle = await page.waitForFunction(
    () => {
      const vm = (document.querySelector("arcgis-directions") as unknown as { viewModel?: { lastRoute?: { routeInfo?: { totalDistance?: number } } } })?.viewModel;
      const meters = vm?.lastRoute?.routeInfo?.totalDistance;
      return typeof meters === "number" ? meters / 1609.344 : false;
    },
    undefined,
    { timeout: 20_000 },
  );
  return (await handle.jsonValue()) as number;
}

const SAN_DIEGO_STOPS: [string, RegExp][] = [
  ["Petco Park", /PETCO Park/i],
  ["Balboa Park", /Balboa Park/],
];

test.describe("directions (P-35)", () => {
  test("Route between two stops: drawn on the map, total distance in miles", async ({ page }) => {
    // Runs in both suites: the route service is on another host, so no key is involved.
    await serveGeocoder(page);
    const answered = await serveRoute(page, OTHER_ROUTE);
    await serveDirections(page, { routeServiceUrl: OTHER_ROUTE });
    await page.goto("./");
    await mapReady(page);

    await enterStops(page, SAN_DIEGO_STOPS);
    expect(await solvedMiles(page)).toBeCloseTo(1.82, 1);
    expect(answered.some((u) => u.includes("/solve"))).toBe(true);

    // Drawn: the route layer has a route with geometry.
    const drawn = await page.evaluate(() => {
      const map = (document.querySelector("arcgis-map") as HTMLArcgisMapElement).map;
      const layer = map?.layers.find((l) => l.type === "route") as unknown as { routeInfo?: { geometry?: unknown } } | undefined;
      return !!layer?.routeInfo?.geometry;
    });
    expect(drawn).toBe(true);
    // Shown in miles in the directions list.
    await expect(page.locator("arcgis-directions").getByText(/1\.8\d* mi/).first()).toBeVisible();
  });

  test("Public route service without a key: the panel is there and a route solves", async ({ page }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await serveGeocoder(page);
    await serveRoute(page, OTHER_ROUTE);
    await serveDirections(page, { routeServiceUrl: OTHER_ROUTE });
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "directions")).toBeVisible();
    await enterStops(page, SAN_DIEGO_STOPS);
    expect(await solvedMiles(page)).toBeGreaterThan(0);
  });

  test("Key goes only to ArcGIS routing: a route service on another host never sees it", async ({ page, log }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    const key = buildApiKey() as string;
    await serveGeocoder(page);
    await serveRoute(page, OTHER_ROUTE);
    await serveDirections(page, { routeServiceUrl: OTHER_ROUTE });
    await page.goto("./");
    await mapReady(page);
    await enterStops(page, SAN_DIEGO_STOPS);
    await solvedMiles(page);

    const leaked = log.requests.filter((r) => {
      if (new URL(r.url()).host !== "routing.example.com") return false;
      const text = `${r.url()} ${r.postData() ?? ""} ${JSON.stringify(r.headers())}`;
      return text.includes(key) || text.includes(encodeURIComponent(key));
    });
    expect(leaked.map((r) => new URL(r.url()).pathname)).toEqual([]);
  });

  test("World route service with a key: a live route in Denver @live", async ({ page, log }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    const key = buildApiKey() as string;
    await serveModifiedConfig(page, (c) => {
      c.map.center = [-104.99, 39.74];
      c.map.scale = 72000;
      c.components = [{ id: "directions", type: "directions" }];
    });
    await page.goto("./");
    await mapReady(page);
    await enterStops(page, [
      ["Union Station, Denver", /Union Station/i],
      ["Denver Zoo", /Denver Zoo/i],
    ]);
    expect(await solvedMiles(page)).toBeGreaterThan(0.5);

    // The URL scope covers the route service's requests, and only those (design D4).
    const carries = (r: { url(): string; postData(): string | null; headers(): Record<string, string> }) =>
      `${r.url()} ${r.postData() ?? ""} ${JSON.stringify(r.headers())}`.includes(key);
    const route = log.requests.filter((r) => r.url().startsWith(WORLD_ROUTE));
    expect(route.length).toBeGreaterThan(0);
    expect(route.filter((r) => !carries(r)).map((r) => new URL(r.url()).pathname)).toEqual([]);
    const geocoder = log.requests.filter((r) => r.url().includes("/GeocodeServer/"));
    expect(geocoder.filter(carries)).toEqual([]);
  });
});
