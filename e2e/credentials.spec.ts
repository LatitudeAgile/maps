import type { Request } from "@playwright/test";
import { test, expect, hasApiKey, buildApiKey } from "./fixtures.ts";
import { hostOf, isBasemapStyleRequest, mapReady, serveModifiedConfig, settled } from "./helpers.ts";

test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");

const key = () => buildApiKey() as string;

/** True if the request carries the key in its URL or any header. */
function carriesKey(req: Request, k: string): boolean {
  if (req.url().includes(k) || req.url().includes(encodeURIComponent(k))) return true;
  return Object.values(req.headers()).some((v) => v.includes(k));
}

test("API key present: ArcGIS Streets is shown with no fallback notice", async ({ page }) => {
  await page.goto("./");
  await mapReady(page);
  const s = await settled(page);
  expect(s.basemapStyleId).toBe("arcgis/streets");
  await expect(page.locator("#fallback-notice")).toHaveCount(0);
  await expect(page.locator("#map-error")).toHaveCount(0);
});

test("Requests to other hosts carry no key", async ({ page, log }) => {
  await page.goto("./");
  await mapReady(page);
  await settled(page);
  await page.waitForLoadState("networkidle");

  const keyed = log.requests.filter((r) => carriesKey(r, key()));
  // The key must actually be in use, or this test proves nothing.
  expect(keyed.length).toBeGreaterThan(0);

  // Report offenders by host and path only, so a failure never prints the key.
  const offenders = [
    ...new Set(
      keyed.filter((r) => !isBasemapStyleRequest(r.url())).map((r) => `${hostOf(r.url())}${new URL(r.url()).pathname}`),
    ),
  ];
  expect(offenders, "requests outside the basemap styles service that carried the key").toEqual([]);

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
