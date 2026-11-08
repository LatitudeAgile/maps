import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { drawnFeatureCount, geojsonLayer, mapReady, serveGeoJSON, serveModifiedConfig } from "./helpers.ts";

/** Rules every in-page notice follows (notices spec). */

const closeButton = (page: Page, id: string) => page.locator(`#${id}`).getByRole("button", { name: "Close" });

/** Two GeoJSON layers, the second of which answers 404, so the layer warning shows. */
async function serveBrokenLayer(page: Page, edit: (c: Record<string, any>) => void = () => {}): Promise<void> {
  await serveGeoJSON(page, "**/config/data/good.geojson");
  await serveGeoJSON(page, "**/config/data/broken.geojson", "points.geojson", { status: 404 });
  await serveModifiedConfig(page, (c) => {
    c.layers = [geojsonLayer("good"), geojsonLayer("broken")];
    edit(c);
  });
}

test.describe("every notice can be closed", () => {
  test("Invalid config notice: closes, and no map is created", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.map.center = [-98.5, 120]));
    await page.goto("./");
    await expect(page.locator("#config-error")).toBeVisible();
    await closeButton(page, "config-error").click();
    await expect(page.locator("#config-error")).toHaveCount(0);
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("Map failure notice: closes", async ({ page }) => {
    // Block every non-local request: basemap metadata, styles, and tiles included.
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await page.goto("./");
    await expect(page.locator("#map-error")).toBeVisible({ timeout: 15_000 });
    // With every external request blocked, the close button's translated "Close" label never
    // loads (observed: component strings come from Esri's CDN by default). It is the only button.
    await page.locator("#map-error").getByRole("button").click();
    await expect(page.locator("#map-error")).toHaveCount(0);
  });

  test("Layer warning: closes, and the map and its other layer keep working", async ({ page }) => {
    await serveBrokenLayer(page);
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
    await closeButton(page, "layer-errors").click();
    await expect(page.locator("#layer-errors")).toHaveCount(0);
    expect(await drawnFeatureCount(page, "good")).toBe(3);
    await expect(page.locator('[data-component-id="zoom"]')).toBeVisible();
  });

  test("Close from the keyboard: Tab to the close button, Enter", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.map.center = [-98.5, 120]));
    await page.goto("./");
    await expect(page.locator("#config-error")).toBeVisible();
    const close = closeButton(page, "config-error");
    let focused = false;
    for (let i = 0; i < 10 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await close.evaluate((el) => el.matches(":focus"));
    }
    expect(focused, "close button reachable with Tab").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.locator("#config-error")).toHaveCount(0);
  });
});

test.describe("notices do not cover the title box", () => {
  const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

  test("Notice and title on a phone: the notice starts below the title box", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveBrokenLayer(page);
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
    const title = await box(page, ".title-box");
    await expect.poll(async () => (await box(page, "#layer-errors")).y).toBeGreaterThanOrEqual(title.y + title.height);
  });

  test("Notice and title on a wide screen: no overlap, even with a long title", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveBrokenLayer(page, (c) => (c.app.title = "Department of Transportation Regional Operations and Maintenance Viewer"));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
    const title = await box(page, ".title-box");
    const notice = await box(page, "#layer-errors");
    const overlaps =
      notice.x < title.x + title.width && title.x < notice.x + notice.width && notice.y < title.y + title.height && title.y < notice.y + notice.height;
    expect(overlaps).toBe(false);
  });

  test("Title hidden: the notice keeps its place at the top of the map", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveBrokenLayer(page, (c) => (c.app.titleVisible = false));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
    const map = await box(page, "arcgis-map");
    expect((await box(page, "#layer-errors")).y - map.y).toBeLessThanOrEqual(16);
  });
});
