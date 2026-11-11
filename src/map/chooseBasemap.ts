import type { ViewerConfig } from "../config/types.ts";
import { isBasemapStyleId } from "./basemapIds.ts";
import type { ItemBasemap } from "./itemBasemap.ts";

export interface BasemapChoice {
  /** Basemap ID to give the map; undefined keeps the map item's own basemap. */
  basemap: string | undefined;
  /** True when the basemap that would have been shown needed a credential that isn't available. */
  fellBack: boolean;
  /** The basemap the user was meant to see, for the console: a config ID or the item's basemap title. */
  intended: string | undefined;
  /** True when the basemap shown needs a key, so a refusal at runtime falls back (design D9). */
  needsKey: boolean;
}

/**
 * Decide the basemap before the map is created, so that without a key no request is ever
 * sent to the basemap styles service (add-web-maps-and-scenes D3). Running without a key is
 * supported, so the fallback is not a warning.
 *
 * - `map.basemap` set: it wins, with the keyless rule.
 * - Otherwise, an item basemap that needs a key, without a key: `map.fallbackBasemap`.
 * - Otherwise: the item's own basemap.
 */
export function chooseBasemap(config: Pick<ViewerConfig, "map">, hasKey: boolean, itemBasemap?: ItemBasemap): BasemapChoice {
  const { basemap, fallbackBasemap } = config.map;
  if (basemap !== undefined) {
    if (!hasKey && isBasemapStyleId(basemap)) return { basemap: fallbackBasemap, fellBack: true, intended: basemap, needsKey: false };
    return { basemap, fellBack: false, intended: basemap, needsKey: isBasemapStyleId(basemap) };
  }
  if (itemBasemap?.needsKey && !hasKey) {
    return { basemap: fallbackBasemap, fellBack: true, intended: itemBasemap.title, needsKey: false };
  }
  return { basemap: undefined, fellBack: false, intended: itemBasemap?.title, needsKey: itemBasemap?.needsKey ?? false };
}
