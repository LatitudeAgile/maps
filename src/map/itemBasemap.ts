import esriRequest from "@arcgis/core/request.js";
import { BASEMAP_STYLES_HOSTS } from "./basemapIds.ts";

/** How long the style request may take before the basemap counts as needing a key. */
const STYLE_TIMEOUT_MS = 10_000;

/** What the viewer knows about an item's basemap before showing it (add-web-maps-and-scenes D3). */
export interface ItemBasemap {
  /** The basemap's title in the item, for console messages. */
  title: string;
  /** True when showing it would send requests that need an API key. */
  needsKey: boolean;
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** True for a URL on a host that needs an API key (or sign-in). */
export function urlNeedsKey(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    return BASEMAP_STYLES_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Decide whether an item's basemap needs a key (D3). A basemap layer needs one when its `url` or
 * `styleUrl` is on a basemap API host, or when it is a vector tile layer whose style's sources
 * are. The second case is common: Map Viewer's "for Developers" basemaps keep their style on the
 * portal but take tiles and metadata from `basemaps-api.arcgis.com`, whose metadata needs a
 * token. Reading the style costs one anonymous request per vector basemap layer. A style that
 * can't be read counts as needing a key, so the viewer never risks a sign-in prompt.
 */
export async function readItemBasemap(baseMap: unknown, portalUrl: string): Promise<ItemBasemap | undefined> {
  if (!isObject(baseMap)) return undefined;
  const title = typeof baseMap.title === "string" ? baseMap.title : "the item's basemap";
  const layers = Array.isArray(baseMap.baseMapLayers) ? baseMap.baseMapLayers.filter(isObject) : [];
  for (const layer of layers) {
    if (urlNeedsKey(layer.url) || urlNeedsKey(layer.styleUrl)) return { title, needsKey: true };
    if (layer.layerType !== "VectorTileLayer") continue;
    const styleUrl =
      typeof layer.styleUrl === "string"
        ? layer.styleUrl
        : typeof layer.itemId === "string"
          ? `${portalUrl}/sharing/rest/content/items/${layer.itemId}/resources/styles/root.json`
          : undefined;
    if (styleUrl && (await styleNeedsKey(styleUrl))) return { title, needsKey: true };
  }
  return { title, needsKey: false };
}

async function styleNeedsKey(styleUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STYLE_TIMEOUT_MS);
  try {
    const { data } = await esriRequest(styleUrl, { responseType: "json", authMode: "anonymous", signal: controller.signal });
    const sources = isObject(data) && isObject(data.sources) ? Object.values(data.sources).filter(isObject) : [];
    return sources.some((s) => urlNeedsKey(s.url) || (Array.isArray(s.tiles) && s.tiles.some(urlNeedsKey)));
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** The item's data with its basemap emptied, for when the viewer shows another basemap (D2, D3). */
export function withoutBasemap(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, baseMap: { baseMapLayers: [], title: "" } };
}
