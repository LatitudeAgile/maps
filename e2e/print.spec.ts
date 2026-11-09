import { test, expect, hasApiKey } from "./fixtures.ts";
import { DEFAULT_PRINT_SERVICE, exportPrint, mapReady, serveModifiedConfig, servePrint, sidebarAction } from "./helpers.ts";

/** A print service on another host, answered from fixtures. */
const OTHER_PRINT = "https://print.example.com/arcgis/rest/services/Utilities/PrintingTools/GPServer";
const OTHER_PRINT_TASK = `${OTHER_PRINT}/Export%20Web%20Map%20Task`;

test.describe("print (P-60)", () => {
  test("Export through a configured service: the request goes there with the title, and the file is listed", async ({ page }) => {
    // Runs in both suites: the fixture service needs no key.
    const exports = await servePrint(page, OTHER_PRINT);
    await serveModifiedConfig(page, (c) => {
      c.map.basemap = "osm";
      c.components = [{ id: "print", type: "print", options: { printServiceUrl: OTHER_PRINT_TASK } }];
    });
    await page.goto("./");
    await mapReady(page);

    await sidebarAction(page, "print").click();
    const title = page.locator("arcgis-print").getByRole("textbox", { name: /title/i }).filter({ visible: true }).first();
    await title.fill("Site visit");
    const sent = await exportPrint(page, exports);

    expect(sent.url.startsWith(`${OTHER_PRINT}/Export%20Web%20Map%20Task/`)).toBe(true);
    expect(sent.webMap.layoutOptions?.titleText).toBe("Site visit");
    await expect(page.locator("arcgis-print").getByText(/\.pdf$/i).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("Default service: the viewer sets no print service, and the export goes to the component's default", async ({ page }) => {
    const exports = await servePrint(page, DEFAULT_PRINT_SERVICE);
    await serveModifiedConfig(page, (c) => {
      c.map.basemap = "osm";
      c.components = [{ id: "print", type: "print" }];
    });
    await page.goto("./");
    await mapReady(page);

    await sidebarAction(page, "print").click();
    // Nothing assigned by the viewer: the component reports no URL of its own setting.
    expect(await page.locator("arcgis-print").evaluate((el: HTMLArcgisPrintElement) => el.printServiceUrl ?? null)).toBeNull();
    const sent = await exportPrint(page, exports);
    expect(sent.url.startsWith(`${DEFAULT_PRINT_SERVICE}/Export%20Web%20Map%20Task/`)).toBe(true);
  });

  test("Default service without a key: a real map image export, no sign-in @live", async ({ page }) => {
    test.skip(hasApiKey(), "keyless check; the build has an API key");
    await page.goto("./");
    await mapReady(page);

    await sidebarAction(page, "print").click();
    const print = page.locator("arcgis-print");
    await print.getByRole("tab", { name: /map only/i }).click();
    await print.getByRole("button", { name: /^export$/i }).filter({ visible: true }).first().click();
    await expect(print.getByText(/\.(jpg|png|pdf)$/i).filter({ visible: true }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("calcite-dialog, .esri-identity-modal").filter({ hasText: /sign in/i })).toHaveCount(0);
  });
});
