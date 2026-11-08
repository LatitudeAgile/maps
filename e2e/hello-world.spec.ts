import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { mapReady, serveModifiedConfig, settled, sidebarAction } from "./helpers.ts";

const byId = (page: Page, id: string) => page.locator(`[data-component-id="${id}"]`);
/** The value shown in a hello-world row ("center" or "scale"). */
const shown = (page: Page, id: string, row: "center" | "scale") => byId(page, id).locator(`dd[data-value="${row}"]`);

async function serveHello(page: Page, components: Record<string, unknown>[]): Promise<void> {
  await serveModifiedConfig(page, (c) => (c.components = components));
  await page.goto("./");
  await mapReady(page);
}

async function panTo(page: Page, lon: number, lat: number): Promise<void> {
  await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement, [x, y]) => el.goTo({ center: [x, y] }, { animate: false }), [lon, lat]);
  await settled(page, (m) => Math.abs(m.center[0] - lon) < 0.01 && Math.abs(m.center[1] - lat) < 0.01);
}

test.describe("custom components: hello-world (P-38)", () => {
  test("Custom type in a corner and in a panel: both find the map", async ({ page }) => {
    await serveHello(page, [
      { id: "corner", type: "hello-world", placement: "top-right" },
      { id: "panel", type: "hello-world" },
    ]);
    // Corner: inside the map, in the top-right corner.
    const corner = byId(page, "corner");
    await expect(corner).toBeVisible();
    const box = (await corner.boundingBox())!;
    const map = (await page.locator("arcgis-map").boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(map.x + map.width - 120);
    expect(box.y).toBeLessThan(map.y + 120);
    // Panel: a sidebar icon with the type's default heading and icon.
    const action = sidebarAction(page, "panel");
    // Calcite doesn't reflect these to attributes; read the properties.
    expect(await action.evaluate((el: HTMLCalciteActionElement) => [el.text, el.icon])).toEqual(["Hello", "code"]);
    await action.click();
    // Both show the map's center (the shipped default view).
    for (const id of ["corner", "panel"]) await expect(shown(page, id, "center")).toHaveText("-98.58, 39.83");
  });

  test("Greeting from config", async ({ page }) => {
    await serveHello(page, [{ id: "hello", type: "hello-world", placement: "top-right", options: { greeting: "Hi from the team" } }]);
    expect(await byId(page, "hello").locator("calcite-block").evaluate((el: HTMLCalciteBlockElement) => el.heading)).toBe("Hi from the team");
    await expect(byId(page, "hello").getByText("Hi from the team")).toBeVisible();
  });

  test("Default greeting: Hello, world", async ({ page }) => {
    await serveHello(page, [{ id: "hello", type: "hello-world", placement: "top-right" }]);
    await expect(byId(page, "hello").getByText("Hello, world")).toBeVisible();
  });

  test("Follows the map: the panel shows the new center after a pan", async ({ page }) => {
    await serveHello(page, [{ id: "hello", type: "hello-world" }]);
    await sidebarAction(page, "hello").click();
    await panTo(page, -104.99, 39.74);
    await expect(shown(page, "hello", "center")).toHaveText("-104.99, 39.74", { timeout: 2_000 });
    await expect(shown(page, "hello", "scale")).toHaveText(/^1:[\d,]+$/);
  });

  test("Stops following when removed: no error, and the removed element's text doesn't change", async ({ page, log }) => {
    await serveHello(page, [{ id: "hello", type: "hello-world", placement: "top-right" }]);
    await expect(shown(page, "hello", "center")).toHaveText("-98.58, 39.83");
    const removed = await byId(page, "hello").evaluateHandle((el) => {
      el.remove();
      return el;
    });
    await panTo(page, -104.99, 39.74);
    await page.waitForTimeout(500);
    const text = await removed.evaluate((el) => el.shadowRoot?.querySelector('dd[data-value="center"]')?.textContent);
    expect(text).toBe("-98.58, 39.83");
    expect(log.console.filter((m) => m.type() === "error").map((m) => m.text())).toEqual([]);
  });
});
