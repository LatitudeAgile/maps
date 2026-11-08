import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { mapReady, serveGeocoder, serveModifiedConfig, settled, sidebarAction } from "./helpers.ts";

const near = (c: [number, number], lon: number, lat: number, tol = 0.05) => Math.abs(c[0] - lon) <= tol && Math.abs(c[1] - lat) <= tol;

/** Open the Search panel, type, and choose the first suggestion with the keyboard. */
async function searchFor(page: Page, text: string, expectFirst: RegExp): Promise<void> {
  await sidebarAction(page, "search").click();
  const input = page.locator("arcgis-search input").first();
  await input.fill(text);
  await expect(page.getByRole("option").first()).toHaveText(expectFirst, { timeout: 15_000 });
  await input.press("ArrowDown");
  await input.press("Enter");
}

test.describe("search (P-34)", () => {
  test("Search and zoom: the map moves to the chosen result; geocoder requests carry no token", async ({ page }) => {
    // Runs in both suites: Search never needs a key.
    const answered = await serveGeocoder(page);
    await serveModifiedConfig(page, (c) => (c.components = [{ id: "search", type: "search" }]));
    await page.goto("./");
    await mapReady(page);

    await searchFor(page, "Denv", /^Denver, CO, USA/);
    const s = await settled(page, (m) => near(m.center, -104.98, 39.74));
    expect(near(s.center, -104.98, 39.74)).toBe(true);

    expect(answered.length).toBeGreaterThanOrEqual(2);
    for (const url of answered) {
      expect(url.startsWith("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/")).toBe(true);
      expect(new URL(url).searchParams.has("token")).toBe(false);
    }
  });

  test("Live geocoder without a key: a real search for Denver, CO @live", async ({ page, log }) => {
    await serveModifiedConfig(page, (c) => (c.components = [{ id: "search", type: "search" }]));
    await page.goto("./");
    await mapReady(page);

    await searchFor(page, "Denver, CO", /Denver/);
    const s = await settled(page, (m) => near(m.center, -104.98, 39.74, 0.3), 20_000);
    expect(near(s.center, -104.98, 39.74, 0.3)).toBe(true);
    const geocoder = log.requests.map((r) => r.url()).filter((u) => u.includes("/GeocodeServer/"));
    expect(geocoder.every((u) => !new URL(u).searchParams.has("token"))).toBe(true);
  });
});
