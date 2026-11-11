import type EsriMap from "@arcgis/core/Map.js";
import type { AppModel } from "../app/AppModel.ts";
import { isBasemapStyleId } from "../map/basemapIds.ts";
import { DEFAULT_GEOCODER_URL } from "./geocoder.ts";
import { buildSearchSources } from "./searchSources.ts";
import type { GeocodingConfig } from "../config/geocoding.ts";
import type { ComponentPlacement, MapViewKind } from "../config/types.ts";
import { DEFAULT_SKETCH_COLORS } from "./sketch/palette.ts";
import { basemapGalleryKeyless, configureBasemapGallery, DEFAULT_GALLERY_BASEMAPS } from "./basemapGallery.ts";
import { configureDirections, DEFAULT_ROUTE_SERVICE_URL, DIRECTIONS_UNITS, directionsKeyless } from "./directions.ts";

/**
 * How a component option's config value is checked and applied. `layer` and `layer[]`
 * options take layer ids from `layers`, resolved to the created layers. `layer-info[]` takes
 * `{ layer: <id>, title?: <text> }` entries, resolved to `{ layer: <Layer>, title }` (the SDK's
 * LayerInfo shape, used by the legend). `scale` is a number greater than 0. `basemap` is a
 * non-empty basemap ID; legacy IDs are accepted with a warning, as in `map.basemap`; `basemap[]`
 * is a non-empty list of them. `url` is an absolute https URL. `{ oneOf }` is one of a fixed
 * list of strings; `{ integer }` is a whole number in an inclusive range (design D1).
 * `color[]` is a list of 1 to 12 `{ name, color }` entries with unique `#rrggbb` colors,
 * normalized to lowercase (add-print-and-sketch-panels D5).
 */
export type OptionKind =
  | "string"
  | "number"
  | "boolean"
  | "scale"
  | "url"
  | "basemap"
  | "basemap[]"
  | "layer"
  | "layer[]"
  | "layer-info[]"
  | "color[]"
  | { readonly oneOf: readonly string[] }
  | { readonly integer: readonly [number, number] };

/** What validation needs to know about a component type. */
export interface ComponentTypeSchema {
  /** Supported options and their kinds; anything else is warned about and dropped. */
  options: Readonly<Record<string, OptionKind>>;
  /** Values for options the config leaves out, filled in by validation (design D1). */
  defaults?: Readonly<Record<string, unknown>>;
  /** The only placements the type supports; any other fails validation. All when absent (D2). */
  placements?: readonly ComponentPlacement[];
  /**
   * The only views the type works in. In an app whose view the config decides, any other fails
   * validation; in an app opened from an item, the component is left out (add-web-maps-and-scenes
   * D8). Both when absent.
   */
  views?: readonly MapViewKind[];
}

/** A registered component type: a map component, loaded on first use. */
export interface ComponentType extends ComponentTypeSchema {
  /** Custom element tag. */
  tag: string;
  /** Import that defines the element. */
  load: () => Promise<unknown>;
  /** Sidebar heading and Calcite icon when placed in `panel` without its own `panel` settings. */
  panel: { heading: string; icon: string };
  /** The element emits `arcgisError` with a GeolocationPositionError, shown to the user (D3). */
  reportsLocationErrors?: boolean;
  /**
   * The element puts a location marker (its `graphic`) on the map, whose built-in remove action
   * the SDK 5.2 popup component can't carry out; the stage swaps in a working one (D14).
   */
  locationMarker?: boolean;
  /**
   * Applies the validated options to the element, instead of assigning each one as a property.
   * For types whose config options don't map one-to-one to element properties.
   */
  configure?: (element: ConfigurableElement, options: Readonly<Record<string, unknown>>, context: ComponentContext) => void | Promise<void>;
  /**
   * Without an API key: keep the entry (possibly with trimmed options) or leave it out with a
   * reason. Applied before the component stage, so a left-out component sends no request.
   */
  keyless?: (options: Readonly<Record<string, unknown>>) => KeylessResult;
}

/** What a `configure` hook can use. */
export interface ComponentContext {
  /** The map the component works on. */
  map: EsriMap;
  app: AppModel;
  /** The build's API key, or undefined. Only hooks that need it should read it. */
  apiKey: string | undefined;
  /** The validated `geocoding` section: search sources for Search and Directions (D16). */
  geocoding?: GeocodingConfig;
}

/** An element whose properties a `configure` hook sets. */
export type ConfigurableElement = HTMLElement & Record<string, unknown>;

export type KeylessResult = { keep: Record<string, unknown> } | { leaveOut: string };

/** Component types a config can use under `components[].type`. */
export const COMPONENT_TYPES: Readonly<Record<string, ComponentType>> = {
  home: {
    tag: "arcgis-home",
    load: () => import("@arcgis/map-components/components/arcgis-home"),
    // `label` is deliberately absent: arcgis-home 5.2 doesn't use it for the button's name
    // (it stays "Home"), so it would be a setting with no visible effect.
    options: { icon: "string" },
    panel: { heading: "Home", icon: "home" },
  },
  // Zoom-in and zoom-out buttons. A config without a zoom entry shows none; wheel, pinch and
  // keyboard zoom still work (P-02, design D2).
  zoom: {
    tag: "arcgis-zoom",
    load: () => import("@arcgis/map-components/components/arcgis-zoom"),
    options: {},
    panel: { heading: "Zoom", icon: "magnifying-glass-plus" },
  },
  legend: {
    tag: "arcgis-legend",
    load: () => import("@arcgis/map-components/components/arcgis-legend"),
    options: { layerInfos: "layer-info[]", basemapLegendVisible: "boolean", hideLayersNotInCurrentView: "boolean" },
    panel: { heading: "Legend", icon: "legend" },
  },
  // Panel icons are each component's own default icon (design D2).
  locate: {
    tag: "arcgis-locate",
    load: () => import("@arcgis/map-components/components/arcgis-locate"),
    options: { scale: "scale", icon: "string", popupDisabled: "boolean" },
    panel: { heading: "Locate", icon: "gps-off" },
    reportsLocationErrors: true,
    locationMarker: true,
  },
  track: {
    tag: "arcgis-track",
    load: () => import("@arcgis/map-components/components/arcgis-track"),
    options: { scale: "scale", icon: "string", rotationDisabled: "boolean" },
    panel: { heading: "Track", icon: "compass-north-circle" },
    reportsLocationErrors: true,
    locationMarker: true,
  },
  "basemap-toggle": {
    tag: "arcgis-basemap-toggle",
    load: () => import("@arcgis/map-components/components/arcgis-basemap-toggle"),
    options: { nextBasemap: "basemap", showTitle: "boolean" },
    // The built-in imagery hybrid, which needs no key (P-32).
    defaults: { nextBasemap: "hybrid" },
    // Its startup thumbnail load would open a sign-in dialog without a key.
    keyless: (options) =>
      typeof options.nextBasemap === "string" && isBasemapStyleId(options.nextBasemap)
        ? { leaveOut: `the basemap toggle's next basemap "${options.nextBasemap}" needs an API key` }
        : { keep: { ...options } },
    panel: { heading: "Basemap", icon: "layer-basemap" },
  },
  // Addresses and places through a keyless geocoder; the key is never sent to it (P-34, D3).
  search: {
    tag: "arcgis-search",
    load: () => import("@arcgis/map-components/components/arcgis-search"),
    options: { geocoderUrl: "url", maxSuggestions: { integer: [1, 10] }, popupDisabled: "boolean" },
    defaults: { geocoderUrl: DEFAULT_GEOCODER_URL },
    panel: { heading: "Search", icon: "search" },
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
  // Routing through a route service from config; the key goes only to ArcGIS routing (P-35, D4).
  directions: {
    tag: "arcgis-directions",
    load: () => import("@arcgis/map-components/components/arcgis-directions"),
    options: { routeServiceUrl: "url", unit: { oneOf: DIRECTIONS_UNITS } },
    defaults: { routeServiceUrl: DEFAULT_ROUTE_SERVICE_URL, unit: "miles" },
    // dojo-sidebar showed a car; the component's own default, "right", is a plain arrow.
    panel: { heading: "Directions", icon: "car" },
    configure: configureDirections,
    keyless: directionsKeyless,
  },
  // Operational layers with visibility checkboxes (P-36).
  "layer-list": {
    tag: "arcgis-layer-list",
    load: () => import("@arcgis/map-components/components/arcgis-layer-list"),
    options: { visibilityAppearance: { oneOf: ["checkbox", "default"] }, showFilter: "boolean" },
    // The SDK's own default is an eye icon; the viewer's is a checkbox (design D6).
    defaults: { visibilityAppearance: "checkbox" },
    panel: { heading: "Layers", icon: "layers" },
  },
  // Basemap thumbnails to choose from; without a key, only those that need none (P-37, D5).
  "basemap-gallery": {
    tag: "arcgis-basemap-gallery",
    load: () => import("@arcgis/map-components/components/arcgis-basemap-gallery"),
    options: { basemaps: "basemap[]" },
    defaults: { basemaps: [...DEFAULT_GALLERY_BASEMAPS] },
    panel: { heading: "Basemaps", icon: "basemap" },
    configure: configureBasemapGallery,
    keyless: basemapGalleryKeyless,
  },
  // Esri's print component as it ships (P-60, design D1). Without printServiceUrl nothing is
  // set, so the component keeps its own default, the ArcGIS Online print service.
  print: {
    tag: "arcgis-print",
    load: () => import("@arcgis/map-components/components/arcgis-print"),
    options: { printServiceUrl: "url" },
    // arcgis-print reports a sceneViewError in a scene: it prints 2D maps only.
    views: ["2d"],
    panel: { heading: "Print", icon: "print" },
  },
  // Drawing and writing on the map, ported from StewardshipOS (P-61, design D5). Panel only: its
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
  },
  // Custom components live in src/components/custom/ (docs/custom-components.md). This one
  // is the template to copy; it isn't in the default config (P-38, design D7).
  "hello-world": {
    tag: "viewer-hello-world",
    load: () => import("./custom/hello-world/index.ts"),
    options: { greeting: "string" },
    defaults: { greeting: "Hello, world" },
    panel: { heading: "Hello", icon: "code" },
  },
};
