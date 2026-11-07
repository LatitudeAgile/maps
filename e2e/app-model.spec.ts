import { test, expect } from "./fixtures.ts";
import { geojsonLayer, mapReady, serveGeoJSON, serveModifiedConfig, settled } from "./helpers.ts";

/** Debug mode with one good and one failing layer. */
async function debugConfig(page: import("@playwright/test").Page, debug: boolean | undefined) {
  await serveGeoJSON(page, "**/config/data/parcels.geojson");
  await serveGeoJSON(page, "**/config/data/broken.geojson", "points.geojson", { status: 404 });
  await serveModifiedConfig(page, (c) => {
    if (debug !== undefined) c.debug = debug;
    c.layers = [geojsonLayer("parcels"), geojsonLayer("broken")];
  });
}

const viewerErrors = (log: { console: import("@playwright/test").ConsoleMessage[] }) =>
  log.console.filter((m) => m.type() === "error" && m.text().startsWith("[viewer]")).map((m) => m.text());

test("Debug on: window.app is the model, and a failed layer is logged with its id", async ({ page, log }) => {
  await debugConfig(page, true);
  await page.goto("./");
  await mapReady(page);
  await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
  const model = await page.evaluate(() => ({
    present: typeof window.app === "object",
    hasLookups: typeof window.app?.getLayer === "function" && typeof window.app?.getComponent === "function",
  }));
  expect(model).toEqual({ present: true, hasLookups: true });
  await expect.poll(() => viewerErrors(log).filter((t) => t.includes("layer:broken")).length).toBe(1);
});

test("Debug off: no window.app, and no error-channel reports in the console", async ({ page, log }) => {
  await debugConfig(page, undefined);
  await page.goto("./");
  await mapReady(page);
  await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => typeof window.app)).toBe("undefined");
  expect(viewerErrors(log)).toEqual([]);
});

test.describe("debug mode model", () => {
  test.beforeEach(async ({ page }) => {
    await debugConfig(page, true);
    await page.goto("./");
    await mapReady(page);
    await page.waitForFunction(() => window.app?.view !== undefined);
  });

  test("Values follow the map: zoom, scale, center, and extent equal the map's after zooming in", async ({ page }) => {
    const before = await settled(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await settled(page, (s) => s.zoom !== before.zoom);
    const cmp = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
      const app = window.app!;
      return {
        zoom: [app.zoom, el.view.zoom],
        scale: [app.scale, el.view.scale],
        center: [app.center?.longitude, el.view.center.longitude, app.center?.latitude, el.view.center.latitude],
        extentSame: app.extent?.equals(el.view.extent) ?? false,
      };
    });
    expect(cmp.zoom[0]).toBe(cmp.zoom[1]);
    expect(cmp.zoom[0]).toBe(before.zoom + 1);
    expect(cmp.scale[0]).toBe(cmp.scale[1]);
    expect(cmp.center[0]).toBe(cmp.center[1]);
    expect(cmp.center[2]).toBe(cmp.center[3]);
    expect(cmp.extentSame).toBe(true);
  });

  test("Change notification: a watcher on extent is called after a pan", async ({ page }) => {
    await settled(page);
    await page.evaluate(() => {
      const w = window as unknown as { __extents: string[] };
      w.__extents = [];
      window.app!.watch("extent", (extent) => w.__extents.push(JSON.stringify(extent?.center?.toJSON())));
    });
    const box = (await page.locator("arcgis-map").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 250, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await settled(page);
    const calls = await page.evaluate(() => (window as unknown as { __extents: string[] }).__extents.length);
    expect(calls).toBeGreaterThan(0);
  });

  test("Layer lookup: the config entry and the map layer created from it", async ({ page }) => {
    const r = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
      const rec = window.app!.getLayer("parcels");
      return {
        entryId: rec?.entry.id,
        entryType: rec?.entry.type,
        sameLayer: rec?.layer === el.map?.findLayerById("parcels"),
        unknown: window.app!.getLayer("nope") === undefined,
      };
    });
    expect(r).toEqual({ entryId: "parcels", entryType: "geojson", sameLayer: true, unknown: true });
  });
});
