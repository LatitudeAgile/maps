import type { ViewerConfig } from "../config/types.ts";
import { isBasemapStyleId } from "./basemapIds.ts";

export interface BasemapChoice {
  /** Basemap ID to give the map. */
  basemap: string;
  /** True when the configured basemap needed a credential that isn't available. */
  fellBack: boolean;
}

/**
 * Decide the basemap before the map is created, so that without a key no request is ever
 * sent to the basemap styles service (design D4).
 */
export function chooseBasemap(config: Pick<ViewerConfig, "map">, hasKey: boolean): BasemapChoice {
  const { basemap, fallbackBasemap } = config.map;
  if (!hasKey && isBasemapStyleId(basemap)) {
    return { basemap: fallbackBasemap, fellBack: true };
  }
  return { basemap, fellBack: false };
}
