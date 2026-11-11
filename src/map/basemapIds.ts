/**
 * A basemap styles service style ID: `provider/style`, optionally with more segments,
 * e.g. `arcgis/streets`, `arcgis/imagery/standard`, `osm/standard`. These need a credential.
 */
const BASEMAP_STYLE_ID = /^[a-z0-9-]+(\/[a-z0-9-]+)+$/i;

export function isBasemapStyleId(id: string): boolean {
  return BASEMAP_STYLE_ID.test(id);
}

/**
 * Hosts whose basemap requests need an API key (or sign-in): the basemap styles service and the
 * basemap APIs behind Map Viewer's "for Developers" basemaps (add-web-maps-and-scenes D3).
 */
export const BASEMAP_STYLES_HOSTS: readonly string[] = ["basemapstyles-api.arcgis.com", "basemaps-api.arcgis.com", "ibasemaps-api.arcgis.com"];

/**
 * Legacy well-known basemap IDs and their basemap styles equivalents.
 * `osm`, `hybrid`, and `satellite` are deliberately absent: they need no credential (`hybrid`
 * and `satellite` are built-in free basemaps, see freeBasemaps.ts).
 */
export const LEGACY_BASEMAP_IDS: Readonly<Record<string, string>> = {
  streets: "arcgis/streets",
  "streets-vector": "arcgis/streets",
  topo: "arcgis/topographic",
  "topo-vector": "arcgis/topographic",
  gray: "arcgis/light-gray",
  "gray-vector": "arcgis/light-gray",
  "dark-gray": "arcgis/dark-gray",
  "dark-gray-vector": "arcgis/dark-gray",
  oceans: "arcgis/oceans",
  terrain: "arcgis/terrain",
  "streets-night-vector": "arcgis/streets-night",
  "streets-relief-vector": "arcgis/streets-relief",
  "streets-navigation-vector": "arcgis/navigation",
  "national-geographic": "arcgis/topographic",
};
