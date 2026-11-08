import type { Page } from "@playwright/test";
import { test, expect, hasApiKey } from "./fixtures.ts";
import { BASEMAP_STYLES_HOSTS, hostOf, mapReady, serveModifiedConfig, settled, sidebarAction } from "./helpers.ts";

const FREE = ["OpenStreetMap", "Satellite + roads", "Satellite", "Light gray", "Dark gray"];
const KEYED = ["ArcGIS Streets", "ArcGIS Topographic", "ArcGIS Imagery", "ArcGIS Light Gray", "ArcGIS Dark Gray"];

/** The gallery's choices, in order: a radio group whose checked radio is the current basemap. */
const choices = (page: Page) => page.locator("arcgis-basemap-gallery").getByRole("radio");
const choice = (page: Page, title: string) => page.locator("arcgis-basemap-gallery").getByRole("radio", { name: title, exact: true });

/** Choose a basemap: once the gallery is ready, click until the choice is checked (clicks during loading are ignored). */
async function choose(page: Page, title: string): Promise<void> {
  await page.waitForFunction(() => (document.querySelector("arcgis-basemap-gallery") as unknown as { state?: string })?.state === "ready", undefined, { timeout: 20_000 });
  await expect(async () => {
    await choice(page, title).click();
    await expect(choice(page, title)).toBeChecked({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

async function openGallery(page: Page, options?: Record<string, unknown>): Promise<void> {
  await serveModifiedConfig(page, (c) => (c.components = [{ id: "basemaps", type: "basemap-gallery", ...(options ? { options } : {}) }]));
  await page.goto("./");
  await mapReady(page);
  await sidebarAction(page, "basemaps").click();
  await expect(choices(page).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("basemap gallery (P-37)", () => {
  test("Choose a basemap: the map shows Light gray and the gallery marks it current", async ({ page }) => {
    // Runs in both suites.
    await openGallery(page);
    const start = hasApiKey() ? "ArcGIS Streets" : "OpenStreetMap";
    await expect(choice(page, start)).toBeChecked();

    await choose(page, "Light gray");
    const s = await settled(page, (m) => m.basemapId === "light");
    expect(s.basemapTitle).toBe("Light gray");
    await expect(choice(page, "Light gray")).toBeChecked();
    await expect(choice(page, start)).not.toBeChecked();
  });

  test("Gallery with a key: ten basemaps, and Topographic is a basemap style", async ({ page }) => {
    test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
    await openGallery(page);
    await expect(choices(page)).toHaveText([...FREE, ...KEYED]);
    await choose(page, "ArcGIS Topographic");
    const s = await settled(page, (m) => m.basemapStyleId === "arcgis/topographic");
    expect(s.basemapStyleId).toBe("arcgis/topographic");
  });

  test("Gallery without a key: only the five free basemaps, no basemap styles request, no sign-in", async ({ page, log }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    // The shipped default config.
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "basemaps").click();
    await expect(choices(page)).toHaveText(FREE);
    await page.waitForLoadState("networkidle");
    expect(log.requests.map((r) => r.url()).filter((u) => BASEMAP_STYLES_HOSTS.test(hostOf(u)))).toEqual([]);
    await expect(page.locator(".esri-identity-modal")).toHaveCount(0);
  });

  test("Only keyed basemaps, without a key: no Basemaps panel, and a console warning", async ({ page, log }) => {
    test.skip(hasApiKey(), "Build has an API key; this scenario needs a keyless build");
    await serveModifiedConfig(page, (c) => {
      c.components = [
        { id: "legend", type: "legend" },
        { id: "basemaps", type: "basemap-gallery", options: { basemaps: ["arcgis/streets"] } },
      ];
    });
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible();
    await expect(sidebarAction(page, "basemaps")).toHaveCount(0);
    const warnings = log.console.filter((m) => m.type() === "warning").map((m) => m.text());
    expect(warnings.filter((t) => t.includes('components "basemaps"') && t.includes("basemap gallery"))).toHaveLength(1);
  });
});
