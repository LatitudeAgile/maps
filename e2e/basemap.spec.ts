import { test, expect, hasApiKey } from "./fixtures.ts";
import { BASEMAP_STYLES_HOSTS, hostOf, mapReady, serveModifiedConfig, settled } from "./helpers.ts";

test("No API key: OpenStreetMap fallback, a closable notice, and no basemap styles requests", async ({ page, log }) => {
  test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");

  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  expect(s.basemapTitle).toBe("OpenStreetMap");

  const notice = page.locator("#fallback-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Fallback basemap in use");
  await expect(notice).toContainText("No API key is configured");

  // Give tiles time to request, then confirm nothing went to the basemap styles service.
  await page.waitForLoadState("networkidle");
  const styleRequests = log.requests.map((r) => r.url()).filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)));
  expect(styleRequests).toEqual([]);

  // Dismissible.
  await notice.getByRole("button", { name: "Close" }).click();
  await expect(notice).toHaveCount(0);
});

test("Configured basemap needs no credential: osm shows with no fallback notice", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.map.basemap = "osm"));
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapId).toBe("osm");
  await expect(page.locator("#fallback-notice")).toHaveCount(0);
});

test("Basemap service unreachable: an error appears within 15 seconds", async ({ page }) => {
  // Block every non-local request: basemap metadata, styles, and tiles included.
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.goto("./");
  const error = page.locator("#map-error");
  await expect(error).toBeVisible({ timeout: 15_000 });
  await expect(error).toContainText("basemap could not be loaded");
});
