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
    for (let i = 0; i < 10 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await zoomOut.evaluate((el) => el.matches(":focus"));
    }
    expect(focused, "zoom-out button reachable with Tab").toBe(true);

    await page.keyboard.press("Enter");
    const s = await settled(page, (s) => s.zoom !== start);
    expect(s.zoom).toBe(start - 1);
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
