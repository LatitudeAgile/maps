import { test, expect } from "./fixtures.ts";
import { clickMapAt, drawnFeatureCount, geojsonLayer, mapLayerIds, mapReady, serveGeoJSON, serveModifiedConfig } from "./helpers.ts";

test("GeoJSON layer from config is shown: three points drawn", async ({ page }) => {
  await serveGeoJSON(page, "**/config/data/sites.geojson");
  await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("sites")]));
  await page.goto("./");
  await mapReady(page);
  await expect.poll(() => mapLayerIds(page)).toEqual(["sites"]);
  expect(await drawnFeatureCount(page, "sites")).toBe(3);
});

test("Two overlapping layers: the first listed draws on top", async ({ page }) => {
  await serveGeoJSON(page, "**/config/data/*.geojson");
  await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("roads"), geojsonLayer("parcels")]));
  await page.goto("./");
  await mapReady(page);
  // map.layers runs bottom to top, so "roads" (listed first) is last.
  await expect.poll(() => mapLayerIds(page)).toEqual(["parcels", "roads"]);
});

test.describe("a failed layer does not stop the viewer", () => {
  test("Layer service returns 404: the other layer draws and a notice names the failed id", async ({ page }) => {
    await serveGeoJSON(page, "**/config/data/good.geojson");
    await serveGeoJSON(page, "**/config/data/broken.geojson", "points.geojson", { status: 404 });
    await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("good"), geojsonLayer("broken")]));
    await page.goto("./");
    await mapReady(page);
    const notice = page.locator("#layer-errors");
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(notice).toContainText("broken");
    await expect(notice).not.toContainText("good");
    expect(await drawnFeatureCount(page, "good")).toBe(3);
    await expect(page.locator('[data-component-id="home"]')).toBeVisible(); // configured components appear
    // Closable.
    await notice.getByRole("button", { name: "Close" }).click();
    await expect(notice).toHaveCount(0);
  });

  test("Layer never responds: reported as not loaded within 20 seconds of page load @timing", async ({ page }) => {
    await serveGeoJSON(page, "**/config/data/stuck.geojson", "points.geojson", { hang: true });
    await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("stuck")]));
    const start = Date.now();
    await page.goto("./");
    const notice = page.locator("#layer-errors");
    await expect(notice).toContainText("stuck", { timeout: 20_000 });
    await expect(page.locator('[data-component-id="home"]')).toBeVisible(); // components appear despite the hung layer
    expect(Date.now() - start).toBeLessThan(20_000);
  });
});

test.describe("popups", () => {
  const WICHITA: [number, number] = [-97.3375, 37.6872];

  test("Default popup: clicking a point shows its attributes", async ({ page }) => {
    await serveGeoJSON(page, "**/config/data/sites.geojson");
    await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("sites")]));
    await page.goto("./");
    await mapReady(page);
    expect(await drawnFeatureCount(page, "sites")).toBe(3);
    await clickMapAt(page, ...WICHITA);
    // The arcgis-popup host has no box of its own; check its rendered content instead.
    const popup = page.locator("arcgis-popup");
    await expect(popup.getByText("Wichita").first()).toBeVisible({ timeout: 10_000 });
    await expect(popup.getByText("KS", { exact: true }).first()).toBeVisible();
  });

  test("Popup turned off: popupEnabled false opens nothing", async ({ page }) => {
    await serveGeoJSON(page, "**/config/data/sites.geojson");
    await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("sites", { popupEnabled: false })]));
    await page.goto("./");
    await mapReady(page);
    expect(await drawnFeatureCount(page, "sites")).toBe(3);
    await clickMapAt(page, ...WICHITA);
    await page.waitForTimeout(3_000);
    await expect(page.locator("arcgis-popup").getByText("Wichita")).toHaveCount(0);
    expect(await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.popupElement?.open ?? false)).toBe(false);
  });
});
