import Basemap from "@arcgis/core/Basemap.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";

/**
 * Basemaps built into the viewer that need no API key (design D4). They come from Esri's
 * original public tile services, which also served these IDs in ArcGIS JS 3.x. Layers use URL
 * templates, so loading a basemap sends no service metadata request.
 *
 * `satellite` and `hybrid` are the IDs these services had in 3.x.
 */
export const ESRI_TILES = "https://services.arcgisonline.com/ArcGIS/rest/services/";

const IMAGERY_COPYRIGHT = "Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const CANVAS_COPYRIGHT = "Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community";

const esriLayer = (service: string, copyright: string) =>
  new WebTileLayer({ urlTemplate: `${ESRI_TILES}${service}/MapServer/tile/{level}/{row}/{col}`, copyright });
const esriThumbnail = (service: string) => `${ESRI_TILES}${service}/MapServer/tile/4/6/3`;

const FACTORIES: Readonly<Record<string, () => Basemap>> = {
  // Imagery with roads and place names on top.
  hybrid: () =>
    new Basemap({
      id: "hybrid",
      title: "Satellite + roads",
      thumbnailUrl: esriThumbnail("World_Imagery"),
      baseLayers: [esriLayer("World_Imagery", IMAGERY_COPYRIGHT)],
      referenceLayers: [
        esriLayer("Reference/World_Transportation", "Esri"),
        esriLayer("Reference/World_Boundaries_and_Places", "Esri"),
      ],
    }),
  satellite: () =>
    new Basemap({
      id: "satellite",
      title: "Satellite",
      thumbnailUrl: esriThumbnail("World_Imagery"),
      baseLayers: [esriLayer("World_Imagery", IMAGERY_COPYRIGHT)],
    }),
  light: () =>
    new Basemap({
      id: "light",
      title: "Light gray",
      thumbnailUrl: esriThumbnail("Canvas/World_Light_Gray_Base"),
      baseLayers: [esriLayer("Canvas/World_Light_Gray_Base", CANVAS_COPYRIGHT)],
      referenceLayers: [esriLayer("Canvas/World_Light_Gray_Reference", CANVAS_COPYRIGHT)],
    }),
  dark: () =>
    new Basemap({
      id: "dark",
      title: "Dark gray",
      thumbnailUrl: esriThumbnail("Canvas/World_Dark_Gray_Base"),
      baseLayers: [esriLayer("Canvas/World_Dark_Gray_Base", CANVAS_COPYRIGHT)],
      referenceLayers: [esriLayer("Canvas/World_Dark_Gray_Reference", CANVAS_COPYRIGHT)],
    }),
};

/** IDs of the built-in basemaps that need no key. */
export const FREE_BASEMAP_IDS: readonly string[] = Object.keys(FACTORIES);

/**
 * A new instance of a built-in free basemap, or `undefined` for any other ID. New each time,
 * because one basemap can't be shared by the map and a basemap toggle.
 */
export function freeBasemap(id: string): Basemap | undefined {
  return Object.hasOwn(FACTORIES, id) ? FACTORIES[id]() : undefined;
}

/** What to give the SDK for a configured basemap ID: a built-in free basemap, or the ID itself. */
export function resolveBasemap(id: string): Basemap | string {
  return freeBasemap(id) ?? id;
}
