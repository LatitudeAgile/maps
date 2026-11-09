import type { Page } from "@playwright/test";
import { mapReady, serveSidebarConfig, settled, sidebarAction, openPanels } from "./helpers.ts";

// Helpers for the Sketch panel (map-sketches). A tool is started through the sketch component's
// API (its toolbar buttons are inside the SDK's shadow DOM, and their labels may change); the
// drawing itself is done with the mouse on the map, as a user would.

export const SKETCH_LAYER_ID = "viewer-sketches";
export const BLUE = "#1f5fd1";
export const RED = "#d7263d";
export const GREEN = "#1a9e3f";

/** A config with the two fixture GeoJSON layers (sites over Kansas), a Sketch panel and `extra`. */
export async function serveSketchConfig(
  page: Page,
  options: Record<string, unknown> | undefined = undefined,
  extra: Record<string, unknown>[] = [],
  edit: (c: Record<string, any>) => void = () => {},
): Promise<void> {
  await serveSidebarConfig(page, [{ id: "sketch", type: "sketch", placement: "panel", ...(options ? { options } : {}) }, ...extra], (c) => {
    sketchMap(c);
    edit(c);
  });
}

/** The sketch tests' map: OpenStreetMap (no key), centered on the Lebanon, KS site. */
export function sketchMap(c: Record<string, any>): void {
  c.map.basemap = "osm";
  c.map.center = [-98.5794, 39.8281];
  c.map.scale = 4_000_000;
  delete c.map.zoom;
}

/** Load the viewer and wait for the sketch layer to be on the map. */
export async function startSketchApp(page: Page, path = "./"): Promise<void> {
  await page.goto(path);
  await mapReady(page);
  await page.waitForFunction((id) => !!(document.querySelector("arcgis-map") as HTMLArcgisMapElement).map?.findLayerById(id), SKETCH_LAYER_ID);
}

export async function openSketch(page: Page): Promise<void> {
  if (!(await openPanels(page)).includes("sketch")) await sidebarAction(page, "sketch").click();
  await page.locator("viewer-sketch arcgis-sketch").evaluate((el: HTMLArcgisSketchElement) => el.componentOnReady());
  await settled(page);
}

export async function closeSketch(page: Page): Promise<void> {
  if ((await openPanels(page)).includes("sketch")) await sidebarAction(page, "sketch").click();
}

/** Start a drawing tool, as choosing it in the toolbar does. */
export async function startTool(page: Page, tool: string, options: Record<string, unknown> = {}): Promise<void> {
  await page.locator("viewer-sketch arcgis-sketch").evaluate(
    (el: HTMLArcgisSketchElement, [tool, options]) => void el.create(tool as never, options as never),
    [tool, options] as const,
  );
  await page.waitForTimeout(150);
}

/** Page coordinates `dx`, `dy` pixels from the center of the map area the sidebar leaves free. */
export async function at(page: Page, dx = 0, dy = 0): Promise<{ x: number; y: number }> {
  return page.locator("arcgis-map").evaluate(
    (el: HTMLArcgisMapElement, [dx, dy]) => {
      const p = el.view.toScreen(el.view.center)!;
      const box = el.getBoundingClientRect();
      return { x: box.left + p.x + dx, y: box.top + p.y + dy };
    },
    [dx, dy] as const,
  );
}

export async function clickAt(page: Page, dx: number, dy: number): Promise<void> {
  const p = await at(page, dx, dy);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
}

export async function dragFrom(page: Page, from: [number, number], to: [number, number], steps = 12): Promise<void> {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Draw a polygon through the points (pixel offsets), double-clicking the last to finish. */
export async function drawPolygon(page: Page, points: [number, number][] = [[-60, -40], [60, -40], [60, 40], [-60, 40]]): Promise<void> {
  await startTool(page, "polygon");
  for (const [k, [dx, dy]] of points.entries()) {
    const p = await at(page, dx, dy);
    if (k === points.length - 1) await page.mouse.dblclick(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(120);
  }
  await waitForSketchState(page, "ready");
}

/** Draw a polyline through the points, double-clicking the last to finish. */
export async function drawLine(page: Page, points: [number, number][] = [[-80, 0], [0, -30], [80, 0]]): Promise<void> {
  await startTool(page, "polyline");
  for (const [k, [dx, dy]] of points.entries()) {
    const p = await at(page, dx, dy);
    if (k === points.length - 1) await page.mouse.dblclick(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(120);
  }
  await waitForSketchState(page, "ready");
}

/** Draw a rectangle by dragging across it. */
export async function drawRectangle(page: Page, from: [number, number] = [-50, -30], to: [number, number] = [50, 30]): Promise<void> {
  await startTool(page, "rectangle");
  await dragFrom(page, from, to);
  await waitForSketchState(page, "ready");
}

/** Place a note with the text tool and answer the dialog. */
export async function writeNote(page: Page, text: string, dx = 0, dy = 0): Promise<void> {
  await startTool(page, "text");
  await clickAt(page, dx, dy);
  const dialog = page.locator("viewer-sketch calcite-dialog").filter({ hasText: "Add a note" });
  await dialog.locator("input").fill(text);
  await dialog.getByRole("button", { name: "Add" }).click();
  await waitForSketchState(page, "ready");
}

export async function waitForSketchState(page: Page, state: string): Promise<void> {
  await page.waitForFunction(
    (s) => (document.querySelector("viewer-sketch")!.shadowRoot!.querySelector("arcgis-sketch") as HTMLArcgisSketchElement).state === s,
    state,
    { timeout: 10_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(150);
}

export interface SketchSummary {
  geometryType: string;
  symbolType: string | undefined;
  color: string | undefined;
  fill: number | undefined;
  text: string | undefined;
  /** Fill alpha of an area's symbol, 0 to 1. */
  symbolAlpha: number | undefined;
  extent: { xmin: number; ymin: number; xmax: number; ymax: number } | undefined;
  json: Record<string, unknown>;
}

/** The sketches on the map, bottom to top. */
export async function sketches(page: Page): Promise<SketchSummary[]> {
  return page.evaluate((id) => {
    const layer = (document.querySelector("arcgis-map") as HTMLArcgisMapElement).map!.findLayerById(id) as any;
    return layer.graphics.toArray().map((g) => {
      const symbol = g.symbol as unknown as { type?: string; text?: string; color?: { a: number } };
      const e = g.geometry?.extent;
      return {
        geometryType: g.geometry?.type ?? "",
        symbolType: symbol?.type,
        color: g.attributes?.sketchColor,
        fill: g.attributes?.sketchFillOpacity,
        text: symbol?.type === "text" ? symbol.text : undefined,
        symbolAlpha: symbol?.type === "simple-fill" ? symbol.color?.a : undefined,
        extent: e ? { xmin: e.xmin, ymin: e.ymin, xmax: e.xmax, ymax: e.ymax } : undefined,
        json: g.geometry?.toJSON() ?? {},
      };
    });
  }, SKETCH_LAYER_ID);
}

/** How many sketches are selected (being updated). */
export async function selectedCount(page: Page): Promise<number> {
  return page.locator("viewer-sketch arcgis-sketch").evaluate((el: HTMLArcgisSketchElement) => el.updateGraphics?.length ?? 0);
}

/** Select the sketch at `index`, as clicking it with the panel open does. */
export async function selectSketch(page: Page, index: number): Promise<void> {
  await page.locator("viewer-sketch arcgis-sketch").evaluate(async (el: HTMLArcgisSketchElement, i) => {
    const layer = el.layer as any;
    await el.triggerUpdate(layer.graphics.getItemAt(i)!);
  }, index);
  await page.waitForTimeout(300);
}

/** Select several sketches together. */
export async function selectSketches(page: Page, indexes: number[]): Promise<void> {
  await page.locator("viewer-sketch arcgis-sketch").evaluate(async (el: HTMLArcgisSketchElement, ids) => {
    const layer = el.layer as any;
    await el.triggerUpdate(ids.map((i) => layer.graphics.getItemAt(i)!));
  }, indexes);
  await page.waitForTimeout(300);
}

/** A button in the Sketch panel, by its text. */
export const panelButton = (page: Page, name: string | RegExp) => page.locator("viewer-sketch").getByRole("button", { name });

/** Choose a configured color by name. */
export async function chooseColor(page: Page, name: string): Promise<void> {
  await page.locator(`viewer-sketch calcite-swatch[label="${name}"]`).click();
  await page.waitForTimeout(150);
}

/** The chosen color's hex, from the strip. */
export async function chosenColor(page: Page): Promise<string | undefined> {
  return page.locator("viewer-sketch").evaluate((el) => {
    const swatches = [...el.shadowRoot!.querySelectorAll("calcite-swatch")] as HTMLCalciteSwatchElement[];
    return swatches.find((s) => s.selected)?.value as string | undefined;
  });
}

/** Area fill's label, such as "Area fill: 25%". */
export async function fillLabel(page: Page): Promise<string> {
  return (await page.locator("viewer-sketch calcite-button").filter({ hasText: /^Area fill/ }).textContent())?.trim() ?? "";
}

export async function openFill(page: Page): Promise<void> {
  await page.locator("viewer-sketch calcite-button").filter({ hasText: /^Area fill/ }).click();
  await page.waitForFunction(() => {
    const popovers = [...document.querySelector("viewer-sketch")!.shadowRoot!.querySelectorAll("calcite-popover")] as HTMLCalcitePopoverElement[];
    return popovers.some((p) => p.label === "Area fill" && p.open);
  });
}

/** Choose a fill preset (None, 25%, 50%, 75%, Solid) in the open Area fill popover. */
export async function chooseFillPreset(page: Page, label: string): Promise<void> {
  await page.locator("viewer-sketch calcite-popover[data-popover='fill'] calcite-button").filter({ hasText: new RegExp(`^${label}$`) }).click();
  await page.waitForTimeout(150);
}

/** Whether the map's popup is open, and its selected feature's layer id. Its text is read with locators. */
export async function popupState(page: Page): Promise<{ open: boolean; layerId: string | undefined; count: number }> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
    const popup = el.popupElement as unknown as { open?: boolean; selectedFeature?: any; features?: unknown[] } | null;
    return { open: !!popup?.open, layerId: popup?.selectedFeature?.layer?.id, count: popup?.features?.length ?? 0 };
  });
}

/** The map's popup, for reading its text (locators look inside its shadow DOM). */
export const popup = (page: Page) => page.locator("arcgis-popup");
