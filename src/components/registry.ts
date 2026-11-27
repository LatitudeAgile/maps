import { isBasemapStyleId } from "../map/basemapIds.ts";
import { DEFAULT_GEOCODER_URL } from "./geocoder.ts";
import { buildSearchSources } from "./searchSources.ts";
import { CORNER_PLACEMENTS } from "../config/types.ts";
import type { ComponentType } from "./componentType.ts";
import builtInTypes from "./builtInTypes.json";
import { folders } from "virtual:viewer-extensions";
import { checkExtensions } from "./extensions.ts";
import { DEFAULT_SKETCH_COLORS } from "./sketch/palette.ts";
import { MEASURE_TOOLS, MEASURE_UNITS } from "./measure/options.ts";
import { configureCoordinateConversion, COORDINATE_FORMATS, COORDINATE_MODES } from "./coordinateConversion.ts";
import { basemapGalleryKeyless, configureBasemapGallery, DEFAULT_GALLERY_BASEMAPS } from "./basemapGallery.ts";
import { configureLayerList } from "./layerList.ts";
import { configureDirections, DEFAULT_ROUTE_SERVICE_URL, DIRECTIONS_UNITS, directionsKeyless } from "./directions.ts";

export type {
  ComponentContext,
  ComponentType,
  ComponentTypeSchema,
  ConfigurableElement,
  CornerStyle,
  ExtensionManifest,
  KeylessResult,
  OptionKind,
} from "./componentType.ts";

/*
 * Each type's code loads only when an app uses it (map-components; 3d-print D3). This module is
 * in the viewer's entry, so anything it imports statically is downloaded by every app. From a
 * type's folder it may import only small option modules that import nothing else, as
 * sketch/palette.ts and measure/options.ts are. A type's element, its other code and its
 * libraries load only through its `load` or `configure` dynamic imports. The same holds for the
 * sidebar, the viewer API and extension manifests. After adding a type, build and check that it
 * has its own file in dist/assets/ and that the entry doesn't hold its code.
 */

/** The built-in component types. Their names are also listed in builtInTypes.json (D6). */
export const BUILT_IN_TYPES: Readonly<Record<string, ComponentType>> = {
  home: {
    tag: "arcgis-home",
    load: () => import("@arcgis/map-components/components/arcgis-home"),
    // `label` is deliberately absent: arcgis-home 5.2 doesn't use it for the button's name
    // (it stays "Home"), so it would be a setting with no visible effect.
    options: { icon: "string" },
    panel: { heading: "Home", icon: "home" },
    cornerStyle: "button",
  },
  // Zoom-in and zoom-out buttons. A config without a zoom entry shows none; wheel, pinch and
  // keyboard zoom still work (design D2).
  zoom: {
    tag: "arcgis-zoom",
    load: () => import("@arcgis/map-components/components/arcgis-zoom"),
    options: {},
    panel: { heading: "Zoom", icon: "magnifying-glass-plus" },
    cornerStyle: "button",
  },
  legend: {
    tag: "arcgis-legend",
    load: () => import("@arcgis/map-components/components/arcgis-legend"),
    options: { layerInfos: "layer-info[]", basemapLegendVisible: "boolean", hideLayersNotInCurrentView: "boolean" },
    panel: { heading: "Legend", icon: "legend" },
    cornerStyle: "panel",
    expandable: true,
  },
  // Panel icons are each component's own default icon (design D2).
  locate: {
    tag: "arcgis-locate",
    load: () => import("@arcgis/map-components/components/arcgis-locate"),
    options: { scale: "scale", icon: "string", popupDisabled: "boolean" },
    panel: { heading: "Locate", icon: "gps-off" },
    cornerStyle: "button",
    reportsLocationErrors: true,
    locationMarker: true,
  },
  track: {
    tag: "arcgis-track",
    load: () => import("@arcgis/map-components/components/arcgis-track"),
    options: { scale: "scale", icon: "string", rotationDisabled: "boolean" },
    panel: { heading: "Track", icon: "compass-north-circle" },
    cornerStyle: "button",
    reportsLocationErrors: true,
    locationMarker: true,
  },
  "basemap-toggle": {
    tag: "arcgis-basemap-toggle",
    load: () => import("@arcgis/map-components/components/arcgis-basemap-toggle"),
    options: { nextBasemap: "basemap", showTitle: "boolean" },
    // The built-in imagery hybrid, which needs no key.
    defaults: { nextBasemap: "hybrid" },
    // Its startup thumbnail load would open a sign-in dialog without a key.
    keyless: (options) =>
      typeof options.nextBasemap === "string" && isBasemapStyleId(options.nextBasemap)
        ? { leaveOut: `the basemap toggle's next basemap "${options.nextBasemap}" needs an API key` }
        : { keep: { ...options } },
    panel: { heading: "Basemap", icon: "layer-basemap" },
  },
  // Addresses and places through a keyless geocoder; the key is never sent to it (D3).
  search: {
    tag: "arcgis-search",
    load: () => import("@arcgis/map-components/components/arcgis-search"),
    options: { geocoderUrl: "url", maxSuggestions: { integer: [1, 10] }, popupDisabled: "boolean" },
    defaults: { geocoderUrl: DEFAULT_GEOCODER_URL },
    panel: { heading: "Search", icon: "search" },
    cornerStyle: "button",
    expandable: true,
    configure: async (element, options, { geocoding, apiKey }) => {
      // Never fall back to the portal's default source, which needs a key.
      element.includeDefaultSourcesDisabled = true;
      // The world geocoder, then the geocoding section's sources; "All" is selected (D16).
      element.sources = await buildSearchSources(options.geocoderUrl as string, geocoding, apiKey);
      // The component's name for it; the core Search API calls it searchAllEnabled.
      element.searchAllDisabled = false;
      element.activeSourceIndex = -1; // "All"
      if (options.maxSuggestions !== undefined) element.maxSuggestions = options.maxSuggestions;
      if (options.popupDisabled !== undefined) element.popupDisabled = options.popupDisabled;
    },
  },
  // Routing through a route service from config; the key goes only to ArcGIS routing (D4).
  directions: {
    tag: "arcgis-directions",
    load: () => import("@arcgis/map-components/components/arcgis-directions"),
    options: { routeServiceUrl: "url", unit: { oneOf: DIRECTIONS_UNITS } },
    defaults: { routeServiceUrl: DEFAULT_ROUTE_SERVICE_URL, unit: "miles" },
    // A car reads as directions; the component's own default, "right", is a plain arrow.
    panel: { heading: "Directions", icon: "car" },
    cornerStyle: "panel",
    configure: configureDirections,
    keyless: directionsKeyless,
  },
  // Operational layers with visibility checkboxes.
  "layer-list": {
    tag: "arcgis-layer-list",
    load: () => import("@arcgis/map-components/components/arcgis-layer-list"),
    options: { visibilityAppearance: { oneOf: ["checkbox", "default"] }, showFilter: "boolean", openGroups: "boolean" },
    // The SDK's own default is an eye icon; the viewer's is a checkbox (design D6).
    defaults: { visibilityAppearance: "checkbox" },
    configure: configureLayerList,
    panel: { heading: "Layers", icon: "layers" },
    cornerStyle: "panel",
    expandable: true,
  },
  // Basemap thumbnails to choose from; without a key, only those that need none (D5).
  "basemap-gallery": {
    tag: "arcgis-basemap-gallery",
    load: () => import("@arcgis/map-components/components/arcgis-basemap-gallery"),
    options: { basemaps: "basemap[]" },
    defaults: { basemaps: [...DEFAULT_GALLERY_BASEMAPS] },
    panel: { heading: "Basemaps", icon: "basemap" },
    cornerStyle: "panel",
    expandable: true,
    configure: configureBasemapGallery,
    keyless: basemapGalleryKeyless,
  },
  // Esri's print component as it ships (design D1). Without printServiceUrl nothing is
  // set, so the component keeps its own default, the ArcGIS Online print service.
  print: {
    tag: "arcgis-print",
    load: () => import("@arcgis/map-components/components/arcgis-print"),
    options: { printServiceUrl: "url" },
    // arcgis-print reports a sceneViewError in a scene: it prints 2D maps only.
    views: ["2d"],
    panel: { heading: "Print", icon: "print" },
    cornerStyle: "panel",
    expandable: true,
  },
  // Prints the map in the browser, 2D and 3D, with no print service: a framed print area, as a
  // Letter PDF (a GeoPDF) or the map alone as a JPEG (3d-print D1). `title` isn't assigned as
  // a property: it would set the element's HTML title, a tooltip over the whole panel.
  "local-print": {
    tag: "viewer-local-print",
    load: () => import("./localPrint/index.ts"),
    options: { title: "string", orientation: { oneOf: ["landscape", "portrait"] }, format: { oneOf: ["pdf", "jpg"] } },
    defaults: { orientation: "landscape", format: "pdf" },
    placements: ["panel", ...CORNER_PLACEMENTS],
    panel: { heading: "Local print", icon: "print" },
    cornerStyle: "panel",
    expandable: true,
    // Used on the map while open (framing the print), like measure.
    expandMode: "floating",
    configure: (element, options) => {
      if (options.title !== undefined) element.printTitle = options.title;
      element.orientation = options.orientation;
      element.format = options.format;
    },
  },
  // Drawing and writing on the map, ported from StewardshipOS (design D5). Panel only: its
  // toolbar, colors and fill need panel room, and drawing turns on and off with the panel.
  sketch: {
    tag: "viewer-sketch",
    load: () => import("./sketch/index.ts"),
    options: { colors: "color[]", fillPercent: { integer: [0, 100] }, unit: { oneOf: ["imperial", "metric"] } },
    defaults: { colors: DEFAULT_SKETCH_COLORS.map((c) => ({ ...c })), fillPercent: 0, unit: "imperial" },
    placements: ["panel"],
    // Its symbols, saved sketches and printing are 2D; 3D sketching waits for a later change.
    views: ["2d"],
    panel: { heading: "Sketch", icon: "pencil" },
  },
  // Distances and areas, in 2D and 3D, with a Clear button; closing stops a measurement in
  // progress and keeps a finished one (add-map-expand-and-components D5).
  measure: {
    tag: "viewer-measure",
    load: () => import("./measure/index.ts"),
    options: { tools: { listOf: MEASURE_TOOLS }, unit: { oneOf: MEASURE_UNITS } },
    defaults: { tools: [...MEASURE_TOOLS], unit: "imperial" },
    placements: ["panel", ...CORNER_PLACEMENTS],
    panel: { heading: "Measure", icon: "measure" },
    cornerStyle: "panel",
    expandable: true,
    expandMode: "floating",
  },
  // Shows the whole viewer, or only the map, fullscreen (add-map-expand-and-components D7).
  // The element is always set: the SDK's default, the view container's parent, isn't the viewer.
  fullscreen: {
    tag: "arcgis-fullscreen",
    load: () => import("@arcgis/map-components/components/arcgis-fullscreen"),
    options: { target: { oneOf: ["app", "map"] } },
    defaults: { target: "app" },
    placements: [...CORNER_PLACEMENTS, "none"],
    panel: { heading: "Fullscreen", icon: "full-screen" },
    cornerStyle: "button",
    configure: (element, options, { mapElement }) => {
      element.element = options.target === "map" ? mapElement : (document.querySelector("calcite-shell") ?? undefined);
    },
  },
  // The map's scale as a bar, updated as it zooms. The SDK's scale bar takes a MapView only.
  "scale-bar": {
    tag: "arcgis-scale-bar",
    load: () => import("@arcgis/map-components/components/arcgis-scale-bar"),
    options: { unit: { oneOf: ["imperial", "metric", "dual"] }, barStyle: { oneOf: ["line", "ruler"] } },
    defaults: { unit: "imperial", barStyle: "line" },
    placements: [...CORNER_PLACEMENTS],
    views: ["2d"],
    panel: { heading: "Scale bar", icon: "actual-size" },
  },
  // Bookmarks from the web map or web scene, then from the config, then the user's own, kept in
  // the browser per app (src/components/bookmarks.ts).
  bookmarks: {
    tag: "arcgis-bookmarks",
    load: () => import("@arcgis/map-components/components/arcgis-bookmarks"),
    options: { bookmarks: "bookmark[]", showAddBookmarkButton: "boolean", showFilter: "boolean" },
    defaults: { showAddBookmarkButton: true },
    panel: { heading: "Bookmarks", icon: "bookmark" },
    cornerStyle: "panel",
    expandable: true,
    // Loaded with the type, so a config without bookmarks doesn't load their storage code.
    configure: async (element, options, context) => (await import("./bookmarks.ts")).configureBookmarks(element, options, context),
  },
  // Coordinates of the pointer or a clicked point, in chosen formats, and going to typed
  // coordinates; converted in the browser.
  "coordinate-conversion": {
    tag: "arcgis-coordinate-conversion",
    load: () => import("@arcgis/map-components/components/arcgis-coordinate-conversion"),
    options: { formats: { listOf: COORDINATE_FORMATS }, mode: { oneOf: COORDINATE_MODES } },
    defaults: { mode: "live" },
    panel: { heading: "Coordinates", icon: "coordinate-system" },
    cornerStyle: "button",
    expandable: true,
    // Capture mode takes taps on the map, which a modal sheet would catch.
    expandMode: "floating",
    configure: configureCoordinateConversion,
  },
  // Which way is north; pressing it turns the map back to north up. 2D and 3D (map-components).
  compass: {
    tag: "arcgis-compass",
    load: () => import("@arcgis/map-components/components/arcgis-compass"),
    options: {},
    panel: { heading: "Compass", icon: "compass" },
  },
  // Switches what dragging does in a scene: pan or rotate. The SDK supports it in arcgis-scene
  // only (map-components; add-web-maps-and-scenes D10).
  "navigation-toggle": {
    tag: "arcgis-navigation-toggle",
    load: () => import("@arcgis/map-components/components/arcgis-navigation-toggle"),
    options: { layout: { oneOf: ["vertical", "horizontal"] } },
    views: ["3d"],
    panel: { heading: "Navigation", icon: "move-and-rotate" },
    cornerStyle: "button",
  },
};

const extensions = checkExtensions(folders, BUILT_IN_TYPES);

/**
 * Component types a config can use under `components[].type`: the built-in types, then the
 * valid extension folders under extensions/ (add-drop-in-extensions D3).
 */
export const COMPONENT_TYPES: Readonly<Record<string, ComponentType>> = { ...BUILT_IN_TYPES, ...extensions.types };

/** Extension folders that were skipped, and why, by folder name. */
export const SKIPPED_EXTENSIONS: ReadonlyMap<string, string> = extensions.skipped;

// builtInTypes.json must list exactly the built-in types: the scaffolder reads it (D6).
if (import.meta.env.DEV) {
  const listed = [...builtInTypes.types].sort().join(", ");
  const actual = Object.keys(BUILT_IN_TYPES).sort().join(", ");
  if (listed !== actual) {
    console.error(`[viewer] src/components/builtInTypes.json doesn't match the built-in types in registry.ts. Listed: ${listed}. Registered: ${actual}.`);
  }
}
