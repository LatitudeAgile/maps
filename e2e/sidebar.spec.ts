import { test, expect as baseExpect, hasApiKey } from "./fixtures.ts";
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
    await serveModifiedConfig(
      page,
      (c) =>
        (c.components = [
          { id: "zoom", type: "zoom", placement: "top-left" },
          { id: "home", type: "home", placement: "top-left" },
        ]),
    );
    await page.goto("./");
    await mapReady(page);
    await expect(page.locator('[data-component-id="home"]')).toBeVisible();
    await expect(page.locator("calcite-shell-panel")).toHaveCount(0);
    const zoom = (await page.locator('[data-component-id="zoom"]').boundingBox())!;
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
      { id: "zoom", type: "zoom", placement: "top-right" },
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
      { id: "zoom", type: "zoom", placement: "top-left" },
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

  test("Title box moves with the sidebar, open and closed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible();
    for (const state of ["collapsed", "open", "closed again"]) {
      if (state !== "collapsed") await sidebarAction(page, "legend").click();
      await expect.poll(() => openPanels(page)).toEqual(state === "open" ? ["legend"] : []);
      const edge = await sidebarRightEdge(page);
      await expect.poll(async () => (await boxOf(page, ".title-box")).left, { message: `title box when ${state}` }).toBeGreaterThanOrEqual(edge);
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

test.describe("full height on wide screens", () => {
  /** Top and bottom gaps between an element and the map, in pixels. */
  const gaps = (page: import("@playwright/test").Page, selector: string) =>
    page.evaluate((sel) => {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => !e.hidden);
      const map = document.querySelector("arcgis-map")!.getBoundingClientRect();
      if (!el) return { top: 999, bottom: 999 };
      const b = el.getBoundingClientRect();
      return { top: b.top - map.top, bottom: map.bottom - b.bottom };
    }, selector);
  const BAR = "calcite-shell-panel > calcite-action-bar";
  const PANEL = "calcite-shell-panel > calcite-panel";
  const expectFullHeight = async (page: import("@playwright/test").Page, selector: string) => {
    await expect.poll(async () => { const g = await gaps(page, selector); return Math.max(Math.abs(g.top), Math.abs(g.bottom)); }, { message: selector }).toBeLessThanOrEqual(16);
  };

  test("Collapsed: the icon bar spans the map's height", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible();
    await expectFullHeight(page, BAR);
  });

  test("Panel open: the icon bar and the panel span the map's height", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, LEGEND_AND_HOME);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await expectFullHeight(page, BAR);
    await expectFullHeight(page, PANEL);
  });

  test("Few icons: a single panel component still gives a full-height bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible();
    await expectFullHeight(page, BAR);
  });

  test("Short panel content: the Search panel reaches the bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await sidebarAction(page, "search").click();
    await expect.poll(() => openPanels(page)).toEqual(["search"]);
    await expectFullHeight(page, PANEL);
  });

  test("Tall panel content: the legend scrolls inside the panel; the page doesn't", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    const layers = Array.from({ length: 20 }, (_, i) => geojsonLayer(`layer${i}`, { title: `Layer ${i}` }));
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }], (c) => (c.layers = layers));
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    const legend = sidebarPanel(page, "legend").locator("arcgis-legend");
    await expect(legend).toContainText("Layer 19");
    await expectFullHeight(page, PANEL);
    const panel = (await sidebarPanel(page, "legend").boundingBox())!;
    // The last entry starts below the panel's bottom edge: the content is taller than the panel.
    const last = legend.getByText("Layer 19", { exact: true });
    const before = (await last.boundingBox())!;
    expect(before.y).toBeGreaterThan(panel.y + panel.height);
    // Scrolling over the panel brings it up, while the page itself never scrolls.
    await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
    await page.mouse.wheel(0, 2000);
    await expect.poll(async () => (await last.boundingBox())!.y).toBeLessThan(panel.y + panel.height);
    expect(await page.evaluate(() => [document.documentElement.scrollHeight, window.scrollY])).toEqual([600, 0]);
  });

  test("Resized across the breakpoint: vertical and full height again", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => page.locator(BAR).evaluate((el: HTMLCalciteActionBarElement) => el.layout)).toBe("vertical");
    await expectFullHeight(page, BAR);
    await expectFullHeight(page, PANEL);
  });
});

test.describe("rounded corners on wide screens (design D11)", () => {
  /** Corner radii (top-left, top-right, bottom-right, bottom-left) of the bar, the open panel, and the title box. */
  const radii = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const corners = (el: Element | null | undefined) => {
        if (!el) return undefined;
        const cs = getComputedStyle(el);
        return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
      };
      return {
        title: getComputedStyle(document.querySelector(".title-box")!).borderTopLeftRadius,
        bar: corners(document.querySelector("calcite-shell-panel > calcite-action-bar")),
        panel: corners([...document.querySelectorAll<HTMLElement>("calcite-shell-panel > calcite-panel")].find((p) => !p.hidden)),
      };
    });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveSidebarConfig(page, [{ id: "legend", type: "legend" }]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible();
  });

  test("Collapsed corners: all four of the bar's match the title box", async ({ page }) => {
    const r = await radii(page);
    expect(r.title).not.toBe("0px");
    expect(r.bar).toEqual([r.title, r.title, r.title, r.title]);
  });

  test("No frame around the bar: its edges are its own color, with or without a theme", async ({ page }) => {
    for (const theme of [undefined, { color: "#1f6f8b", opacity: 0.85 }]) {
      await page.unroute("**/config/viewer.json");
      await serveSidebarConfig(page, [{ id: "legend", type: "legend" }], (c) => {
        if (theme) c.app.theme = theme;
        else delete c.app.theme;
      });
      await page.goto("./");
      await mapReady(page);
      await expect(sidebarAction(page, "legend")).toBeVisible();
      const edges = await page.evaluate(() => {
        const bar = document.querySelector("calcite-shell-panel > calcite-action-bar")!;
        const background = getComputedStyle(bar.shadowRoot!.querySelector(".container")!).backgroundColor;
        const container = document.querySelector("calcite-shell-panel")!.shadowRoot!.querySelector(".container")!;
        const sides = (el: Element) => {
          const cs = getComputedStyle(el);
          return ["Top", "Right", "Bottom", "Left"].map((side) => ({ width: cs.getPropertyValue(`border-${side.toLowerCase()}-width`), color: cs.getPropertyValue(`border-${side.toLowerCase()}-color`) }));
        };
        return { background, sides: [...sides(bar), ...sides(container)] };
      });
      for (const side of edges.sides) {
        if (side.width !== "0px") expect(side.color, theme ? "themed" : "unthemed").toBe(edges.background);
      }
    }
  });

  test("Open corners: the bar's and the panel's outer corners match; where they meet is square", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    const r = await radii(page);
    expect(r.bar).toEqual([r.title, "0px", "0px", r.title]);
    expect(r.panel).toEqual(["0px", r.title, r.title, "0px"]);
  });
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

  test("Bottom controls stay clear on a phone: the shipped bottom-right stack sits above the bar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./"); // the shipped default config: Home, Locate, zoom at bottom right
    await mapReady(page);
    const barTop = () => page.evaluate(() => document.querySelector("calcite-shell-panel calcite-action-bar")!.getBoundingClientRect().top);
    for (const id of ["home", "locate", "zoom"]) {
      const control = page.locator(`[data-component-id="${id}"]`);
      await expect(control).toBeVisible();
      await expect.poll(async () => { const b = (await control.boundingBox())!; return b.y + b.height - (await barTop()); }, { message: id }).toBeLessThanOrEqual(0);
    }
  });

  test("Bottom controls stay clear of an open panel on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveSidebarConfig(page, [
      { id: "legend", type: "legend" },
      { id: "corner", type: "home", placement: "bottom-right" },
    ]);
    await page.goto("./");
    await mapReady(page);
    const corner = page.locator('[data-component-id="corner"]');
    await expect(corner).toBeVisible();
    await sidebarAction(page, "legend").click();
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);
    await expect.poll(async () => (await corner.boundingBox())!.y + (await corner.boundingBox())!.height).toBeLessThanOrEqual((await boxes(page)).panel.top);
  });

  /** Sidebar icon ids sorted by their position: left to right, or top to bottom. */
  const iconsBy = (page: import("@playwright/test").Page, axis: "x" | "y") =>
    page.evaluate((axis) => {
      const icons = [...document.querySelectorAll<HTMLElement>("calcite-shell-panel > calcite-action-bar calcite-action[data-panel-for]")];
      return icons
        .map((a) => ({ id: a.dataset.panelFor!, box: a.getBoundingClientRect() }))
        .filter((a) => a.box.width > 0)
        .sort((a, b) => (axis === "x" ? a.box.left - b.box.left : a.box.top - b.box.top))
        .map((a) => a.id);
    }, axis);

  test("Icons start from the right on a phone, in config order", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await expect(sidebarAction(page, "basemaps")).toBeVisible();
    const configOrder = hasApiKey() ? ["search", "directions", "layers", "legend", "basemaps", "sketch", "print"] : ["search", "layers", "legend", "basemaps", "sketch", "print"];
    // Right to left = config order.
    await expect.poll(async () => (await iconsBy(page, "x")).reverse()).toEqual(configOrder);
    const search = (await sidebarAction(page, "search").boundingBox())!;
    expect(375 - (search.x + search.width)).toBeLessThanOrEqual(16);
    // Seven icons still fit: every one is within the window.
    for (const id of configOrder) {
      const box = (await sidebarAction(page, id).boundingBox())!;
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(375);
    }
  });

  test("Arrow keys follow the screen on a phone: Left goes left, Right goes right, Tab leaves", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./"); // the shipped default config
    await mapReady(page);
    await expect(sidebarAction(page, "basemaps")).toBeVisible();
    const focused = () =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest("calcite-shell-panel > calcite-action-bar calcite-action")?.getAttribute("data-panel-for") ?? "");
    const second = hasApiKey() ? "directions" : "layers"; // the icon left of Search
    await sidebarAction(page, "search").evaluate((el: HTMLCalciteActionElement) => el.setFocus());
    await expect.poll(focused).toBe("search");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(focused).toBe(second);
    // On screen, that icon is to Search's left.
    const s = (await sidebarAction(page, "search").boundingBox())!;
    const n = (await sidebarAction(page, second).boundingBox())!;
    expect(n.x).toBeLessThan(s.x);
    await page.keyboard.press("ArrowRight");
    await expect.poll(focused).toBe("search");
    await page.keyboard.press("Tab");
    await expect.poll(focused).toBe("");
  });

  test("Back to the top-to-bottom order on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serveSidebarConfig(page, LEGEND_AND_HOME);
    await page.goto("./");
    await mapReady(page);
    await expect.poll(async () => (await iconsBy(page, "x")).reverse()).toEqual(["legend", "start"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => iconsBy(page, "y")).toEqual(["legend", "start"]);
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
    await page.setViewportSize({ width: 1280, height: 800 });
    // Home first, so reaching Legend takes the arrow keys (design D13).
    await serveSidebarConfig(page, [
      { id: "start", type: "home", placement: "panel" },
      { id: "legend", type: "legend" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "legend")).toBeVisible({ timeout: SIDEBAR_READY_MS });
  });

  /** The data-panel-for of the sidebar icon that has focus, or "" when focus is elsewhere. */
  const focusedIcon = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a?.closest("calcite-shell-panel > calcite-action-bar calcite-action")?.getAttribute("data-panel-for") ?? "";
    });

  test("Keyboard only: Tab into the bar, Down arrow to Legend, Enter opens, Escape closes and returns focus", async ({ page }) => {
    let icon = "";
    for (let i = 0; i < 15 && !icon; i++) {
      await page.keyboard.press("Tab");
      icon = await focusedIcon(page);
    }
    expect(icon, "Tab lands on the first icon").toBe("start");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => focusedIcon(page)).toBe("legend");

    await page.keyboard.press("Enter");
    await expect.poll(() => openPanels(page)).toEqual(["legend"]);

    // Escape from inside the open panel, as a keyboard user would after reading it.
    await sidebarPanel(page, "legend").getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect.poll(() => focusedIcon(page)).toBe("legend");
  });

  test("One Tab stop: Tab from an icon leaves the bar", async ({ page }) => {
    await sidebarAction(page, "start").evaluate((el: HTMLCalciteActionElement) => el.setFocus());
    await expect.poll(() => focusedIcon(page)).toBe("start");
    await page.keyboard.press("Tab");
    await expect.poll(() => focusedIcon(page)).toBe("");
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
