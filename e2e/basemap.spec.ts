import { test, expect, hasApiKey } from "./fixtures.ts";
import { BASEMAP_STYLES_HOSTS, hostOf, mapReady, serveModifiedConfig, settled } from "./helpers.ts";

test("No API key: OpenStreetMap fallback, no notice, no sign-in dialog, and no basemap styles requests", async ({ page, log }) => {
  test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");

  // The shipped default config, basemap toggle included.
  await page.goto("./");
  await mapReady(page);
  await expect(page.locator("arcgis-basemap-toggle")).toBeVisible();
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  expect(s.basemapTitle).toBe("OpenStreetMap");

  // Give tiles and the toggle's thumbnail time to request, then confirm nothing went to the
  // basemap styles service and the SDK didn't ask the user to sign in.
  await page.waitForLoadState("networkidle");
  const styleRequests = log.requests.map((r) => r.url()).filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)));
  expect(styleRequests).toEqual([]);
  await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
  await expect(page.locator("calcite-notice")).toHaveCount(0);
});

test("Configured basemap needs no credential: osm shows with no notice", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.map.basemap = "osm"));
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  await expect(page.locator("calcite-notice")).toHaveCount(0);
});

test("Basemap service unreachable: an error appears within 15 seconds", async ({ page }) => {
  // Block every non-local request: basemap metadata, styles, and tiles included.
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.goto("./");
  const error = page.locator("#map-error");
  await expect(error).toBeVisible({ timeout: 15_000 });
  await expect(error).toContainText("basemap could not be loaded");
});

test("Hybrid without a key: imagery and both reference layers from services.arcgisonline.com", async ({ page, log }) => {
  // Hybrid needs no key, so this holds in the keyed suite too; it runs in both.
  await serveModifiedConfig(page, (c) => {
    c.map.basemap = "hybrid";
    c.components = c.components.filter((e: { type: string }) => e.type !== "basemap-toggle");
  });
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("hybrid");
  expect(s.basemapTitle).toBe("Satellite + roads");

  await page.waitForLoadState("networkidle");
  const urls = log.requests.map((r) => r.url());
  const tiles = urls.filter((u) => /\/MapServer\/tile\/\d+\/\d+\/\d+/.test(u));
  // Tiles from all three services, and only from services.arcgisonline.com.
  for (const service of ["/World_Imagery/", "/Reference/World_Transportation/", "/Reference/World_Boundaries_and_Places/"]) {
    expect(tiles.some((u) => u.includes(service)), service).toBe(true);
  }
  expect(tiles.every((u) => hostOf(u) === "services.arcgisonline.com")).toBe(true);
  expect(urls.filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)))).toEqual([]);
  await expect(page.locator("calcite-notice")).toHaveCount(0);
});
