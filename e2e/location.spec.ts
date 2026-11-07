import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import {
  failGeolocation,
  fakePosition,
  GEO_DENIED,
  GEO_TIMEOUT,
  mapReady,
  serveModifiedConfig,
  settled,
  withinFraction,
} from "./helpers.ts";

const byId = (page: Page, id: string) => page.locator(`[data-component-id="${id}"]`);

/** Default config with these components in place of its own. */
async function serveComponents(page: Page, components: Record<string, unknown>[]): Promise<void> {
  await serveModifiedConfig(page, (c) => (c.components = components));
}

const near = (a: [number, number], lon: number, lat: number) =>
  Math.abs(a[0] - lon) <= 0.01 && Math.abs(a[1] - lat) <= 0.01;

test.describe("locate (P-31)", () => {
  test("Locate: zooms to the device's position at the configured scale and marks it", async ({ page }) => {
    await fakePosition(page, -105.0, 40.0);
    await serveComponents(page, [{ id: "locate", type: "locate", placement: "top-left", options: { scale: 18000 } }]);
    await page.goto("./");
    await mapReady(page);

    await byId(page, "locate").getByRole("button").click();
    const s = await settled(page, (m) => near(m.center, -105.0, 40.0) && withinFraction(m.scale, 18_000));
    expect(near(s.center, -105.0, 40.0)).toBe(true);
    expect(withinFraction(s.scale, 18_000)).toBe(true);

    // The location graphic is on the map at that position.
    const graphic = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
      const locate = document.querySelector("arcgis-locate") as HTMLArcgisLocateElement;
      const g = locate.graphic;
      const p = g?.geometry as { longitude?: number; latitude?: number } | undefined;
      return { onMap: !!el.view?.graphics.includes(g), lon: p?.longitude, lat: p?.latitude };
    });
    expect(graphic.onMap).toBe(true);
    expect(Math.abs((graphic.lon ?? NaN) - -105.0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs((graphic.lat ?? NaN) - 40.0)).toBeLessThanOrEqual(0.001);
  });
});

test.describe("track", () => {
  const trackState = (page: Page) =>
    page.locator("arcgis-track").evaluate((el: HTMLArcgisTrackElement) => el.tracking);

  test.beforeEach(async ({ page }) => {
    await fakePosition(page, -105.0, 40.0);
    await serveComponents(page, [{ id: "track", type: "track", placement: "top-left", options: { scale: 50000 } }]);
    await page.goto("./");
    await mapReady(page);
  });

  test("Start tracking: centers on the device and shows tracking is on", async ({ page }) => {
    const button = byId(page, "track").getByRole("button");
    const offName = await button.getAttribute("aria-label") ?? (await button.textContent());
    await button.click();
    const s = await settled(page, (m) => near(m.center, -105.0, 40.0));
    expect(near(s.center, -105.0, 40.0)).toBe(true);
    await expect.poll(() => trackState(page)).toBe(true);
    // The button itself changes to say tracking is on (its accessible name becomes "stop").
    await expect(button).not.toHaveAccessibleName(offName ?? "");
  });

  test("Position changes while tracking: the map follows", async ({ page }) => {
    await byId(page, "track").getByRole("button").click();
    await settled(page, (m) => near(m.center, -105.0, 40.0));
    await fakePosition(page, -104.9, 40.1);
    const s = await settled(page, (m) => near(m.center, -104.9, 40.1));
    expect(near(s.center, -104.9, 40.1)).toBe(true);
  });

  test("Stop tracking: the button shows tracking is off and the map stays put", async ({ page }) => {
    const button = byId(page, "track").getByRole("button");
    await button.click();
    await settled(page, (m) => near(m.center, -105.0, 40.0));
    await expect.poll(() => trackState(page)).toBe(true);

    await button.click();
    await expect.poll(() => trackState(page)).toBe(false);
    const before = await settled(page);
    await fakePosition(page, -104.9, 40.1);
    await page.waitForTimeout(2000);
    const after = await settled(page);
    expect(Math.abs(after.center[0] - before.center[0])).toBeLessThan(0.0001);
    expect(Math.abs(after.center[1] - before.center[1])).toBeLessThan(0.0001);
  });
});

test.describe("location errors", () => {
  const notice = (page: Page) => page.locator("#location-error");

  test("Permission denied: a closable notice says access was denied", async ({ page }) => {
    await failGeolocation(page, GEO_DENIED);
    await serveComponents(page, [{ id: "locate", type: "locate", placement: "top-left" }]);
    await page.goto("./");
    await mapReady(page);

    await byId(page, "locate").getByRole("button").click();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText("Your location isn't available");
    await expect(notice(page)).toContainText("Location access was denied");
    await notice(page).getByRole("button", { name: "Close" }).click();
    await expect(notice(page)).toHaveCount(0);
  });

  test("Timed out: tracking that times out says it took too long", async ({ page }) => {
    await failGeolocation(page, GEO_TIMEOUT);
    await serveComponents(page, [{ id: "track", type: "track", placement: "top-left" }]);
    await page.goto("./");
    await mapReady(page);

    await byId(page, "track").getByRole("button").click();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText("took too long");
  });

  test("Repeated failure: still exactly one notice", async ({ page }) => {
    await failGeolocation(page, GEO_DENIED);
    await serveComponents(page, [{ id: "locate", type: "locate", placement: "top-left" }]);
    await page.goto("./");
    await mapReady(page);

    const button = byId(page, "locate").getByRole("button");
    await button.click();
    await expect(notice(page)).toBeVisible();
    // Count the reports so the second failure is known to have happened.
    const reports = () => page.evaluate(() => document.querySelectorAll("#location-error").length);
    const id = await notice(page).evaluate((el) => (el.dataset.seen = "first"));
    expect(id).toBe("first");
    await button.click();
    // The first notice is replaced by a new one for the second failure.
    await expect(page.locator('#location-error[data-seen="first"]')).toHaveCount(0);
    await expect(notice(page)).toBeVisible();
    expect(await reports()).toBe(1);
  });
});

test("Default layout: zoom buttons, then Home, then Locate, top to bottom at top left (P-30, P-31)", async ({ page }) => {
  await page.goto("./"); // the shipped default config
  await mapReady(page);
  const boxes = [];
  for (const locator of [page.locator("arcgis-zoom"), byId(page, "home"), byId(page, "locate")]) {
    await expect(locator).toBeVisible();
    boxes.push((await locator.boundingBox())!);
  }
  const [zoom, home, locate] = boxes;
  expect(home.y).toBeGreaterThanOrEqual(zoom.y + zoom.height - 1);
  expect(locate.y).toBeGreaterThanOrEqual(home.y + home.height - 1);
  // One column: the same left edge.
  expect(Math.abs(home.x - zoom.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(locate.x - zoom.x)).toBeLessThanOrEqual(1);
});
