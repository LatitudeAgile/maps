import type { ComponentConfig, ViewerConfig } from "../config/types.ts";
import { isBasemapStyleId } from "./basemapIds.ts";

export interface BasemapChoice {
  /** Basemap ID to give the map. */
  basemap: string;
  /** True when the configured basemap needed a credential that isn't available. */
  fellBack: boolean;
}

/**
 * Decide the basemap before the map is created, so that without a key no request is ever
 * sent to the basemap styles service. Running without a key is supported, so the fallback is
 * not a warning.
 */
export function chooseBasemap(config: Pick<ViewerConfig, "map">, hasKey: boolean): BasemapChoice {
  const { basemap, fallbackBasemap } = config.map;
  if (!hasKey && isBasemapStyleId(basemap)) {
    return { basemap: fallbackBasemap, fellBack: true };
  }
  return { basemap, fellBack: false };
}

/**
 * Without a key, leave out basemap toggles whose next basemap is a basemap styles style. The
 * toggle loads its next basemap at startup for its thumbnail, and a keyless request there makes
 * the SDK open a sign-in dialog over the map (design D5). Returns the components to create and
 * the ones left out.
 */
export function leaveOutKeyedToggles(
  components: readonly ComponentConfig[],
  hasKey: boolean,
): { kept: ComponentConfig[]; leftOut: ComponentConfig[] } {
  const needsKey = (c: ComponentConfig) =>
    !hasKey && c.type === "basemap-toggle" && typeof c.options.nextBasemap === "string" && isBasemapStyleId(c.options.nextBasemap);
  return { kept: components.filter((c) => !needsKey(c)), leftOut: components.filter(needsKey) };
}
