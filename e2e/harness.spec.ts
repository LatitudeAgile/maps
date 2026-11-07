import { test, expect, hasApiKey } from "./fixtures.ts";

test("smoke: the page opens", async ({ page, log }) => {
  const response = await page.goto("./");
  expect(response?.ok()).toBe(true);
  await expect(page.locator("calcite-shell")).toBeAttached();
  expect(log.requests.length).toBeGreaterThan(0);
});

test("harness: key-dependent tests skip without a key", async ({ page }) => {
  test.skip(!hasApiKey(), "No VITE_ARCGIS_API_KEY configured");
  await page.goto("./");
  await expect(page.locator("calcite-shell")).toBeAttached();
});
