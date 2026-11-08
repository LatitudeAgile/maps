import type { Request } from "@playwright/test";
import { test, expect, hasApiKey, buildApiKey } from "./fixtures.ts";
import { drawnFeatureCount, geojsonLayer, hostOf, isBasemapStyleRequest, mapReady, serveGeocoder, serveGeoJSON, serveModifiedConfig, settled, sidebarAction } from "./helpers.ts";

test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");

const key = () => buildApiKey() as string;

/** True if the request carries the key in its URL or any header. */
function carriesKey(req: Request, k: string): boolean {
  if (req.url().includes(k) || req.url().includes(encodeURIComponent(k))) return true;
  return Object.values(req.headers()).some((v) => v.includes(k));
}

test("API key present: ArcGIS Streets is shown with no notice", async ({ page }) => {
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapStyleId).toBe("arcgis/streets");
  await expect(page.locator("#notices calcite-notice")).toHaveCount(0);
});

/** ArcGIS routing and geocoding hosts, which Directions may send the key to (service-credentials). */
const ARCGIS_ROUTING_OR_GEOCODING = /(^|\.)(route|route-api|geocode|geocode-api)\.arcgis\.com$/;

test("Requests to other hosts carry no key (default config, an external layer, and a search)", async ({ page, log }) => {
  // An operational layer on another https host must not receive the key.
  await serveGeoJSON(page, "https://data.example.com/sites.geojson");
  await serveGeocoder(page);
  await serveModifiedConfig(page, (c) => {
    c.layers = [{ id: "sites", type: "geojson", url: "https://data.example.com/sites.geojson" }];
  });
  await page.goto("./");
  await mapReady(page);
  await expect(page.locator('[data-component-id="home"]')).toBeVisible();
  expect(await drawnFeatureCount(page, "sites")).toBe(3);

  // Search for an address, and open Directions so it loads its route service.
  await sidebarAction(page, "search").click();
  const input = page.locator("arcgis-search input").first();
  await input.fill("Denv");
  await expect(page.getByRole("option", { name: /^Denver, CO, USA/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  await input.press("ArrowDown");
  await input.press("Enter");
  await sidebarAction(page, "directions").click();
  await settled(page);
  await page.waitForLoadState("networkidle");
  expect(log.requests.some((r) => r.url().includes("/GeocodeServer/findAddressCandidates"))).toBe(true);
  expect(log.requests.some((r) => r.url().startsWith("https://data.example.com/"))).toBe(true);

  const keyed = log.requests.filter((r) => carriesKey(r, key()));
  // The key must actually be in use, or this test proves nothing.
  expect(keyed.length).toBeGreaterThan(0);

  // Report offenders by host and path only, so a failure never prints the key.
  const offenders = [
    ...new Set(
      keyed
        .filter((r) => !isBasemapStyleRequest(r.url()) && !ARCGIS_ROUTING_OR_GEOCODING.test(hostOf(r.url())))
        .map((r) => `${hostOf(r.url())}${new URL(r.url()).pathname}`),
    ),
  ];
  expect(offenders, "requests outside ArcGIS basemap styles, routing, and geocoding that carried the key").toEqual([]);
  // Search's geocoder is keyless: none of its requests carry the key.
  expect(keyed.filter((r) => r.url().includes("/GeocodeServer/")).map((r) => new URL(r.url()).pathname)).toEqual([]);

  // The key must actually reach the basemap styles service itself.
  expect(keyed.some((r) => hostOf(r.url()) === "basemapstyles-api.arcgis.com")).toBe(true);
});

test.describe("Key not echoed", () => {
  async function expectNoKey(page: import("@playwright/test").Page, consoleTexts: string[]) {
    const pageText = await page.evaluate(() => {
      // Include open shadow roots, where component text lives.
      const parts: string[] = [];
      const walk = (root: Document | ShadowRoot | Element) => {
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) {
            parts.push(el.shadowRoot.textContent ?? "");
            walk(el.shadowRoot);
          }
        }
      };
      parts.push(document.body.innerText);
      walk(document);
      return parts.join("\n");
    });
    expect(pageText).not.toContain(key());
    expect(consoleTexts.join("\n")).not.toContain(key());
  }

  test("normal start", async ({ page, log }) => {
    await page.goto("./");
    await mapReady(page);
    await settled(page);
    await page.waitForLoadState("networkidle");
    await expectNoKey(page, log.console.map((m) => m.text()));
  });

  test("start with an invalid config", async ({ page, log }) => {
    await serveModifiedConfig(page, (c) => (c.map.center = [-98.5, 120]));
    await page.goto("./");
    await expect(page.locator("#config-error")).toBeVisible();
    await expectNoKey(page, log.console.map((m) => m.text()));
  });
});

test("Debug output carries no key: debug on, with a failing layer", async ({ page, log }) => {
  await serveGeoJSON(page, "**/config/data/broken.geojson", "points.geojson", { status: 404 });
  await serveModifiedConfig(page, (c) => {
    c.debug = true;
    c.layers = [geojsonLayer("broken")];
  });
  await page.goto("./");
  await mapReady(page);
  await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
  // The failure was logged through the error channel...
  await expect.poll(() => log.console.filter((m) => m.text().includes("layer:broken")).length).toBeGreaterThan(0);
  // ...and nothing in the console carries the key.
  expect(log.console.map((m) => m.text()).join(" | ")).not.toContain(key());
});
