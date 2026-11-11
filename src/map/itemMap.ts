import esriConfig from "@arcgis/core/config.js";
import type WebMap from "@arcgis/core/WebMap.js";
import type WebScene from "@arcgis/core/WebScene.js";
import type { MapItemResult } from "./portalItem.ts";

type ReadItem = Extract<MapItemResult, { ok: true }>;

/** Escape a string for use in a RegExp. */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build the WebMap or WebScene for an item the viewer has already read (add-web-maps-and-scenes
 * D2). Request interceptors answer the SDK's requests for the item and its data with that JSON,
 * so the SDK never fetches the item itself: no second request, no sign-in prompt, and `data`
 * can already have its basemap replaced (D3). The map keeps its `portalItem`.
 */
export async function createItemMap(read: ReadItem, data: Record<string, unknown> = read.data): Promise<WebMap | WebScene> {
  const interceptors = (esriConfig.request.interceptors ??= []);
  // Exactly the item URL and the data URL, with any query: not the item's thumbnail or resources.
  interceptors.push(
    { urls: new RegExp(`^${escape(read.itemUrl)}(\\?.*)?$`), before: () => structuredClone(read.item) },
    { urls: new RegExp(`^${escape(read.dataUrl)}(\\?.*)?$`), before: () => structuredClone(data) },
  );
  const portalItem = { id: read.item.id };
  const map: WebMap | WebScene =
    read.view === "3d"
      ? new (await import("@arcgis/core/WebScene.js")).default({ portalItem })
      : new (await import("@arcgis/core/WebMap.js")).default({ portalItem });
  // Loaded here, before any view, so that a basemap set afterwards isn't overwritten when the
  // map reads its JSON (D3). A failure is left for the view to report.
  await map.load().catch(() => undefined);
  return map;
}

/**
 * Never prompt for sign-in, in an app opened from an item (web-maps: public items only). Any
 * request that needs a credential the viewer doesn't have fails instead of opening the SDK's
 * sign-in dialog, so a layer in a public item that needs sign-in fails like any other layer
 * (add-web-maps-and-scenes risk: secured layers). Credentials the viewer does have, such as the
 * API key, are still used. Install before the item's map is created.
 */
export function neverPromptForSignIn(): void {
  const interceptors = (esriConfig.request.interceptors ??= []);
  interceptors.push({
    before: (params) => {
      params.requestOptions = { ...params.requestOptions, authMode: "no-prompt" };
    },
  });
}

/** A layer that may hold others, as a GroupLayer does. */
interface MaybeGroup {
  type: string;
  layers?: { toArray(): MaybeGroup[] };
}

/**
 * The item's operational layers, with group layers replaced by the layers inside them, in map
 * order. Taken right after the item's map has loaded, before any config layer is added (D7).
 */
export function operationalLayers<T extends MaybeGroup>(layers: { toArray(): T[] }): T[] {
  return layers.toArray().flatMap((layer) => (layer.type === "group" && layer.layers ? operationalLayers(layer.layers as { toArray(): T[] }) : [layer]));
}
