import { test, expect, hasApiKey } from "./fixtures.ts";
import { BASEMAP_STYLES_HOSTS, hostOf, mapReady, serveModifiedConfig, settled, sidebarAction } from "./helpers.ts";

test("No API key: OpenStreetMap fallback, no notice, no sign-in dialog, and no basemap styles requests", async ({ page, log }) => {
  test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");

  // The shipped default config, Basemaps panel included.
  await page.goto("./");
  await mapReady(page);
  await expect(sidebarAction(page, "basemaps")).toBeVisible();
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  expect(s.basemapTitle).toBe("OpenStreetMap");

  // Give tiles and the gallery's thumbnails time to request, then confirm nothing went to the
  // basemap styles service and the SDK didn't ask the user to sign in.
  await page.waitForLoadState("networkidle");
  const styleRequests = log.requests.map((r) => r.url()).filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)));
  expect(styleRequests).toEqual([]);
  await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
  await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
});

test("Configured basemap needs no credential: osm shows with no notice", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.map.basemap = "osm"));
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
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
    // No components: the toggle and gallery load their own basemaps, some of them keyed.
    c.components = [];
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
  await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
});

test("Light gray without a key: base and reference tiles from services.arcgisonline.com only", async ({ page, log }) => {
  // Light gray needs no key, so this holds in the keyed suite too; it runs in both.
  await serveModifiedConfig(page, (c) => {
    c.map.basemap = "light";
    // No components: the toggle and gallery load their own basemaps, some of them keyed.
    c.components = [];
  });
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("light");

  await page.waitForLoadState("networkidle");
  const urls = log.requests.map((r) => r.url());
  const tiles = urls.filter((u) => /\/MapServer\/tile\/\d+\/\d+\/\d+/.test(u));
  for (const service of ["/Canvas/World_Light_Gray_Base/", "/Canvas/World_Light_Gray_Reference/"]) {
    expect(tiles.some((u) => u.includes(service)), service).toBe(true);
  }
  expect(tiles.every((u) => hostOf(u) === "services.arcgisonline.com")).toBe(true);
  expect(urls.filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)))).toEqual([]);
  await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
});

test.describe("runtime fallback when the key is refused (design D9)", () => {
  test("Key rejected: the fallback basemap is shown, with a console warning and no notice", async ({ page, log }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await page.route(
      (url) => BASEMAP_STYLES_HOSTS.test(url.hostname),
      (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":{"code":401,"message":"Invalid token."}}' }),
    );
    await page.goto("./"); // the shipped default config: arcgis/streets, falling back to osm
    await mapReady(page);
    const s = await settled(page, (s) => s.basemapId === "osm");
    expect(s.basemapTitle).toBe("OpenStreetMap");
    await expect(page.locator('[data-component-id="zoom"]')).toBeVisible();
    await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
    const warnings = log.console.filter((m) => m.type() === "warning").map((m) => m.text());
    expect(warnings.filter((t) => t.includes('"arcgis/streets"') && t.includes('"osm"'))).toHaveLength(1);
  });

  test("Fallback fails too: the basemap error appears", async ({ page }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    // Everything off the viewer's own site fails: the keyed style, then the fallback.
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await page.goto("./");
    await expect(page.locator("#map-error")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#map-error")).toContainText("basemap could not be loaded");
  });
});
