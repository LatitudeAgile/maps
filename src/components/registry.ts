import type EsriMap from "@arcgis/core/Map.js";
import type { AppModel } from "../app/AppModel.ts";
import { isBasemapStyleId } from "../map/basemapIds.ts";
import { DEFAULT_GEOCODER_URL, geocoderSource } from "./geocoder.ts";
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
  | { readonly oneOf: readonly string[] }
  | { readonly integer: readonly [number, number] };

/** What validation needs to know about a component type. */
export interface ComponentTypeSchema {
  /** Supported options and their kinds; anything else is warned about and dropped. */
  options: Readonly<Record<string, OptionKind>>;
  /** Values for options the config leaves out, filled in by validation (design D1). */
  defaults?: Readonly<Record<string, unknown>>;
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
  },
  track: {
    tag: "arcgis-track",
    load: () => import("@arcgis/map-components/components/arcgis-track"),
    options: { scale: "scale", icon: "string", rotationDisabled: "boolean" },
    panel: { heading: "Track", icon: "compass-north-circle" },
    reportsLocationErrors: true,
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
    configure: (element, options) => {
      // Never fall back to the portal's default source, which needs a key.
      element.includeDefaultSourcesDisabled = true;
      element.sources = [geocoderSource(options.geocoderUrl as string)];
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
