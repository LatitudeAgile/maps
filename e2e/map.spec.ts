import { test, expect, hasApiKey } from "./fixtures.ts";
import { mapReady, mapState, serveModifiedConfig, settled, withinFraction } from "./helpers.ts";

const DEFAULT_CENTER: [number, number] = [-98.579404, 39.828127];
/** dojo-sidebar's zoom-5 view (P-01), the shipped map.scale. */
const DEFAULT_SCALE = 18_489_298;

function expectNear(actual: [number, number], expected: [number, number], tolerance = 0.01) {
  expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(tolerance);
}

test("Default configuration: opens at the configured center and scale", async ({ page }) => {
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expectNear(s.center, DEFAULT_CENTER);
  expect(withinFraction(s.scale, DEFAULT_SCALE), `scale ${s.scale}`).toBe(true);
  await expect(page).toHaveTitle("ArcGIS Sidebar Viewer");
});

// The same configured scale gives the same view whichever basemap is shown (design D10).
for (const basemap of ["osm", "arcgis/streets"]) {
  test(`Default scale is the same on ${basemap}`, async ({ page }) => {
    test.skip(basemap.includes("/") && !hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await serveModifiedConfig(page, (c) => (c.map.basemap = basemap));
    await page.goto("./");
    await mapReady(page);
    const s = await settled(page);
    expect(s.basemapId === basemap || s.basemapStyleId === basemap, `basemap ${basemap} shown`).toBe(true);
    expectNear(s.center, DEFAULT_CENTER);
    expect(withinFraction(s.scale, DEFAULT_SCALE), `scale ${s.scale}`).toBe(true);
  });
}

test.describe("zoom buttons", () => {
  test("Zoom in: one press settles one level in", async ({ page }) => {
    await page.goto("./");
    await mapReady(page);
    const start = (await settled(page)).zoom;
    await page.getByRole("button", { name: "Zoom in" }).click();
    const s = await settled(page, (s) => s.zoom !== start);
    expect(s.zoom).toBe(start + 1);
  });

  test("Keyboard operable: Tab to zoom out, Enter zooms out one level", async ({ page }) => {
    await page.goto("./");
    await mapReady(page);
    const start = (await settled(page)).zoom;

    const zoomOut = page.getByRole("button", { name: "Zoom out" });
    let focused = false;
    // The zoom buttons come after the sidebar icons and the other bottom-right controls.
    for (let i = 0; i < 20 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await zoomOut.evaluate((el) => el.matches(":focus"));
    }
    expect(focused, "zoom-out button reachable with Tab").toBe(true);

    await page.keyboard.press("Enter");
    const s = await settled(page, (s) => s.zoom !== start);
    expect(s.zoom).toBe(start - 1);
  });

  test("No zoom component: no zoom buttons, and the mouse wheel still zooms", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.components = c.components.filter((e: { type: string }) => e.type !== "zoom")));
    await page.goto("./");
    await mapReady(page);
    // Components are created after layers settle; wait for one before checking zoom's absence.
    await expect(page.locator('[data-component-id="home"]')).toBeVisible();
    await expect(page.locator("arcgis-zoom")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);

    const start = (await settled(page)).zoom;
    const box = (await page.locator("arcgis-map").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    const s = await settled(page, (s) => s.zoom !== start);
    expect(s.zoom).toBeGreaterThan(start);
  });

  test("Zoom placed elsewhere: top-right", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.components = [{ id: "zoom", type: "zoom", placement: "top-right" }]));
    await page.goto("./");
    await mapReady(page);
    const zoom = page.locator('[data-component-id="zoom"]');
    await expect(zoom).toBeVisible();
    const map = (await page.locator("arcgis-map").boundingBox())!;
    const b = (await zoom.boundingBox())!;
    expect(b.x).toBeGreaterThan(map.x + map.width / 2);
    expect(b.y + b.height).toBeLessThan(map.y + map.height / 2);
    expect(map.x + map.width - (b.x + b.width)).toBeLessThan(80);
  });
});

test("Calcite color tokens resolve in the production build", async ({ page }) => {
  // Guards the build.cssTarget setting: if light-dark() is lowered, tokens become invalid.
  await page.goto("./");
  await mapReady(page);
  const bg = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.background = "var(--calcite-color-foreground-1)";
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  });
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
});

test.describe("layout", () => {
  for (const size of [
    { width: 1280, height: 800 },
    { width: 375, height: 667 },
  ]) {
    test(`Map fills the ${size.width}×${size.height} viewport with no document scroll`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("./");
      await mapReady(page);
      const box = await page.locator("arcgis-map").boundingBox();
      expect(box).toEqual({ x: 0, y: 0, ...size });
      const scroll = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return { w: el.scrollWidth, h: el.scrollHeight, iw: innerWidth, ih: innerHeight };
      });
      expect(scroll.w).toBeLessThanOrEqual(scroll.iw);
      expect(scroll.h).toBeLessThanOrEqual(scroll.ih);
    });
  }

  test("Window narrowed: the map keeps its center", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./");
    await mapReady(page);
    const before = await settled(page, (s) => s.width === 1280);

    await page.setViewportSize({ width: 800, height: 800 });
    const after = await settled(page, (s) => s.width === 800);
    expectNear(after.center, before.center);
    expect((await mapState(page)).zoom).toBe(before.zoom);
  });
});
