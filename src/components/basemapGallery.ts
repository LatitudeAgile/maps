import Basemap from "@arcgis/core/Basemap.js";
import { isBasemapStyleId, LEGACY_BASEMAP_IDS } from "../map/basemapIds.ts";
import { freeBasemap } from "../map/freeBasemaps.ts";
import type { ConfigurableElement, KeylessResult } from "./registry.ts";

/** The free basemaps, then five ArcGIS styles that are offered only with a key. */
export const DEFAULT_GALLERY_BASEMAPS = [
  "osm",
  "hybrid",
  "satellite",
  "light",
  "dark",
  "arcgis/streets",
  "arcgis/topographic",
  "arcgis/imagery",
  "arcgis/light-gray",
  "arcgis/dark-gray",
] as const;

/** A legacy ID becomes its basemap styles ID; anything else is unchanged. */
const modernId = (id: string) => (Object.hasOwn(LEGACY_BASEMAP_IDS, id) ? LEGACY_BASEMAP_IDS[id] : id);

/** True when the basemap needs an API key: a basemap styles ID, directly or through a legacy ID. */
export const galleryBasemapNeedsKey = (id: string) => isBasemapStyleId(modernId(id));

/** A gallery entry: a built-in free basemap, or the SDK's basemap for the ID (design D5). */
export function galleryBasemap(id: string): Basemap {
  return freeBasemap(id) ?? Basemap.fromId(modernId(id)) ?? new Basemap({ style: { id: modernId(id) } });
}

export async function configureBasemapGallery(element: ConfigurableElement, options: Readonly<Record<string, unknown>>): Promise<void> {
  // The non-widget module (the widgets/ copy is deprecated at 5.2).
  const { default: LocalBasemapsSource } = await import("@arcgis/core/basemapGallery/LocalBasemapsSource.js");
  element.source = new LocalBasemapsSource({ basemaps: (options.basemaps as string[]).map(galleryBasemap) });
}

/** Without a key, offer only the basemaps that need none; with none left, leave the gallery out. */
export function basemapGalleryKeyless(options: Readonly<Record<string, unknown>>): KeylessResult {
  const free = (options.basemaps as string[]).filter((id) => !galleryBasemapNeedsKey(id));
  return free.length > 0
    ? { keep: { ...options, basemaps: free } }
    : { leaveOut: "none of the basemap gallery's basemaps work without an API key" };
}
