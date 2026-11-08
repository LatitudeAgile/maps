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

/**
 * Click the location marker, where the view draws it, until its popup opens. Under a loaded
 * test run the view may not have drawn the marker yet, so a first click can find nothing.
 */
async function clickMarker(page: Page): Promise<void> {
  const popupOpen = () => page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => !!(el.popupElement as unknown as { open?: boolean } | null)?.open);
  for (let attempt = 0; attempt < 5; attempt++) {
    const point = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
      const graphic = (document.querySelector("arcgis-locate") as HTMLArcgisLocateElement).graphic!;
      const screen = el.view.toScreen(graphic.geometry as Parameters<typeof el.view.toScreen>[0])!;
      return { x: screen.x, y: screen.y };
    });
    const box = (await page.locator("arcgis-map").boundingBox())!;
    await page.mouse.click(box.x + point.x, box.y + point.y);
    try {
      await expect.poll(popupOpen, { timeout: 3_000 }).toBe(true);
      return;
    } catch {
      // Not drawn yet; try again.
    }
  }
  throw new Error("The location marker's popup didn't open after 5 clicks.");
}

const markerCount = (page: Page) =>
  page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
    const graphic = (document.querySelector("arcgis-locate") as HTMLArcgisLocateElement).graphic;
    return el.view.graphics.filter((g) => g === graphic).length;
  });

test.describe("location marker popup (design D14)", () => {
  test("Remove the location marker: the popup's Remove action removes it, closes the popup, no errors", async ({ page, log }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await fakePosition(page, -105.0, 40.0);
    await serveComponents(page, [{ id: "locate", type: "locate", placement: "top-left", options: { scale: 18000 } }]);
    await page.goto("./");
    await mapReady(page);
    await byId(page, "locate").getByRole("button").click();
    // The zoom too, not just the center: the marker moves on screen until it ends.
    await settled(page, (m) => near(m.center, -105.0, 40.0) && withinFraction(m.scale, 18_000));
    await expect.poll(() => markerCount(page)).toBe(1);

    await clickMarker(page);
    const remove = page.locator("arcgis-popup").getByRole("button", { name: "Remove" });
    await expect(remove.first()).toBeVisible({ timeout: 15_000 });
    await remove.first().click();

    await expect.poll(() => markerCount(page)).toBe(0);
    await expect.poll(() => page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.popupElement?.open ?? false)).toBe(false);
    expect(errors).toEqual([]);
    expect(log.console.filter((m) => m.type() === "error" && /remove/i.test(m.text()))).toEqual([]);
  });

  test("Locate again after removing: the marker comes back", async ({ page }) => {
    await fakePosition(page, -105.0, 40.0);
    await serveComponents(page, [{ id: "locate", type: "locate", placement: "top-left", options: { scale: 18000 } }]);
    await page.goto("./");
    await mapReady(page);
    const locate = byId(page, "locate").getByRole("button");
    await locate.click();
    // The zoom too, not just the center: the marker moves on screen until it ends.
    await settled(page, (m) => near(m.center, -105.0, 40.0) && withinFraction(m.scale, 18_000));
    await expect.poll(() => markerCount(page)).toBe(1);
    await clickMarker(page);
    await page.locator("arcgis-popup").getByRole("button", { name: "Remove" }).first().click({ timeout: 15_000 });
    await expect.poll(() => markerCount(page)).toBe(0);

    await locate.click();
    await expect.poll(() => markerCount(page)).toBe(1);
  });
});

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

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
]) {
  test(`Default layout at ${viewport.width} px: Home, Locate, then zoom, top to bottom at bottom right (P-02, P-30, P-31)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    const boxes = [];
    for (const locator of [byId(page, "home"), byId(page, "locate"), byId(page, "zoom")]) {
      await expect(locator).toBeVisible();
      boxes.push((await locator.boundingBox())!);
    }
    const [home, locate, zoom] = boxes;
    const map = (await page.locator("arcgis-map").boundingBox())!;
    expect(locate.y).toBeGreaterThanOrEqual(home.y + home.height - 1);
    expect(zoom.y).toBeGreaterThanOrEqual(locate.y + locate.height - 1);
    // One column, lined up on the right.
    const right = (b: { x: number; width: number }) => b.x + b.width;
    expect(Math.abs(right(locate) - right(home))).toBeLessThanOrEqual(2);
    expect(Math.abs(right(zoom) - right(home))).toBeLessThanOrEqual(2);
    // In the bottom-right corner.
    expect(home.x).toBeGreaterThan(map.x + map.width / 2);
    expect(home.y).toBeGreaterThan(map.y + map.height / 2);
    // Nothing configured is in the top-left corner (the title box sits there).
    await expect(page.locator('.corner-stack[slot="top-left"] [data-component-id]')).toHaveCount(0);
  });
}
