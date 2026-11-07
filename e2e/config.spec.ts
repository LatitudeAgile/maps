import { test, expect } from "./fixtures.ts";
import { defaultConfig, mapReady, serveConfig, serveModifiedConfig, settled, withinFraction } from "./helpers.ts";

test.describe("invalid or unreadable config stops startup", () => {
  test("Out-of-range coordinate: error names map.center[1], no map", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.map.center = [-98.5, 120]));
    await page.goto("./");
    const error = page.locator("#config-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("map.center[1]");
    await expect(error).toContainText("latitude between -90 and 90");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("Wrong type: error names map.zoom as a number 0 or greater, no map", async ({ page }) => {
    await serveModifiedConfig(page, (c) => {
      delete c.map.scale; // the shipped config sets scale; zoom and scale together is a different error
      c.map.zoom = "five";
    });
    await page.goto("./");
    const error = page.locator("#config-error");
    await expect(error).toContainText("map.zoom");
    await expect(error).toContainText("number 0 or greater");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("Multiple problems are listed together", async ({ page }) => {
    await serveModifiedConfig(page, (c) => {
      c.map.basemap = "";
      c.portal.url = "http://www.arcgis.com";
    });
    await page.goto("./");
    const items = page.locator("#config-error li");
    await expect(items).toHaveCount(2);
    await expect(page.locator("#config-error")).toContainText("map.basemap");
    await expect(page.locator("#config-error")).toContainText("portal.url");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("Config file missing: error includes the URL and the 404 status", async ({ page, baseURL }) => {
    await serveConfig(page, "Not found", 404);
    await page.goto("./");
    const error = page.locator("#config-error");
    await expect(error).toContainText(new URL("config/viewer.json", baseURL).href);
    await expect(error).toContainText("404");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("Malformed JSON: error says the config is not valid JSON", async ({ page }) => {
    await serveConfig(page, '{ "map": { "zoom": 5, } }');
    await page.goto("./");
    await expect(page.locator("#config-error")).toContainText("not valid JSON");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });

  test("API key placed in config: error names portal.apiKey and does not show the value", async ({ page, log }) => {
    const secret = "NOT-A-REAL-KEY-but-must-not-be-shown";
    await serveModifiedConfig(page, (c) => (c.portal.apiKey = secret));
    await page.goto("./");
    const error = page.locator("#config-error");
    await expect(error).toContainText("portal.apiKey");
    await expect(error).toContainText("VITE_ARCGIS_API_KEY");
    expect(await page.locator("body").innerText()).not.toContain(secret);
    expect(log.console.map((m) => m.text()).join("\n")).not.toContain(secret);
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });
});

test.describe("tolerated settings", () => {
  const configWarnings = (texts: string[]) => texts.filter((t) => t.startsWith("Viewer config:"));

  test("All recognized settings present: starts normally with no config warning", async ({ page, log }) => {
    await serveModifiedConfig(page, (c) => {
      c.debug = false;
      c.request = { proxyRules: [] };
      c.layers ??= [];
      c.components ??= [];
    });
    await page.goto("./");
    await mapReady(page);
    const warnings = configWarnings(log.console.filter((m) => m.type() === "warning").map((m) => m.text()));
    expect(warnings).toEqual([]);
  });

  test("Unknown setting: starts normally and logs one warning naming it", async ({ page, log }) => {
    await serveModifiedConfig(page, (c) => (c.colour = "blue"));
    await page.goto("./");
    await mapReady(page);
    const warnings = configWarnings(log.console.filter((m) => m.type() === "warning").map((m) => m.text()));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("colour");
  });
});

test("Custom title: the browser tab title comes from app.title", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.app.title = "County Viewer"));
  await page.goto("./");
  await expect(page).toHaveTitle("County Viewer");
});

test("Deployed config is edited without rebuilding: new map.scale applies on reload", async ({ page }) => {
  await page.goto("./");
  await mapReady(page);
  const before = (await settled(page)).scale;
  expect(withinFraction(before, 18_489_298), `scale ${before}`).toBe(true);

  // Change the served file (not the bundle) and reload. 4,622,324 is two levels closer.
  await serveModifiedConfig(page, (c) => (c.map.scale = 4_622_324));
  await page.reload();
  await mapReady(page);
  const after = (await settled(page)).scale;
  expect(withinFraction(after, 4_622_324), `scale ${after}`).toBe(true);
});

test("Zoom instead of scale: a config with map.zoom only opens at that zoom", async ({ page }) => {
  await serveModifiedConfig(page, (c) => {
    delete c.map.scale;
    c.map.zoom = 3;
  });
  await page.goto("./");
  await mapReady(page);
  expect((await settled(page)).zoom).toBe(3);
});

test("Both zoom and scale set: error at map, no map", async ({ page }) => {
  await serveModifiedConfig(page, (c) => (c.map.zoom = 5));
  await page.goto("./");
  await expect(page.locator("#config-error")).toContainText("map: Set either map.zoom or map.scale, not both.");
  await expect(page.locator("arcgis-map")).toHaveCount(0);
});

test.describe("?config= selects an alternate config", () => {
  test("Named config: ?config=county loads config/county.json", async ({ page, log }) => {
    const county = defaultConfig();
    county.app.title = "County Viewer";
    county.map.center = [-122.4194, 37.7749];
    await page.route("**/config/county.json", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(county) }),
    );
    await page.goto("./?config=county");
    await mapReady(page);
    await expect(page).toHaveTitle("County Viewer");
    const s = await settled(page);
    expect(Math.abs(s.center[0] - -122.4194)).toBeLessThan(0.01);
    const configRequests = log.requests.map((r) => r.url()).filter((u) => u.includes("/config/"));
    expect(configRequests).toEqual([expect.stringContaining("/config/county.json")]);
  });

  for (const value of ["../secrets", "https://example.com/viewer.json"]) {
    test(`Path or URL rejected: ?config=${value}`, async ({ page, log }) => {
      await page.goto(`./?config=${encodeURIComponent(value)}`);
      const error = page.locator("#config-error");
      await expect(error).toBeVisible();
      await expect(error).toContainText('"config" URL parameter');
      await expect(page.locator("arcgis-map")).toHaveCount(0);
      // Ignore the page's own navigation request, whose URL carries the parameter.
      const configRequests = log.requests.filter(
        (r) => r.resourceType() !== "document" && /config\/|viewer\.json|secrets|example\.com/.test(r.url()),
      );
      expect(configRequests.map((r) => r.url())).toEqual([]);
    });
  }

  test("Named config missing: error includes config/nothere.json and the 404", async ({ page, baseURL }) => {
    // vite preview answers missing files with index.html, so serve the 404 explicitly.
    await page.route("**/config/nothere.json", (route) => route.fulfill({ status: 404, body: "Not found" }));
    await page.goto("./?config=nothere");
    const error = page.locator("#config-error");
    await expect(error).toContainText(new URL("config/nothere.json", baseURL).href);
    await expect(error).toContainText("404");
    await expect(page.locator("arcgis-map")).toHaveCount(0);
  });
});
