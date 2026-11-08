import { test, expect } from "./fixtures.ts";
import { geojsonLayer, mapReady, serveModifiedConfig, settled, withinFraction } from "./helpers.ts";

const component = (id: string, placement: string, options?: Record<string, unknown>) => ({
  id,
  type: "home",
  placement,
  ...(options ? { options } : {}),
});
const byId = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-component-id="${id}"]`);

test("Home component returns to the initial view", async ({ page }) => {
  await page.goto("./"); // the shipped config has a home component at top-left
  await mapReady(page);
  const start = await settled(page);
  // Move away: zoom in twice and pan.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await settled(page, (s) => s.zoom !== start.zoom);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await settled(page);
  const box = (await page.locator("arcgis-map").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2 + 150, { steps: 10 });
  await page.mouse.up();
  const moved = await settled(page);
  expect(Math.abs(moved.center[0] - start.center[0])).toBeGreaterThan(0.01);

  await byId(page, "home").getByRole("button").click();
  const back = await settled(page, (s) => withinFraction(s.scale, start.scale));
  expect(Math.abs(back.center[0] - -98.579404)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(back.center[1] - 39.828127)).toBeLessThanOrEqual(0.01);
  expect(withinFraction(back.scale, 18_489_298)).toBe(true);
});

test("Corner placement: bottom-right", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.components = [component("corner", "bottom-right")]));
  await page.goto("./");
  await mapReady(page);
  const w = byId(page, "corner");
  await expect(w).toBeVisible();
  const map = (await page.locator("arcgis-map").boundingBox())!;
  const b = (await w.boundingBox())!;
  expect(map.x + map.width - (b.x + b.width)).toBeLessThan(80);
  expect(map.y + map.height - (b.y + b.height)).toBeLessThan(80);
  expect(b.x).toBeGreaterThan(map.x + map.width / 2);
});

test("Order within a corner: first above second", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.components = [component("first", "top-right"), component("second", "top-right")]));
  await page.goto("./");
  await mapReady(page);
  const first = (await byId(page, "first").boundingBox())!;
  const second = (await byId(page, "second").boundingBox())!;
  expect(first.y).toBeLessThan(second.y);
});

test("Order within a bottom corner: first above second, in one column", async ({ page }) => {
  // On its own the SDK lays out bottom slots side by side; the corner stack keeps a column (D1).
  await serveModifiedConfig(page, (c) => (c.components = [component("first", "bottom-right"), component("second", "bottom-right")]));
  await page.goto("./");
  await mapReady(page);
  await expect(byId(page, "second")).toBeVisible();
  const first = (await byId(page, "first").boundingBox())!;
  const second = (await byId(page, "second").boundingBox())!;
  expect(first.y + first.height).toBeLessThanOrEqual(second.y);
  expect(Math.abs(first.x + first.width - (second.x + second.width))).toBeLessThanOrEqual(2);
});

test("Headless component: not visible, but found by id through the app model", async ({ page }) => {
  await serveModifiedConfig(page, (c) => {
    c.debug = true;
    c.components = [component("quiet", "none")];
  });
  await page.goto("./");
  await mapReady(page);
  const w = byId(page, "quiet");
  await expect(w).toHaveCount(1);
  await expect(w).toBeHidden();
  const viaModel = await page.evaluate(() => {
    const record = window.app?.getComponent("quiet");
    return { found: !!record, sameElement: record?.element === document.querySelector('[data-component-id="quiet"]') };
  });
  expect(viaModel).toEqual({ found: true, sameElement: true });
});

test("Supported option: icon sets the Home button's icon", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.components = [component("home", "top-left", { icon: "globe" })]));
  await page.goto("./");
  await mapReady(page);
  await expect(byId(page, "home").locator('calcite-icon[icon="globe"]')).toBeVisible();
});

test("Slow layer: no component exists until the layer responds", async ({ page }) => {
  let componentsWhenLayerAnswered = -1;
  await page.context().route("**/config/data/slow.geojson", async (route) => {
    await new Promise((r) => setTimeout(r, 2_000));
    componentsWhenLayerAnswered = await page.locator("[data-component-id]").count();
    await route.fulfill({ contentType: "application/geo+json", body: '{"type":"FeatureCollection","features":[]}' });
  });
  await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("slow")]));
  await page.goto("./");
  await expect(byId(page, "home")).toBeVisible({ timeout: 20_000 });
  expect(componentsWhenLayerAnswered).toBe(0);
});
