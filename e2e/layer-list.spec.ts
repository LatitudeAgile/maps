import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { mapReady, serveSidebarConfig, sidebarAction } from "./helpers.ts";

/**
 * The visibility control of a layer row. In checkbox mode the SDK draws a Calcite action as a
 * checkbox (icon `check-square-f` when on, `square` when off), named "Hide <title>" or "Show <title>".
 */
const control = (page: Page, title: string) => page.locator("arcgis-layer-list").getByRole("button", { name: new RegExp(`^(Hide|Show) ${title}$`) });
const controlIcon = (page: Page, title: string) =>
  control(page, title).evaluate((el) => ((el.getRootNode() as ShadowRoot).host as HTMLElement).getAttribute("icon"));

const layerVisible = (page: Page, id: string) =>
  page.evaluate((layerId) => (document.querySelector("arcgis-map") as HTMLArcgisMapElement).map?.findLayerById(layerId)?.visible, id);

test.describe("layer list (P-36)", () => {
  test.beforeEach(async ({ page }) => {
    await serveSidebarConfig(page, [{ id: "layers", type: "layer-list" }]);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "layers").click();
  });

  test("Checkbox by default: each layer row shows a checkbox", async ({ page }) => {
    const list = page.locator("arcgis-layer-list");
    expect(await list.evaluate((el: HTMLArcgisLayerListElement) => el.visibilityAppearance)).toBe("checkbox");
    for (const title of ["Survey sites", "Road works"]) {
      await expect(control(page, title)).toBeVisible();
      expect(await controlIcon(page, title)).toBe("check-square-f");
    }
  });

  test("Turn a layer off and on: only that layer changes", async ({ page }) => {
    await expect(control(page, "Road works")).toBeVisible();
    expect(await layerVisible(page, "roads")).toBe(true);

    await control(page, "Road works").click();
    await expect.poll(() => layerVisible(page, "roads")).toBe(false);
    expect(await controlIcon(page, "Road works")).toBe("square");
    expect(await layerVisible(page, "sites")).toBe(true);

    await control(page, "Road works").click();
    await expect.poll(() => layerVisible(page, "roads")).toBe(true);
    expect(await controlIcon(page, "Road works")).toBe("check-square-f");
    expect(await layerVisible(page, "sites")).toBe(true);
  });
});
