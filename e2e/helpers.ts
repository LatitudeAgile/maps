import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/** The shipped default config, read from source. */
export function defaultConfig(): Record<string, any> {
  return JSON.parse(readFileSync(new URL("../public/config/viewer.json", import.meta.url), "utf8"));
}

/** Serve `body` (string, or an object to stringify) in place of config/viewer.json. */
export async function serveConfig(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route("**/config/viewer.json", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** Serve the default config with changes applied. */
export async function serveModifiedConfig(page: Page, edit: (config: Record<string, any>) => void): Promise<void> {
  const config = defaultConfig();
  edit(config);
  await serveConfig(page, config);
}

export interface MapState {
  zoom: number;
  scale: number;
  center: [number, number];
  stationary: boolean;
  basemapId: string | undefined;
  basemapTitle: string | undefined;
  basemapStyleId: string | undefined;
  width: number;
}

/** Wait until `<arcgis-map>` exists and its view is ready. */
export async function mapReady(page: Page): Promise<void> {
  await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.viewOnReady());
}

export async function mapState(page: Page): Promise<MapState> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => ({
    zoom: el.zoom,
    scale: el.scale,
    center: [el.center.longitude ?? NaN, el.center.latitude ?? NaN] as [number, number],
    stationary: el.stationary,
    basemapId: el.map?.basemap?.id ?? undefined,
    basemapTitle: el.map?.basemap?.title ?? undefined,
    basemapStyleId: el.map?.basemap?.style?.id ?? undefined,
    width: el.view.width,
  }));
}

/** Poll until the view is stationary and `predicate` holds; returns the settled state. */
export async function settled(
  page: Page,
  predicate: (s: MapState) => boolean = () => true,
  timeout = 15_000,
): Promise<MapState> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const s = await mapState(page);
    if (s.stationary && predicate(s)) return s;
    if (Date.now() > deadline) throw new Error(`Map did not settle: ${JSON.stringify(s)}`);
    await page.waitForTimeout(100);
  }
}

/** Hosts of the ArcGIS basemap styles service and its tile services. */
export const BASEMAP_STYLES_HOSTS = /(^|\.)(basemapstyles-api|basemaps-api|ibasemaps-api)\.arcgis\.com$/;

/**
 * Requests that may carry the basemap key: the basemap styles service, its tile services,
 * and the style resources it references. Observed in a keyed run with `arcgis/streets`
 * (SDK 5.2, 2026-11-06):
 * - basemapstyles-api.arcgis.com: style, webmap, and layer definitions
 * - basemaps-api.arcgis.com: vector tiles and glyphs
 * - cdn.arcgis.com/sharing/rest/content/items/<id>/resources/: style sprites
 * - static.arcgis.com/attribution/: basemap attribution
 * ibasemaps-api.arcgis.com serves imagery styles; it was not exercised by arcgis/streets.
 */
export function isBasemapStyleRequest(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (BASEMAP_STYLES_HOSTS.test(u.host)) return true;
  if (u.host === "cdn.arcgis.com") return /^\/sharing\/rest\/content\/items\/[0-9a-f]{32}\/resources\//.test(u.pathname);
  if (u.host === "static.arcgis.com") return u.pathname.startsWith("/attribution/");
  return false;
}

/** True when `actual` is within `fraction` (default 1%) of `expected`. */
export const withinFraction = (actual: number, expected: number, fraction = 0.01): boolean =>
  Math.abs(actual - expected) <= expected * fraction;

export const hostOf =(url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** Read a fixture file from e2e/fixtures. */
export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

export interface FixtureRouteOptions {
  /** Respond after this many milliseconds. */
  delayMs?: number;
  /** HTTP status; non-2xx responses get a plain-text body. */
  status?: number;
  /** Never respond (the request stays pending). */
  hang?: boolean;
}

/**
 * Serve a GeoJSON fixture for every request matching `pattern`. Config layers use relative
 * URLs such as `data/points.geojson`, which resolve to `<base>/config/data/points.geojson`.
 */
export async function serveGeoJSON(page: Page, pattern: string, file = "points.geojson", options: FixtureRouteOptions = {}): Promise<void> {
  await page.context().route(pattern, async (route) => {
    if (options.hang) return; // leave pending
    if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
    const status = options.status ?? 200;
    if (status >= 300) return route.fulfill({ status, body: "Not found" });
    return route.fulfill({ status, contentType: "application/geo+json", body: fixture(file) });
  });
}

/** A geojson layer entry pointing at `data/<id>.geojson` next to the config. */
export const geojsonLayer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "geojson",
  url: `data/${id}.geojson`,
  ...extra,
});

/** Ids of the map's operational layers, bottom to top. */
export async function mapLayerIds(page: Page): Promise<string[]> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.map?.layers.toArray().map((l) => l.id) ?? []);
}

/** Wait until the layer's view has finished drawing, then count its drawn features. */
export async function drawnFeatureCount(page: Page, layerId: string, timeout = 15_000): Promise<number> {
  return page.locator("arcgis-map").evaluate(
    async (el: HTMLArcgisMapElement, { layerId, timeout }) => {
      const layer = el.map?.findLayerById(layerId);
      if (!layer) throw new Error(`no layer ${layerId}`);
      const lv = (await el.view.whenLayerView(layer)) as unknown as { updating: boolean; queryFeatureCount(): Promise<number> };
      const deadline = Date.now() + timeout;
      while (lv.updating && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      return lv.queryFeatureCount();
    },
    { layerId, timeout },
  );
}

/** Click the map at a longitude/latitude, once the view is ready and settled. */
export async function clickMapAt(page: Page, lon: number, lat: number): Promise<void> {
  await settled(page);
  const pt = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement, [lon, lat]) => {
    // The view is Web Mercator with no rotation: project, then scale into the view's extent.
    const R = 20037508.342789244;
    const x = (lon * R) / 180;
    const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);
    const e = el.view.extent;
    const box = el.getBoundingClientRect();
    return {
      x: box.left + ((x - e.xmin) / (e.xmax - e.xmin)) * el.view.width,
      y: box.top + ((e.ymax - y) / (e.ymax - e.ymin)) * el.view.height,
    };
  }, [lon, lat] as const);
  await page.mouse.click(pt.x, pt.y);
}
