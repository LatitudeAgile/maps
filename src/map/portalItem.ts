import esriRequest from "@arcgis/core/request.js";
import type { MapViewKind } from "../config/types.ts";

/** How long the portal may take to answer each item request (web-maps). */
export const ITEM_TIMEOUT_MS = 15_000;

/** The item types the viewer opens, and the view each opens in. */
const ITEM_VIEWS: Readonly<Record<string, MapViewKind>> = { "Web Map": "2d", "Web Scene": "3d" };

/** The parts of the item's JSON the viewer reads. */
export interface ItemInfo {
  id: string;
  type: string;
  title?: string;
}

export type MapItemResult =
  | {
      ok: true;
      /** `"2d"` for a web map, `"3d"` for a web scene. */
      view: MapViewKind;
      item: ItemInfo & Record<string, unknown>;
      /** The item's data: the web map or web scene JSON. */
      data: Record<string, unknown>;
      /** The item's URL, without query, as the SDK requests it. */
      itemUrl: string;
      /** The data URL, without query. */
      dataUrl: string;
    }
  | { ok: false; reason: "not-public"; id: string; portalUrl: string }
  | { ok: false; reason: "wrong-type"; id: string; type: string }
  | { ok: false; reason: "unreachable"; id: string; portalUrl: string };

/**
 * Read a web map or web scene item and its data without signing in (add-web-maps-and-scenes
 * D1). `authMode: "anonymous"` means a private item fails instead of opening the sign-in
 * dialog. Never throws.
 *
 * Any answer from the portal that isn't the item (a missing item, or one not shared publicly)
 * is `not-public`: ArcGIS Online answers those two differently, but the fix is the same.
 * Network failures and timeouts are `unreachable`.
 */
export async function readMapItem(portalUrl: string, id: string): Promise<MapItemResult> {
  const itemUrl = `${portalUrl}/sharing/rest/content/items/${id}`;
  const dataUrl = `${itemUrl}/data`;
  const notPublic = { ok: false, reason: "not-public", id, portalUrl } as const;
  const unreachable = { ok: false, reason: "unreachable", id, portalUrl } as const;

  const item = await getJson(itemUrl);
  if (item.kind !== "ok") return item.kind === "answered" ? notPublic : unreachable;
  const info = item.json as ItemInfo & Record<string, unknown>;
  const view = typeof info.type === "string" ? ITEM_VIEWS[info.type] : undefined;
  if (!view) return { ok: false, reason: "wrong-type", id, type: String(info.type ?? "unknown") };

  const data = await getJson(dataUrl);
  if (data.kind !== "ok") return data.kind === "answered" ? notPublic : unreachable;
  return { ok: true, view, item: info, data: data.json, itemUrl, dataUrl };
}

type JsonResult = { kind: "ok"; json: Record<string, unknown> } | { kind: "answered" } | { kind: "failed" };

/** One anonymous JSON request. `answered` means the portal replied with an error. */
async function getJson(url: string): Promise<JsonResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ITEM_TIMEOUT_MS);
  try {
    const response = await esriRequest(url, {
      query: { f: "json" },
      responseType: "json",
      authMode: "anonymous",
      signal: controller.signal,
    });
    const json = response.data as unknown;
    if (typeof json !== "object" || json === null || Array.isArray(json)) return { kind: "answered" };
    return { kind: "ok", json: json as Record<string, unknown> };
  } catch (err) {
    return portalAnswered(err) ? { kind: "answered" } : { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** True when the error carries the portal's own reply (an HTTP or JSON error), not a lost connection. */
function portalAnswered(err: unknown): boolean {
  const e = err as { name?: string; details?: { httpStatus?: number; messageCode?: string } } | undefined;
  if (e?.name === "AbortError") return false;
  const status = e?.details?.httpStatus;
  return (typeof status === "number" && status > 0) || typeof e?.details?.messageCode === "string";
}

/** The user-facing title and message for an item that couldn't be opened. */
export function itemErrorText(result: Exclude<MapItemResult, { ok: true }>): { title: string; message: string } {
  const title = "The map could not be opened";
  switch (result.reason) {
    case "not-public":
      return {
        title,
        message: `The web map or web scene "${result.id}" could not be read from ${result.portalUrl}. The item must exist and be shared publicly (with everyone).`,
      };
    case "wrong-type":
      return { title, message: `Item "${result.id}" is a "${result.type}", not a web map or web scene.` };
    case "unreachable":
      return {
        title,
        message: `The portal at ${result.portalUrl} could not be reached to open item "${result.id}". Check the network connection and portal.url.`,
      };
  }
}
