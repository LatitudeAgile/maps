import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { geojsonLayer, mapReady, serveModifiedConfig } from "./helpers.ts";

/** Branding: the title box (P-27). Theme tests are further down. */

const titleBox = (page: Page) => page.locator(".title-box");
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe("title box (P-27)", () => {
  test("Custom title on a wide screen: beside the icon bar, same corner radius", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveModifiedConfig(page, (c) => (c.app.title = "Corporate Maps"));
    await page.goto("./");
    await mapReady(page);
    await expect(page.getByRole("heading", { name: "Corporate Maps" })).toBeVisible();
    await expect(page.locator("calcite-shell-panel > calcite-action-bar")).toBeVisible();
    const title = await box(page, ".title-box");
    const bar = await box(page, "calcite-shell-panel > calcite-action-bar");
    expect(title.x).toBeGreaterThanOrEqual(bar.x + bar.width);
    // The same distance from the top as the floating bar (design D10).
    expect(Math.abs(title.y - bar.y)).toBeLessThanOrEqual(1);
    const radii = await page.evaluate(() => ({
      title: getComputedStyle(document.querySelector(".title-box")!).borderTopLeftRadius,
      bar: getComputedStyle(document.querySelector("calcite-shell-panel > calcite-action-bar")!).borderTopLeftRadius,
    }));
    expect(radii.title).toBe(radii.bar);
  });

  test("Title on a phone: top left, clear of the bottom icon bar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await expect(titleBox(page)).toBeVisible();
    await expect(page.locator("calcite-shell-panel > calcite-action-bar")).toBeVisible();
    const title = await box(page, ".title-box");
    const bar = await box(page, "calcite-shell-panel > calcite-action-bar");
    expect(title.x).toBeLessThan(40);
    expect(title.y).toBeLessThan(40);
    expect(title.y + title.height).toBeLessThan(bar.y);
  });

  test("Spacing on a wide screen: level with the bar's top, as far from the bar as the bar is from the map edge", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await expect(titleBox(page)).toBeVisible();
    await expect(page.locator("calcite-shell-panel > calcite-action-bar")).toBeVisible();
    const map = await box(page, "arcgis-map");
    const bar = await box(page, "calcite-shell-panel > calcite-action-bar");
    await expect.poll(async () => Math.abs((await box(page, ".title-box")).y - bar.y)).toBeLessThanOrEqual(1);
    const title = await box(page, ".title-box");
    const barGap = bar.x - map.x;
    expect(Math.abs(title.x - (bar.x + bar.width) - barGap), `title gap vs bar gap ${barGap}`).toBeLessThanOrEqual(1);
  });

  test("Spacing on a phone: 8 px from the map's top and left edges", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./");
    await mapReady(page);
    await expect(titleBox(page)).toBeVisible();
    const map = await box(page, "arcgis-map");
    await expect.poll(async () => Math.abs((await box(page, ".title-box")).y - map.y - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs((await box(page, ".title-box")).x - map.x - 8)).toBeLessThanOrEqual(1);
  });

  test("Top-left components sit below the title", async ({ page }) => {
    await serveModifiedConfig(page, (c) => c.components.push({ id: "corner", type: "home", placement: "top-left" }));
    await page.goto("./");
    await mapReady(page);
    const corner = page.locator('[data-component-id="corner"]');
    await expect(corner).toBeVisible();
    const title = await box(page, ".title-box");
    const home = (await corner.boundingBox())!;
    expect(home.y).toBeGreaterThanOrEqual(title.y + title.height);
    expect(Math.abs(home.x - title.x)).toBeLessThanOrEqual(2);
  });

  test("Title shown before layers settle", async ({ page }) => {
    // A layer whose service never answers: components wait (up to 15 s); the title doesn't.
    await page.context().route("**/config/data/never.geojson", () => undefined);
    await serveModifiedConfig(page, (c) => (c.layers = [geojsonLayer("never")]));
    await page.goto("./");
    await expect(titleBox(page)).toBeVisible();
    expect(await page.locator("[data-component-id]").count()).toBe(0);
  });

  test("Long title on a phone: one line, inside the map, full accessible name", async ({ page }) => {
    const long = "Department of Transportation Regional Operations Viewer";
    await page.setViewportSize({ width: 375, height: 667 });
    await serveModifiedConfig(page, (c) => (c.app.title = long));
    await page.goto("./");
    await mapReady(page);
    await expect(page.getByRole("heading", { name: long, exact: true })).toBeVisible();
    const title = await box(page, ".title-box");
    const lineHeight = await titleBox(page).evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const padding = await titleBox(page).evaluate((el) => parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom));
    expect(title.height).toBeLessThanOrEqual(lineHeight + padding + 1);
    expect(title.x + title.width).toBeLessThanOrEqual(375);
    // Cut off, not wrapped: the text is wider than the box.
    expect(await titleBox(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });

  test("Hidden: no title box, the tab title is still app.title", async ({ page }) => {
    await serveModifiedConfig(page, (c) => {
      c.app.title = "County Viewer";
      c.app.titleVisible = false;
    });
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('[data-component-id="zoom"]')).toBeVisible();
    await expect(titleBox(page)).toHaveCount(0);
    await expect(page).toHaveTitle("County Viewer");
  });
});

test.describe("theme (P-28)", () => {
  const THEME = { color: "#1f6f8b", opacity: 0.85, textColor: "#ffffff" };
  const TEAL = "rgba(31, 111, 139, 0.85)";
  /** The icon bar with a panel open: the theme color, solid. */
  const SOLID_TEAL = "rgb(31, 111, 139)";

  /** Computed colors of the themed parts (the bar and icons draw inside their shadow roots). */
  const colors = (page: Page) =>
    page.evaluate(() => {
      const cs = (el: Element | null | undefined) => (el ? getComputedStyle(el) : undefined);
      const bar = document.querySelector("calcite-shell-panel > calcite-action-bar")!;
      const button = (a: Element) => a.shadowRoot?.querySelector("button");
      const actions = [...bar.querySelectorAll<HTMLCalciteActionElement>("calcite-action[data-panel-for]")].map((a) => ({
        id: a.dataset.panelFor!,
        active: a.active,
        bg: cs(button(a))?.backgroundColor,
        color: cs(button(a))?.color,
        opacity: cs(button(a))?.opacity,
      }));
      const title = document.querySelector(".title-box");
      const panel = [...document.querySelectorAll<HTMLElement>("calcite-shell-panel > calcite-panel")].find((p) => !p.hidden);
      // Resolve Calcite's own tokens for the "No theme" comparison.
      const probe = document.createElement("div");
      probe.style.cssText = "background-color: var(--calcite-color-foreground-1); color: var(--calcite-color-text-1)";
      document.body.append(probe);
      const calcite = { bg: cs(probe)!.backgroundColor, color: cs(probe)!.color };
      probe.remove();
      return {
        bar: cs(bar.shadowRoot?.querySelector(".container"))?.backgroundColor,
        actions,
        title: title && { bg: cs(title)!.backgroundColor, color: cs(title)!.color, opacity: cs(title)!.opacity },
        panel: panel && cs(panel.shadowRoot?.querySelector(".content-wrapper") ?? panel)!.backgroundColor,
        calcite,
      };
    });

  const openLegend = async (page: Page) => {
    await page.locator('calcite-action[data-panel-for="legend"]').click();
    await expect.poll(() => page.evaluate(() => !document.querySelector<HTMLElement>('calcite-panel[data-panel-for="legend"]')!.hidden)).toBe(true);
    await page.mouse.move(900, 400); // off the icons, so none shows its hover color
  };

  test("Themed on a wide screen: bar and title in the theme color, opaque white text and icons, panels unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // The panel's background without a theme, for comparison.
    await serveModifiedConfig(page, (c) => delete c.app.theme);
    await page.goto("./");
    await mapReady(page);
    await openLegend(page);
    const plainPanel = (await colors(page)).panel;

    await page.unroute("**/config/viewer.json");
    await serveModifiedConfig(page, (c) => (c.app.theme = THEME));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('calcite-action[data-panel-for="legend"]')).toBeVisible();
    // Collapsed: the bar at the theme's opacity.
    await expect.poll(async () => (await colors(page)).bar).toBe(TEAL);
    await openLegend(page);
    const c = await colors(page);
    // A panel open: the bar solid; the title box keeps the opacity.
    expect(c.bar).toBe(SOLID_TEAL);
    expect(c.title).toEqual({ bg: TEAL, color: "rgb(255, 255, 255)", opacity: "1" });
    for (const a of c.actions) {
      expect(a.color, a.id).toBe("rgb(255, 255, 255)");
      expect(a.opacity, a.id).toBe("1");
    }
    expect(c.panel).toBe(plainPanel);
  });

  test("Themed bottom bar on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveModifiedConfig(page, (c) => (c.app.theme = THEME));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('calcite-action[data-panel-for="legend"]')).toBeVisible();
    await expect.poll(async () => (await colors(page)).bar).toBe(TEAL);
    await openLegend(page);
    await expect.poll(async () => (await colors(page)).bar).toBe(SOLID_TEAL);
  });

  test("Solid while a panel is open: translucent again once the sidebar closes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveModifiedConfig(page, (c) => (c.app.theme = THEME));
    await page.goto("./");
    await mapReady(page);
    await openLegend(page);
    await expect.poll(async () => (await colors(page)).bar).toBe(SOLID_TEAL);
    // The edge around the bar follows, so no translucent frame shows beside it.
    const edge = () =>
      page.evaluate(() => getComputedStyle(document.querySelector("calcite-shell-panel > calcite-action-bar")!).borderTopColor);
    expect(await edge()).toBe("rgb(31, 111, 139)");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await colors(page)).bar).toBe(TEAL);
    expect(await edge()).toBe(TEAL);
  });

  test("No theme: Calcite's default foreground and text colors", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveModifiedConfig(page, (c) => delete c.app.theme);
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('calcite-action[data-panel-for="legend"]')).toBeVisible();
    const c = await colors(page);
    expect(c.bar).toBe(c.calcite.bg);
    expect(c.title?.bg).toBe(c.calcite.bg);
    expect(c.title?.color).toBe(c.calcite.color);
    await expect(page.locator("calcite-shell.themed")).toHaveCount(0);
  });

  test("Open panel marked: the open panel's icon stands out on the themed bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveModifiedConfig(page, (c) => (c.app.theme = { color: "#1f6f8b" }));
    await page.goto("./");
    await mapReady(page);
    await openLegend(page);
    const c = await colors(page);
    const open = c.actions.find((a) => a.id === "legend")!;
    const others = c.actions.filter((a) => a.id !== "legend");
    expect(open.active).toBe(true);
    expect(open.bg).not.toBe(c.bar);
    for (const o of others) expect(open.bg, o.id).not.toBe(o.bg);
  });
});
