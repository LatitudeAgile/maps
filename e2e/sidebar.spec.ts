import { test, expect as baseExpect } from "./fixtures.ts";
import {
  geojsonLayer,
  mapReady,
  mapToScreen,
  openPanels,
  serveModifiedConfig,
  serveSidebarConfig,
  settled,
  sidebarAction,
  sidebarPanel,
  sidebarRightEdge,
  sidebarWidth,
  withinFraction,
} from "./helpers.ts";

/** Sidebar icons appear once layers settle, which the spec allows to take up to 15 s. */
const SIDEBAR_READY_MS = 20_000;
/** Every sidebar assertion allows for that start-up time; passing checks still return at once. */
const expect = baseExpect.configure({ timeout: SIDEBAR_READY_MS });

const LEGEND_AND_HOME = [
  { id: "legend", type: "legend" },
  { id: "start", type: "home", placement: "panel", panel: { heading: "Start over" } },
];

test.describe("sidebar contents", () => {
  test("Two panel components: icons in config order with headings and icons", async ({ page }) => {
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend", panel: { heading: "Map key", icon: "list" } },
      { id: "home", type: "home", placement: "panel" },
    ]);
    await page.goto("./");
    await mapReady(page);
    const actions = page.locator("calcite-action[data-panel-for]");
    await expect(actions).toHaveCount(2);
    const props = await actions.evaluateAll((els) =>
      (els as HTMLCalciteActionElement[]).map((a) => ({ id: a.dataset.panelFor, text: a.text, icon: a.icon })),
    );
    expect(props).toEqual([
      { id: "legend", text: "Map key", icon: "list" },
      { id: "home", text: "Home", icon: "home" },
    ]);
  });

  test("No panel components: no sidebar, controls laid out as before", async ({ page }) => {
    await serveModifiedConfig(page, (c) => (c.components = [{ id: "home", type: "home", placement: "top-left" }]));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('[data-component-id="home"]')).toBeVisible();
    await expect(page.locator("calcite-shell-panel")).toHaveCount(0);
    const zoom = (await page.locator("arcgis-zoom").boundingBox())!;
    expect(zoom.x).toBeLessThan(40);
  });

  test("Initial state: icons shown, no panel open", async ({ page }) => {
    await serveSidebarConfig(page, LEGEND_AND_HOME);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
    await expect(sidebarAction(page, "start")).toBeVisible({ timeout: SIDEBAR_READY_MS });
    expect(await openPanels(page)).toEqual([]);
  });
});

test.describe("open, switch, collapse", () => {
  test.beforeEach(async ({ page }) => {
    await serveSidebarConfig(page, LEGEND_AND_HOME);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
  });

  test("Open: the Legend panel shows its heading and the configured layers", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    const panel = sidebarPanel(page, "legend");
    expect(await panel.evaluate((p: HTMLCalcitePanelElement) => p.heading)).toBe("Legend");
    await expect(panel.locator("arcgis-legend")).toContainText("Survey sites", { timeout: 15_000 });
    await expect(panel.locator("arcgis-legend")).toContainText("Road works");
  });

  test("Switch: clicking the other icon opens it and closes the Legend", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await sidebarAction(page, "start").click();
    await expect.poll(() => openPanels(page)).toEqual(["start"]);
  });

  test("Collapse by icon: clicking the open panel's icon closes it", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual([]);
  });

  test("Close: the panel's close button collapses the sidebar, icons remain", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await sidebarPanel(page, "legend").getByRole("button", { name: "Close" }).click();
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
    // Reopening after a close works.
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
  });
});

test.describe("legend panel (P-33)", () => {
  const openLegend = async (page: import("@playwright/test").Page) => {
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    return sidebarPanel(page, "legend").locator("arcgis-legend");
  };

  test("All layers by default: one entry per configured layer", async ({ page }) => {
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    const legend = await openLegend(page);
    await expect(legend).toContainText("Survey sites", { timeout: 15_000 });
    await expect(legend).toContainText("Road works");
  });

  test("Chosen layers with titles: only the listed layer, under its configured title", async ({ page }) => {
    await serveSidebarConfig(page, [{ id: "legend", type: "legend", options: { layerInfos: [{ layer: "sites", title: "Sites to visit" }] } }]);
    const legend = await openLegend(page);
    await expect(legend).toContainText("Sites to visit", { timeout: 15_000 });
    await expect(legend).not.toContainText("Road works");
    await expect(legend).not.toContainText("Survey sites");
  });

  test("Placement omitted: the legend is shown as a sidebar panel", async ({ page }) => {
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
    // Not slotted into the map.
    expect(await page.locator("arcgis-map > arcgis-legend").count()).toBe(0);
  });
});

test.describe("room for the sidebar (P-05)", () => {
  const CENTER: [number, number] = [-98.579404, 39.828127];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend" },
      { id: "home", type: "home", placement: "top-right" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
  });

  test("Home with a panel open: the configured center is drawn mid-way across the uncovered map", async ({ page }) => {
    // Wait until the view padding has caught up with the open panel.
    await expect
      .poll(async () => (await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.padding.left)) ?? 0)
      .toBeGreaterThan(200);
    // Move away, then go Home.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await settled(page);
    await page.locator('[data-component-id="home"]').getByRole("button").click();
    await settled(page, (s) => withinFraction(s.scale, 18_489_298));
    const edge = await sidebarRightEdge(page);
    const drawn = await mapToScreen(page, ...CENTER);
    expect(Math.abs(drawn.x - (edge + 1280) / 2)).toBeLessThanOrEqual(10);
    expect(Math.abs(drawn.y - 800 / 2)).toBeLessThanOrEqual(10);
  });

  test("Map still fills the window with a panel open", async ({ page }) => {
    expect(await page.locator("arcgis-map").boundingBox()).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });
});

test.describe("controls and notices stay clear (P-24)", () => {
  const boxOf = (page: import("@playwright/test").Page, selector: string) =>
    page.evaluate((sel) => {
      const map = document.querySelector("arcgis-map")!;
      const el = document.querySelector(sel) ?? map.shadowRoot?.querySelector(sel);
      // Not rendered yet: report a position that fails the checks, so polls keep waiting.
      if (!el) return { left: -1, right: -1, top: -1, bottom: -1 };
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    }, selector);

  test("Zoom buttons move with the sidebar, open and closed; so do corner components and the attribution", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend" },
      { id: "corner", type: "home", placement: "bottom-left" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('[data-component-id="corner"]')).toBeVisible();
    for (const state of ["collapsed", "open", "closed again"]) {
      if (state !== "collapsed") await sidebarAction(page, "legend").click();
      await expect.poll(() => openPanels(page)).toEqual(state === "open" ? ["legend"] : []);
      const edge = await sidebarRightEdge(page);
      for (const sel of ["arcgis-zoom", '[data-component-id="corner"]', ".esri-view-attribution"]) {
        await expect.poll(async () => (await boxOf(page, sel)).left, { message: `${sel} when ${state}` }).toBeGreaterThanOrEqual(edge);
      }
    }
  });

  test("Notice beside an open panel: the layer-error notice doesn't overlap the sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // A third layer that fails to load, so the layer-error notice shows.
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }], (c) => c.layers.push(geojsonLayer("broken")));
    await page.route("**/data/broken.geojson", (route) => route.fulfill({ status: 404, body: "Not found" }));
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator("#layer-errors")).toBeVisible({ timeout: 20_000 });
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await expect.poll(async () => (await boxOf(page, "#layer-errors")).left).toBeGreaterThanOrEqual(await sidebarRightEdge(page));
  });
});

test.describe("responsive layout (P-25)", () => {
  for (const [viewport, expected] of [
    [800, 305],
    [1000, 390],
    [1280, 460],
  ] as const) {
    test(`Widths at each breakpoint: ${expected} px at a ${viewport} px viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport, height: 800 });
      await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
      await page.goto("./");
      await mapReady(page);
      await sidebarAction(page, "legend").click();
      await expect.poll(() => openPanels(page)).toEqual(["legend"]);
      await expect.poll(() => sidebarWidth(page)).toBeGreaterThanOrEqual(expected - 2);
      expect(await sidebarWidth(page)).toBeLessThanOrEqual(expected + 2);
    });
  }
});

test.describe("narrow screens (P-25)", () => {
  const boxes = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const b = (e: Element | null) => {
        const r = e!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
      };
      return {
        bar: b(document.querySelector("calcite-shell-panel calcite-action-bar")),
        panel: b(document.querySelector('calcite-panel[data-panel-for="legend"]')),
        scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      };
    });

  test("Phone layout: bottom bar, full-width panel above it, top 40% of the map uncovered, no scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await expect.poll(async () => (await boxes(page)).bar.bottom).toBeCloseTo(667, 0);
    // Let the open animation settle: the panel ends directly above the bar (sub-pixel rounding aside).
    await expect.poll(async () => { const x = await boxes(page); return Math.abs(x.panel.bottom - x.bar.top); }).toBeLessThanOrEqual(3);
    const b = await boxes(page);
    expect(b.bar.left).toBeLessThanOrEqual(1);
    expect(b.bar.right).toBeGreaterThanOrEqual(374);
    expect(b.panel.width).toBeGreaterThanOrEqual(373);
    expect(b.panel.top).toBeGreaterThanOrEqual(267);
    expect(b.scroll).toEqual({ w: 375, h: 667 });
  });

  test("Bottom controls stay clear on a phone: a bottom-right component sits above the bar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend" },
      { id: "corner", type: "home", placement: "bottom-right" },
    ]);
    await page.goto("./");
    await mapReady(page);
    const corner = page.locator('[data-component-id="corner"]');
    await expect(corner).toBeVisible();
    await expect.poll(async () => (await corner.boundingBox())!.y + (await corner.boundingBox())!.height).toBeLessThanOrEqual((await boxes(page)).bar.top);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await expect.poll(async () => (await corner.boundingBox())!.y + (await corner.boundingBox())!.height).toBeLessThanOrEqual((await boxes(page)).panel.top);
  });

  test("resizing across 768 px keeps the open panel open", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await page.setViewportSize({ width: 375, height: 667 });
    await expect.poll(async () => (await boxes(page)).bar.bottom).toBeCloseTo(667, 0);
    expect(await openPanels(page)).toEqual(["legend"]);
    await expect(sidebarPanel(page, "legend").locator("arcgis-legend")).toContainText("Survey sites");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => (await boxes(page)).bar.left).toBeLessThan(20);
    expect(await openPanels(page)).toEqual(["legend"]);
  });
});

test.describe("keyboard and screen readers (P-26)", () => {
  test.beforeEach(async ({ page }) => {
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend" },
      { id: "start", type: "home", placement: "panel" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
  });

  test("Keyboard only: Tab to the Legend icon, Enter opens, Escape closes and returns focus", async ({ page }) => {
    const legendFocused = () => sidebarAction(page, "legend").evaluate((a) => a.matches(":focus-within"));
    let focused = false;
    for (let i = 0; i < 15 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await legendFocused();
    }
    expect(focused, "Legend icon reachable with Tab").toBe(true);

    await page.keyboard.press("Enter");
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);

    // Escape from inside the open panel, as a keyboard user would after reading it.
    await sidebarPanel(page, "legend").getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect.poll(legendFocused).toBe(true);
  });

  test("closing with the panel's close button returns focus to its icon", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    const close = sidebarPanel(page, "legend").getByRole("button", { name: "Close" });
    await close.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect.poll(() => sidebarAction(page, "legend").evaluate((a) => a.matches(":focus-within"))).toBe(true);
  });

  test("Space also activates an icon", async ({ page }) => {
    await sidebarAction(page, "start").evaluate((a: HTMLCalciteActionElement) => a.setFocus());
    await page.keyboard.press("Space");
    await expect.poll(() => openPanels(page)).toEqual(["start"]);
  });

  test("Name and state exposed: named by heading, expanded only while open", async ({ page }) => {
    // Each icon's own button, as assistive technology sees it (role, name, expanded state).
    const icon = (id: string, name: string, expanded: boolean) =>
      sidebarAction(page, id).getByRole("button", { name, exact: true, expanded });
    await expect(icon("legend", "Legend", false)).toHaveCount(1);
    await sidebarAction(page, "legend").click();
    await expect(icon("legend", "Legend", true)).toHaveCount(1);
    await expect(icon("start", "Home", false)).toHaveCount(1);
    await sidebarAction(page, "legend").click();
    await expect(icon("legend", "Legend", false)).toHaveCount(1);
  });
});
