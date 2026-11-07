/**
 * A basemap styles service style ID: `provider/style`, optionally with more segments,
 * e.g. `arcgis/streets`, `arcgis/imagery/standard`, `osm/standard`. These need a credential.
 */
const BASEMAP_STYLE_ID = /^[a-z0-9-]+(\/[a-z0-9-]+)+$/i;

export function isBasemapStyleId(id: string): boolean {
  return BASEMAP_STYLE_ID.test(id);
}

/**
 * Legacy well-known basemap IDs and their basemap styles equivalents.
 * `osm` is deliberately absent: it is the credential-free fallback.
 */
export const LEGACY_BASEMAP_IDS: Readonly<Record<string, string>> = {
  streets: "arcgis/streets",
  "streets-vector": "arcgis/streets",
  satellite: "arcgis/imagery/standard",
  hybrid: "arcgis/imagery",
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
