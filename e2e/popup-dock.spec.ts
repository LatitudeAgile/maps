import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { clickMapAt, mapReady, serveSidebarConfig, sidebarAction } from "./helpers.ts";

// Popups open undocked, and dock clear of the phone bottom bar (sidebar,
// add-print-and-sketch-panels D14). The fixture's "sites" layer has a point at Lebanon, KS,
// where the map is centered.
const LEBANON: [number, number] = [-98.5794, 39.8281];

/** The open popup's docking and box, and the top of the sidebar's visible parts. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const popup = (document.querySelector("arcgis-map") as HTMLArcgisMapElement).popupElement as unknown as HTMLElement & {
      open: boolean;
      dockEnabled: boolean;
      currentDockPosition?: string | null;
      dockOptions: { position?: string };
    };
    const main = popup.shadowRoot?.querySelector(".main-container")?.getBoundingClientRect();
    const parts = [
      document.querySelector("calcite-shell-panel > calcite-action-bar"),
      ...[...document.querySelectorAll<HTMLElement>("calcite-shell-panel > calcite-panel")].filter((p) => !p.hidden),
    ].filter((e): e is Element => !!e);
    return {
      open: popup.open,
      docked: popup.dockEnabled,
      dock: popup.currentDockPosition ?? null,
      position: popup.dockOptions.position,
      popupBottom: main ? main.bottom : NaN,
      sidebarTop: Math.min(...parts.map((e) => e.getBoundingClientRect().top)),
    };
  });

async function serve(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await serveSidebarConfig(page, [{ id: "legend", type: "legend", placement: "panel" }], (c) => {
    c.map.basemap = "osm";
    c.map.center = LEBANON;
    c.map.scale = 4_000_000;
    delete c.map.zoom;
  });
  await page.goto("./");
  await mapReady(page);
}

test.describe("popup docking (sidebar)", () => {
  test("Undocked on a phone: the popup opens beside the feature, above the icon bar", async ({ page }) => {
    await serve(page, 375, 667);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await layout(page)).open).toBe(true);
    const l = await layout(page);
    expect(l.docked).toBe(false);
    expect(l.popupBottom).toBeLessThanOrEqual(l.sidebarTop);
  });

  test("Undocked on a wide screen", async ({ page }) => {
    await serve(page, 1280, 800);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await layout(page)).open).toBe(true);
    expect((await layout(page)).docked).toBe(false);
  });

  test("Docked by the user on a phone: at the top, clear of an open panel", async ({ page }) => {
    await serve(page, 375, 667);
    await sidebarAction(page, "legend").click();
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await layout(page)).open).toBe(true);
    await page.locator("arcgis-popup").getByRole("button", { name: /^dock/i }).first().click();
    await expect.poll(async () => (await layout(page)).dock).toBe("top-center");
    const l = await layout(page);
    expect(l.popupBottom).toBeLessThanOrEqual(l.sidebarTop);
  });

  test("Docked by the user on a wide screen: the SDK's default position", async ({ page }) => {
    await serve(page, 1280, 800);
    await expect.poll(async () => (await layout(page)).position).toBe("auto");
  });
});
