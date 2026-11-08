import type { Page } from "@playwright/test";
import { test, expect, hasApiKey } from "./fixtures.ts";
import { mapReady } from "./helpers.ts";

/** The sidebar icons, top to bottom, by their headings. */
const icons = (page: Page) =>
  page.locator("calcite-shell-panel calcite-action[data-panel-for]").evaluateAll((els) => els.map((e) => (e as HTMLCalciteActionElement).text));

test.describe("default sidebar (dojo-sidebar order plus the new panels)", () => {
  test("Default panels with a key: Search, Directions, Layers, Legend, Basemaps", async ({ page }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await page.goto("./");
    await mapReady(page);
    await expect.poll(() => icons(page)).toEqual(["Search", "Directions", "Layers", "Legend", "Basemaps"]);
  });

  test("Default panels without a key: Search, Layers, Legend, Basemaps", async ({ page }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await page.goto("./");
    await mapReady(page);
    await expect.poll(() => icons(page)).toEqual(["Search", "Layers", "Legend", "Basemaps"]);
  });

  test("Default config without a key: Directions is left out with a warning, nothing goes to ArcGIS routing", async ({ page, log }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await page.goto("./");
    await mapReady(page);
    await expect.poll(() => icons(page)).toContain("Search");
    await page.waitForLoadState("networkidle");

    expect(await icons(page)).not.toContain("Directions");
    const warnings = log.console.filter((m) => m.type() === "warning").map((m) => m.text());
    expect(warnings.filter((t) => t.includes('components "directions"') && t.includes("needs an API key"))).toHaveLength(1);
    expect(log.requests.map((r) => new URL(r.url()).host).filter((h) => /(^|\.)route(-api)?\.arcgis\.com$/.test(h))).toEqual([]);
    await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
  });
});
