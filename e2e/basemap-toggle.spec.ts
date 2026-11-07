import type { Page } from "@playwright/test";
import { test, expect, hasApiKey } from "./fixtures.ts";
import { BASEMAP_STYLES_HOSTS, hostOf, mapReady, serveModifiedConfig, settled } from "./helpers.ts";

const toggleButton = (page: Page) => page.locator('[data-component-id="basemap-toggle"]').getByRole("button");

test.describe("basemap toggle (P-32)", () => {
  test("Toggle and back: hybrid, then the starting basemap", async ({ page, log }) => {
    // Runs in both suites: ArcGIS Streets ↔ hybrid with a key, OpenStreetMap ↔ hybrid without.
    await page.goto("./");
    await mapReady(page);
    const start = await settled(page);
    expect(start.basemapId === "osm" || start.basemapStyleId === "arcgis/streets").toBe(true);
    expect(hasApiKey() ? start.basemapStyleId : start.basemapId).toBe(hasApiKey() ? "arcgis/streets" : "osm");

    await toggleButton(page).click();
    const hybrid = await settled(page, (s) => s.basemapId === "hybrid");
    expect(hybrid.basemapTitle).toBe("Satellite + roads");
    await page.waitForLoadState("networkidle");
    const imageryTiles = log.requests
      .map((r) => r.url())
      .filter((u) => /\/World_Imagery\/MapServer\/tile\/\d+\/\d+\/\d+/.test(u) && !u.endsWith("/tile/4/6/3"));
    expect(imageryTiles.length).toBeGreaterThan(0);
    expect(imageryTiles.every((u) => hostOf(u) === "services.arcgisonline.com")).toBe(true);

    await toggleButton(page).click();
    const back = await settled(page, (s) => s.basemapId !== "hybrid");
    expect(back.basemapId).toBe(start.basemapId);
    expect(back.basemapStyleId).toBe(start.basemapStyleId);
    await expect(page.locator("calcite-notice")).toHaveCount(0);
    await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
  });

  test("Next basemap needs a key: the toggle is left out, with a console warning", async ({ page, log }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await serveModifiedConfig(page, (c) => {
      const toggle = c.components.find((e: { type: string }) => e.type === "basemap-toggle");
      toggle.options = { nextBasemap: "arcgis/imagery/standard" };
    });
    await page.goto("./");
    await mapReady(page);
    await settled(page);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("arcgis-basemap-toggle")).toHaveCount(0);
    const warnings = log.console.filter((m) => m.type() === "warning").map((m) => m.text());
    expect(warnings.filter((t) => t.includes("arcgis/imagery/standard") && t.includes("basemap toggle"))).toHaveLength(1);
    expect(log.requests.map((r) => r.url()).filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)))).toEqual([]);
    await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
    // The rest of the default components are still created.
    await expect(page.locator('[data-component-id="locate"]')).toBeVisible();
  });

  test("Default placement, with or without a key: the toggle is in the top-right corner", async ({ page }) => {
    await page.goto("./");
    await mapReady(page);
    const toggle = page.locator('[data-component-id="basemap-toggle"]');
    await expect(toggle).toBeVisible();
    const box = (await toggle.boundingBox())!;
    const map = (await page.locator("arcgis-map").boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(map.x + map.width - 80);
    expect(box.y).toBeLessThan(map.y + 80);
  });
});
