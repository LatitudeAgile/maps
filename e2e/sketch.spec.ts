import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { clickMapAt, defaultConfig, exportPrint, openPanels, servePrint, sidebarAction, sidebarPanel } from "./helpers.ts";
import {
  at,
  BLUE,
  clickAt,
  closeSketch,
  dragFrom,
  drawLine,
  drawPolygon,
  drawRectangle,
  fillLabel,
  GREEN,
  openFill,
  openSketch,
  chooseFillPreset,
  panelButton,
  popup,
  popupState,
  RED,
  selectedCount,
  selectSketch,
  selectSketches,
  serveSketchConfig,
  sketches,
  sketchMap,
  SKETCH_LAYER_ID,
  startSketchApp,
  startTool,
  waitForSketchState,
  writeNote,
} from "./sketch-helpers.ts";

// map-sketches (P-61). The map starts centered on the "sites" fixture point at Lebanon, KS.
const LEBANON: [number, number] = [-98.5794, 39.8281];

const sketchEl = (page: Page) => page.locator("viewer-sketch arcgis-sketch");

async function chooseColor(page: Page, name: string): Promise<void> {
  const index = await page.locator("viewer-sketch").evaluate((el, n) => {
    const swatches = [...el.shadowRoot!.querySelectorAll("calcite-swatch-group calcite-swatch")] as HTMLCalciteSwatchElement[];
    return swatches.findIndex((s) => s.label === n);
  }, name);
  expect(index, `swatch ${name}`).toBeGreaterThanOrEqual(0);
  await page.locator("viewer-sketch calcite-swatch-group calcite-swatch").nth(index).click();
  await page.waitForTimeout(150);
}

/** Pick a color in the open Add a color popover, as typing it in the picker does. */
async function pickColor(page: Page, hex: string): Promise<void> {
  await page.locator("viewer-sketch calcite-color-picker").evaluate((el: HTMLCalciteColorPickerElement, value) => {
    el.value = value;
    el.dispatchEvent(new CustomEvent("calciteColorPickerInput", { bubbles: true, composed: true }));
  }, hex);
}

async function addColor(page: Page, hex: string): Promise<void> {
  await panelButton(page, "Add a color").click();
  await pickColor(page, hex);
  await page.locator("viewer-sketch calcite-popover[data-popover='add-color'] calcite-button").filter({ hasText: /^Add$/ }).click();
  await page.waitForTimeout(150);
}

/** The Area fill presets shown as chosen (solid). */
const markedPresets = (page: Page) =>
  page.locator("viewer-sketch calcite-popover[data-popover='fill']").evaluate((p) =>
    ([...p.querySelectorAll("calcite-button")] as HTMLCalciteButtonElement[]).filter((b) => b.appearance === "solid").map((b) => b.textContent?.trim()),
  );

const sketchLayerVisible = (page: Page) =>
  page.evaluate((id) => (document.querySelector("arcgis-map") as HTMLArcgisMapElement).map!.findLayerById(id)!.visible, SKETCH_LAYER_ID);

/** The text of any drawing tooltip on the page. */
const tooltipText = (page: Page) =>
  page.evaluate(() => {
    const texts: string[] = [];
    const walk = (root: Document | ShadowRoot) =>
      root.querySelectorAll("*").forEach((e) => {
        if (e.shadowRoot) walk(e.shadowRoot);
        if (/tooltip/i.test(String((e as HTMLElement).className ?? ""))) texts.push((e.textContent ?? "").replace(/\s+/g, " "));
      });
    walk(document);
    return texts.join(" | ");
  });

test.describe("Sketch panel: open, close and selection", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page, undefined, [{ id: "legend", type: "legend", placement: "panel" }]);
    await startSketchApp(page);
  });

  test("Open the panel: toolbar, color strip and Area fill; the polygon tool can be chosen", async ({ page }) => {
    await openSketch(page);
    await expect(sketchEl(page)).toBeVisible();
    await expect(page.locator("viewer-sketch calcite-swatch-group")).toBeVisible();
    expect(await fillLabel(page)).toBe("Area fill: 0%");
    await startTool(page, "polygon");
    expect(await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.activeTool)).toBe("polygon");
  });

  test("Sketch with placement omitted: the Sketch panel is in the sidebar", async ({ page }) => {
    await expect(sidebarAction(page, "sketch")).toBeVisible();
  });

  test("the sketches are one layer, titled Sketches: the sketch component adds no layer of its own", async ({ page }) => {
    await openSketch(page);
    await drawRectangle(page);
    const layers = await page.evaluate(() =>
      (document.querySelector("arcgis-map") as HTMLArcgisMapElement).map!.layers.toArray().map((l) => [l.id, l.title]),
    );
    expect(layers.filter(([, title]) => /sketch/i.test(title ?? ""))).toEqual([[SKETCH_LAYER_ID, "Sketches"]]);
    expect((await sketches(page)).length).toBe(1);
  });

  test("Close while drawing: the unfinished polygon is discarded, finished sketches stay", async ({ page }) => {
    await openSketch(page);
    await drawRectangle(page, [100, 60], [160, 100]);
    await startTool(page, "polygon");
    for (const p of [[-60, -40], [60, -40], [60, 40]] as [number, number][]) await clickAt(page, ...p);
    await sidebarPanel(page, "sketch").getByRole("button", { name: "Close" }).click();
    await expect.poll(() => openPanels(page)).toEqual([]);
    await waitForSketchState(page, "ready");
    const all = await sketches(page);
    expect(all).toHaveLength(1);
    expect(all[0].geometryType).toBe("polygon");
    expect(await selectedCount(page)).toBe(0);
  });

  test("Switch panels with a sketch selected: the selection ends", async ({ page }) => {
    await openSketch(page);
    await drawRectangle(page);
    await selectSketch(page, 0);
    expect(await selectedCount(page)).toBe(1);
    await sidebarAction(page, "legend").click();
    await expect.poll(() => selectedCount(page)).toBe(0);
  });

  test("Click a sketch with the panel closed: it isn't selected", async ({ page }) => {
    await openSketch(page);
    await drawRectangle(page, [80, 40], [160, 100]);
    await closeSketch(page);
    await clickAt(page, 120, 70);
    await page.waitForTimeout(500);
    expect(await selectedCount(page)).toBe(0);
  });

  test("Select again after reopening: clicking the sketch selects it", async ({ page }) => {
    await openSketch(page);
    await drawRectangle(page, [80, 40], [160, 100]);
    await selectSketch(page, 0);
    await closeSketch(page);
    await openSketch(page);
    await clickAt(page, 120, 70);
    await expect.poll(() => selectedCount(page)).toBe(1);
  });
});

test.describe("Sketch tools and notes", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
  });

  test("Draw a line by hand: a freehand line in the chosen color along the path", async ({ page }) => {
    await startTool(page, "polyline", { mode: "freehand" });
    await dragFrom(page, [-100, 0], [100, 30], 25);
    await waitForSketchState(page, "ready");
    const [line] = await sketches(page);
    expect(line.geometryType).toBe("polyline");
    expect(line.color).toBe(RED);
    expect(((line.json.paths as number[][][])[0] ?? []).length).toBeGreaterThan(5);
  });

  test("Undo while drawing: the last corner goes, and the polygon is still being drawn", async ({ page }) => {
    await startTool(page, "polygon");
    for (const p of [[-60, -40], [60, -40], [60, 40]] as [number, number][]) await clickAt(page, ...p);
    await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.undo());
    await page.waitForTimeout(200);
    expect(await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.state)).toBe("active");
    const p = await at(page, -60, 40);
    await page.mouse.dblclick(p.x, p.y);
    await waitForSketchState(page, "ready");
    const [poly] = await sketches(page);
    // Three corners kept: (-60,-40), (60,-40) and (-60,40), plus the ring's closing point.
    expect((poly.json.rings as number[][][])[0]).toHaveLength(4);
  });

  test("Undo an edit: a moved rectangle goes back, and redo moves it again", async ({ page }) => {
    await drawRectangle(page);
    const [before] = await sketches(page);
    await selectSketch(page, 0);
    await dragFrom(page, [0, 0], [80, 0]);
    const [moved] = await sketches(page);
    expect(moved.extent!.xmin).toBeGreaterThan(before.extent!.xmin);
    await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.undo());
    await expect.poll(async () => (await sketches(page))[0].extent!.xmin).toBeCloseTo(before.extent!.xmin, 0);
    await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.redo());
    await expect.poll(async () => (await sketches(page))[0].extent!.xmin).toBeCloseTo(moved.extent!.xmin, 0);
  });

  test("Delete a finished sketch: it's gone", async ({ page }) => {
    await drawRectangle(page);
    await selectSketch(page, 0);
    await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.delete());
    await expect.poll(async () => (await sketches(page)).length).toBe(0);
  });

  test("Click after a polygon: the feature's popup opens, and no new polygon starts", async ({ page }) => {
    await drawPolygon(page, [[100, 60], [180, 60], [180, 120]]);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await popupState(page)).open).toBe(true);
    expect((await popupState(page)).layerId).toBe("sites");
    expect(await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.state)).not.toBe("active");
    expect(await sketches(page)).toHaveLength(1);
  });

  test("Write a note: it shows the text where the user clicked", async ({ page }) => {
    await writeNote(page, "Meet here", 40, 20);
    const [note] = await sketches(page);
    expect(note.symbolType).toBe("text");
    expect(note.text).toBe("Meet here");
  });

  test("Cancel a note: no note is left", async ({ page }) => {
    await startTool(page, "text");
    await clickAt(page, 40, 20);
    await page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Add a note" }).getByRole("button", { name: "Cancel" }).click();
    await expect.poll(async () => (await sketches(page)).length).toBe(0);
  });

  test("Edit a note: the new text shows on the map", async ({ page }) => {
    await writeNote(page, "Meet here", 40, 20);
    await selectSketch(page, 0);
    await panelButton(page, "Edit note").click();
    const dialog = page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Edit note" });
    await expect(dialog.locator("input")).toHaveValue("Meet here");
    await dialog.locator("input").fill("Gate 3");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await sketches(page))[0].text).toBe("Gate 3");
  });

  test("Escape in a dialog: the note dialog closes as Cancel, and the panel stays open", async ({ page }) => {
    await startTool(page, "text");
    await clickAt(page, 40, 20);
    await expect(page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Add a note" }).locator("input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await sketches(page)).length).toBe(0);
    expect(await openPanels(page)).toEqual(["sketch"]);
  });

  test("Deselect a sketch: Clear selection deselects it and goes away", async ({ page }) => {
    await expect(panelButton(page, "Clear selection")).toBeHidden();
    await drawPolygon(page);
    await selectSketch(page, 0);
    await panelButton(page, "Clear selection").click();
    await expect.poll(() => selectedCount(page)).toBe(0);
    expect(await sketches(page)).toHaveLength(1);
    await expect(panelButton(page, "Clear selection")).toBeHidden();
  });

  test("Imperial by default: the tooltip measures in feet or miles, and nothing stays on the map", async ({ page }) => {
    await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => (el.tooltipOptions.enabled = true));
    await startTool(page, "polyline");
    await clickAt(page, -80, 0);
    const p = await at(page, 60, 10);
    await page.mouse.move(p.x, p.y, { steps: 5 });
    await expect.poll(() => tooltipText(page)).toMatch(/\d\s?(mi|ft)\b/);
    await page.mouse.dblclick(p.x, p.y);
    await waitForSketchState(page, "ready");
    await expect.poll(() => tooltipText(page)).not.toMatch(/Total length/);
  });
});

test("Metric: the tooltip measures in meters or kilometers", async ({ page }) => {
  await serveSketchConfig(page, { unit: "metric" });
  await startSketchApp(page);
  await openSketch(page);
  await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => (el.tooltipOptions.enabled = true));
  await startTool(page, "polyline");
  await clickAt(page, -80, 0);
  const p = await at(page, 60, 10);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await expect.poll(() => tooltipText(page)).toMatch(/\d\s?(km|m)\b/);
});

test.describe("Sketch colors", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
  });

  test("Draw in another color: choose Blue, the polygon is blue", async ({ page }) => {
    await chooseColor(page, "Blue");
    await drawPolygon(page);
    expect((await sketches(page))[0].color).toBe(BLUE);
  });

  test("Recolor a selected sketch: only the selected line turns green", async ({ page }) => {
    await drawLine(page);
    await drawLine(page, [[-80, 60], [80, 60]]);
    await selectSketch(page, 0);
    await chooseColor(page, "Green");
    const [first, second] = await sketches(page);
    expect(first.color).toBe(GREEN);
    expect(second.color).toBe(RED);
  });

  test("The chosen color is remembered: Green after a reload", async ({ page }) => {
    await chooseColor(page, "Green");
    await startSketchApp(page); // load again, as a reload
    await openSketch(page);
    expect(await page.locator("viewer-sketch").evaluate((el) => ([...el.shadowRoot!.querySelectorAll("calcite-swatch")] as HTMLCalciteSwatchElement[]).find((s) => s.selected)?.label)).toBe("Green");
  });

  test("Add a color: the magenta follows the colors, chosen, and the next rectangle uses it", async ({ page }) => {
    await addColor(page, "#ff00ff");
    await expect(page.locator('viewer-sketch .custom[data-color="#ff00ff"]')).toBeVisible();
    expect(await page.locator('viewer-sketch .custom[data-color="#ff00ff"] calcite-swatch').evaluate((s: HTMLCalciteSwatchElement) => s.selected)).toBe(true);
    await drawRectangle(page);
    expect((await sketches(page))[0].color).toBe("#ff00ff");
  });

  test("A color that's already there: the picker says so, and Add is unavailable", async ({ page }) => {
    await panelButton(page, "Add a color").click();
    await pickColor(page, RED);
    const popover = page.locator("viewer-sketch calcite-popover[data-popover='add-color']");
    await expect(popover.getByText("That color is already on the strip.")).toBeVisible();
    await expect(popover.locator("calcite-button").filter({ hasText: /^Add$/ })).toHaveAttribute("disabled", "");
  });

  test("Six added colors: Add a color is unavailable, and says to remove one", async ({ page }) => {
    for (const hex of ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"]) await addColor(page, hex);
    const add = page.locator("viewer-sketch calcite-action[icon='plus']");
    await expect(add).toHaveAttribute("disabled", "");
    expect(await add.getAttribute("title")).toMatch(/remove one/);
  });

  test("Remove an added color: it's gone, the first color is chosen, the rectangle keeps it", async ({ page }) => {
    await addColor(page, "#ff00ff");
    await drawRectangle(page);
    const custom = page.locator('viewer-sketch .custom[data-color="#ff00ff"]');
    await custom.hover();
    await custom.getByRole("button", { name: "Remove custom color #ff00ff" }).click();
    await expect(custom).toHaveCount(0);
    expect(await page.locator("viewer-sketch").evaluate((el) => ([...el.shadowRoot!.querySelectorAll("calcite-swatch")] as HTMLCalciteSwatchElement[]).find((s) => s.selected)?.label)).toBe("Red");
    expect((await sketches(page))[0].color).toBe("#ff00ff");
  });
});

test("Colors from config: Teal and Gold, with Teal chosen", async ({ page }) => {
  await serveSketchConfig(page, { colors: [{ name: "Teal", color: "#1f6f8b" }, { name: "Gold", color: "#c99700" }] });
  await startSketchApp(page);
  await openSketch(page);
  const labels = await page.locator("viewer-sketch").evaluate((el) =>
    ([...el.shadowRoot!.querySelectorAll("calcite-swatch-group calcite-swatch")] as HTMLCalciteSwatchElement[]).map((s) => [s.label, s.selected]),
  );
  expect(labels).toEqual([["Teal", true], ["Gold", false]]);
});

test.describe("Area fill", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
  });

  test("Outlines at first: 0%, an edge only, and clicking inside still selects it", async ({ page }) => {
    expect(await fillLabel(page)).toBe("Area fill: 0%");
    await drawPolygon(page);
    expect((await sketches(page))[0].symbolAlpha).toBe(0);
    await clickAt(page, 0, 0);
    await expect.poll(() => selectedCount(page)).toBe(1);
  });

  test("Draw a half-filled area: a circle at 50%", async ({ page }) => {
    await openFill(page);
    await chooseFillPreset(page, "50%");
    await page.keyboard.press("Escape");
    await startTool(page, "circle");
    await dragFrom(page, [0, 0], [50, 0]);
    await waitForSketchState(page, "ready");
    const [circle] = await sketches(page);
    expect(circle.symbolAlpha).toBeCloseTo(0.5);
    expect(circle.fill).toBeCloseTo(0.5);
  });

  test("the slider works with the arrow keys, in 5% steps", async ({ page }) => {
    await openFill(page);
    await page.locator("viewer-sketch calcite-slider").focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => fillLabel(page)).toBe("Area fill: 5%");
  });

  test("One area selected: Area fill shows its 25%, with the preset marked", async ({ page }) => {
    await openFill(page);
    await chooseFillPreset(page, "25%");
    await page.keyboard.press("Escape");
    await drawPolygon(page);
    await openFill(page);
    await chooseFillPreset(page, "None");
    await page.keyboard.press("Escape");
    expect(await fillLabel(page)).toBe("Area fill: 0%");
    await selectSketch(page, 0);
    expect(await fillLabel(page)).toBe("Area fill: 25%");
    await openFill(page);
    expect(await markedPresets(page)).toEqual(["25%"]);
  });

  test("Areas with different fills: mixed (25–75%), no preset marked, 50% sets both", async ({ page }) => {
    for (const preset of ["25%", "75%"]) {
      await openFill(page);
      await chooseFillPreset(page, preset);
      await page.keyboard.press("Escape");
      await drawPolygon(page, preset === "25%" ? [[-120, -40], [-40, -40], [-40, 40]] : [[40, -40], [120, -40], [120, 40]]);
    }
    await selectSketches(page, [0, 1]);
    expect(await fillLabel(page)).toBe("Area fill: mixed");
    await openFill(page);
    const popover = page.locator("viewer-sketch calcite-popover[data-popover='fill']");
    expect(await popover.evaluate((p: HTMLCalcitePopoverElement) => p.heading)).toBe("Area fill: mixed (25–75%)");
    expect(await markedPresets(page)).toEqual([]);
    await chooseFillPreset(page, "50%");
    expect((await sketches(page)).map((s) => s.fill)).toEqual([0.5, 0.5]);
  });

  test("Recolor keeps the fill: a 75% area recolored stays at 75%", async ({ page }) => {
    await openFill(page);
    await chooseFillPreset(page, "75%");
    await page.keyboard.press("Escape");
    await drawPolygon(page);
    await selectSketch(page, 0);
    await chooseColor(page, "Blue");
    const [area] = await sketches(page);
    expect(area.color).toBe(BLUE);
    expect(area.symbolAlpha).toBeCloseTo(0.75);
  });

  test("Escape in a popover: the first Escape closes Area fill, the second the panel", async ({ page }) => {
    await openFill(page);
    await page.keyboard.press("Escape");
    await expect.poll(() => page.locator("viewer-sketch calcite-popover[data-popover='fill']").evaluate((p: HTMLCalcitePopoverElement) => p.open)).toBe(false);
    expect(await openPanels(page)).toEqual(["sketch"]);
    await page.keyboard.press("Escape");
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect(sidebarAction(page, "sketch")).toBeFocused();
  });
});

test("Fill from config: Area fill reads 25%", async ({ page }) => {
  await serveSketchConfig(page, { fillPercent: 25 });
  await startSketchApp(page);
  await openSketch(page);
  expect(await fillLabel(page)).toBe("Area fill: 25%");
});

test.describe("Sketch popups", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
  });

  /** A blue area at 25% over the Lebanon site, with the panel then closed. */
  async function blueAreaOverSite(page: Page): Promise<void> {
    await chooseColor(page, "Blue");
    await openFill(page);
    await chooseFillPreset(page, "25%");
    await page.keyboard.press("Escape");
    await drawPolygon(page);
    await closeSketch(page);
  }

  test("Click an area with the panel closed: its popup comes first, reading Blue area, 25% fill", async ({ page }) => {
    await blueAreaOverSite(page);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await popupState(page)).open).toBe(true);
    const state = await popupState(page);
    expect(state.layerId).toBe(SKETCH_LAYER_ID);
    expect(state.count).toBeGreaterThanOrEqual(2);
    await expect(popup(page).getByText("Blue area, 25% fill")).toBeVisible();
  });

  test("Click a note with the panel closed: the popup is titled Note, with the text", async ({ page }) => {
    await writeNote(page, "Meet here", 120, 80);
    await closeSketch(page);
    await clickAt(page, 120, 80);
    await expect.poll(async () => (await popupState(page)).layerId).toBe(SKETCH_LAYER_ID);
    await expect(popup(page).getByText("Note", { exact: true }).first()).toBeVisible();
    await expect(popup(page).getByText("Meet here").first()).toBeVisible();
  });

  test("Edit from the popup: the panel opens with the area selected, Area fill at 25%", async ({ page }) => {
    await blueAreaOverSite(page);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(async () => (await popupState(page)).layerId).toBe(SKETCH_LAYER_ID);
    await popup(page).getByRole("button", { name: "Edit sketch" }).click();
    await expect.poll(() => openPanels(page)).toEqual(["sketch"]);
    await expect.poll(() => selectedCount(page)).toBe(1);
    expect((await popupState(page)).open).toBe(false);
    expect(await fillLabel(page)).toBe("Area fill: 25%");
  });

  test("Draw over a feature: the click places a corner, and no popup opens", async ({ page }) => {
    await startTool(page, "polygon");
    await clickMapAt(page, ...LEBANON);
    await page.waitForTimeout(800);
    expect((await popupState(page)).open).toBe(false);
    expect(await sketchEl(page).evaluate((el: HTMLArcgisSketchElement) => el.state)).toBe("active");
  });

  test("Select a sketch over a feature: it's selected, and no popup opens", async ({ page }) => {
    await drawPolygon(page);
    await clickMapAt(page, ...LEBANON);
    await expect.poll(() => selectedCount(page)).toBe(1);
    await page.waitForTimeout(1200);
    expect((await popupState(page)).open).toBe(false);
  });
});

test.describe("Keeping sketches", () => {
  test("Reload: two polygons and a note come back, in their colors, with the text", async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page, [[-120, -40], [-40, -40], [-40, 40]]);
    await chooseColor(page, "Blue");
    await drawPolygon(page, [[40, -40], [120, -40], [120, 40]]);
    await writeNote(page, "Meet here", 0, 80);
    await page.waitForTimeout(600); // the debounced save
    await startSketchApp(page); // load again, as a reload
    const restored = await sketches(page);
    expect(restored.map((s) => [s.geometryType, s.color, s.text ?? null])).toEqual([
      ["polygon", RED, null],
      ["polygon", BLUE, null],
      ["point", BLUE, "Meet here"],
    ]);
  });

  test("Curved line after a reload: the curve comes back", async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    // A line with a circular-arc segment, as the curved segment tool draws, added to the layer.
    const saved = await page.evaluate(async (id) => {
      const map = document.querySelector("arcgis-map") as HTMLArcgisMapElement;
      const layer = map.map!.findLayerById(id) as any;
      const c = map.view.center;
      const d = map.view.resolution * 80;
      layer.add({
        geometry: { type: "polyline", curvePaths: [[[c.x - d, c.y], { c: [[c.x + d, c.y], [c.x, c.y + d / 2]] }]], spatialReference: c.spatialReference.toJSON() },
        symbol: { type: "simple-line", color: "#1f5fd1", width: 2.5 },
        attributes: { sketchColor: "#1f5fd1" },
      });
      await new Promise((r) => setTimeout(r, 600));
      return layer.graphics.getItemAt(0).geometry.toJSON();
    }, SKETCH_LAYER_ID);
    expect(saved).toHaveProperty("curvePaths");
    await startSketchApp(page); // load again, as a reload
    const [line] = await sketches(page);
    expect(line.json).toEqual(saved);
  });

  test("Another config: its map has none of the default config's sketches", async ({ page }) => {
    await serveSketchConfig(page);
    // A second config, also with a Sketch panel, chosen by ?config=other.
    const other = defaultConfig();
    sketchMap(other);
    other.layers = [];
    other.components = [{ id: "sketch", type: "sketch", placement: "panel" }];
    await page.route("**/config/other.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(other) }));
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page);
    await page.waitForTimeout(600);
    await startSketchApp(page, "./?config=other");
    expect(await sketches(page)).toHaveLength(0);
    await startSketchApp(page, "./");
    expect(await sketches(page)).toHaveLength(1);
  });

  test("Storage full: the polygon stays, and the panel says the change wasn't saved", async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key.startsWith("viewer:sketches:")) throw new DOMException("full", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    });
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page);
    await expect(page.locator("viewer-sketch calcite-notice[kind='danger']").getByText(/weren't saved/)).toBeVisible({ timeout: 5_000 });
    expect(await sketches(page)).toHaveLength(1);
  });

  test("Clear and confirm: every sketch is gone, also after a reload", async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page);
    await drawLine(page, [[-80, 60], [80, 60]]);
    await page.waitForTimeout(600);
    await panelButton(page, "Clear all").click();
    const dialog = page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Clear all sketches?" });
    await expect(dialog.getByText(/can't be brought back/)).toBeVisible();
    await dialog.getByRole("button", { name: "Clear all" }).click();
    expect(await sketches(page)).toHaveLength(0);
    await startSketchApp(page); // load again, as a reload
    expect(await sketches(page)).toHaveLength(0);
  });

  test("Clear and cancel: every sketch stays", async ({ page }) => {
    await serveSketchConfig(page);
    await startSketchApp(page);
    await openSketch(page);
    await expect(panelButton(page, "Clear all")).toHaveAttribute("disabled", "");
    await drawPolygon(page);
    await panelButton(page, "Clear all").click();
    await page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Clear all sketches?" }).getByRole("button", { name: "Cancel" }).click();
    expect(await sketches(page)).toHaveLength(1);
  });

  test("Hide and show: the Sketches checkbox hides them, and opening the panel shows them", async ({ page }) => {
    await serveSketchConfig(page, undefined, [{ id: "layers", type: "layer-list", placement: "panel" }]);
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page);
    await sidebarAction(page, "layers").click();
    await page.locator("arcgis-layer-list").getByRole("button", { name: "Hide Sketches" }).click();
    await expect.poll(() => sketchLayerVisible(page)).toBe(false);
    await openSketch(page);
    await expect.poll(() => sketchLayerVisible(page)).toBe(true);
  });
});

test.describe("Printing sketches", () => {
  test.beforeEach(async ({ page }) => {
    await serveSketchConfig(page, undefined, [{ id: "print", type: "print", placement: "panel" }]);
  });

  test("Print a marked-up map: the polygon and the note are in the web map sent", async ({ page }) => {
    const exports = await servePrint(page);
    await startSketchApp(page);
    await openSketch(page);
    await drawPolygon(page);
    await writeNote(page, "Meet here", 0, 80);
    const sent = JSON.stringify((await exportPrint(page, exports)).webMap);
    expect(sent).toContain("esriSFS");
    expect(sent).toContain("esriTS");
    expect(sent).toContain("Meet here");
  });

  test("Print while a sketch was selected: the line, and no handles", async ({ page }) => {
    const exports = await servePrint(page);
    await startSketchApp(page);
    await openSketch(page);
    await drawLine(page);
    await selectSketch(page, 0);
    expect(await selectedCount(page)).toBe(1);
    const sent = JSON.stringify((await exportPrint(page, exports)).webMap);
    expect(sent.match(/esriSLS/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    // Vertex and selection handles would be markers or extra outlines.
    expect(sent).not.toContain("esriSMS");
  });

  test("Hidden sketches don't print", async ({ page }) => {
    const exports = await servePrint(page);
    await startSketchApp(page);
    await openSketch(page);
    await writeNote(page, "Meet here", 0, 80);
    await page.evaluate((id) => ((document.querySelector("arcgis-map") as HTMLArcgisMapElement).map!.findLayerById(id)!.visible = false), SKETCH_LAYER_ID);
    const sent = JSON.stringify((await exportPrint(page, exports)).webMap);
    expect(sent).not.toContain("Meet here");
  });
});

test("Network while sketching: no request carries sketch geometry or note text", async ({ page, log }) => {
  await serveSketchConfig(page);
  await startSketchApp(page);
  await openSketch(page);
  await drawPolygon(page);
  await writeNote(page, "Meet here", 0, 80);
  await page.waitForTimeout(600);
  await startSketchApp(page); // load again, as a reload
  await openSketch(page);
  await panelButton(page, "Clear all").click();
  await page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Clear all sketches?" }).getByRole("button", { name: "Clear all" }).click();
  for (const req of log.requests) {
    const carried = `${req.url()} ${req.postData() ?? ""}`;
    expect(carried, req.url()).not.toContain("Meet here");
    expect(carried, req.url()).not.toContain("sketchColor");
  }
});
