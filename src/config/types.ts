import type { Theme } from "../ui/theme.ts";
import type { GeocodingConfig } from "./geocoding.ts";

/** The viewer's runtime configuration, after defaults are applied. */
export interface ViewerConfig {
  app: {
    /** Browser document title, and the text of the title box (branding). */
    title: string;
    /** Show the title box on the map. Default true. */
    titleVisible: boolean;
    /** Colors for the icon bar and the title box; absent means Calcite's defaults. */
    theme?: Theme;
    /** One line under the app's title in the Apps panel (app-selector). */
    summary?: string;
    /** Plain text for the app's detail page; blank lines separate paragraphs. */
    description?: string;
    /** Calcite icon name for the app's icon tile; the panel uses `map` when absent. */
    icon?: string;
    /** Show the apps list (in the Apps and settings panel) in this app. Default true. */
    selectorVisible: boolean;
    /** Show the Settings section (add-settings D7). Default true. */
    settingsVisible: boolean;
    /** Light or dark mode; `"auto"` (the default) follows the system (branding). */
    mode: ColorMode;
  };
  portal: {
    /** Absolute https URL of the ArcGIS portal (Online, Enterprise, or Location Platform). */
    url: string;
  };
  map: {
    /** A public web map or web scene on `portal.url` (web-maps). Its type decides the view. */
    item?: { id: string };
    /**
     * `"2d"` or `"3d"` for a map built from config; undefined with `item`, whose type decides
     * once it has been read (add-web-maps-and-scenes D8).
     */
    view?: MapViewKind;
    /**
     * Basemap styles ID (`provider/style`, needs a key) or well-known basemap ID. Always set
     * without `item`; with `item`, set only to replace the item's basemap.
     */
    basemap?: string;
    /** Basemap used when the basemap shown needs a credential and none is configured. */
    fallbackBasemap: string;
    /** [longitude, latitude] in WGS84 degrees. Always set without `item`. */
    center?: [number, number];
    /**
     * Initial view: at most one of `zoom` or `scale` is set, and exactly one without `item`
     * (design D10). `zoom` is a level of the basemap's tiling scheme, so its scale depends on
     * the basemap; `scale` (a map scale denominator) is basemap-independent.
     */
    zoom?: number;
    scale?: number;
    /** 3D only: the ground. Defaults to `"world-elevation"` in a config-built scene. */
    ground?: GroundSetting;
    /** 3D only: starting tilt, 0 (straight down) to 90 (the horizon). */
    tilt?: number;
    /** 3D only: starting compass heading, 0 (north up) up to 360. */
    heading?: number;
  };
  /** Named service URLs (absolute https). */
  services: Record<string, string>;
  /** Operational layers, first entry drawn on top (map-layers). */
  layers: LayerConfig[];
  /** Components, created in config order after layers settle (map-components). */
  components: ComponentConfig[];
  /** Search sources shared by Search and Directions (geocoding). */
  geocoding: GeocodingConfig;
  /** Exposes the app model as `window.app` and logs error-channel reports. Default false. */
  debug: boolean;
  /** SDK request settings (proxy). */
  request: RequestConfig;
}

/** One proxy rule: requests whose URL starts with `urlPrefix` go through `proxyUrl`. */
export interface ProxyRule {
  urlPrefix: string;
  /** Absolute https URL, or a path on the viewer's own site (resolved when applied). */
  proxyUrl: string;
}

export interface RequestConfig {
  proxyUrl?: string;
  proxyRules: ProxyRule[];
}

/** `map.view` values (map-scenes). */
export const MAP_VIEWS = ["2d", "3d"] as const;
export type MapViewKind = (typeof MAP_VIEWS)[number];

/** `map.ground` values: Esri's world terrain, or a flat ground (map-scenes). */
export const GROUND_SETTINGS = ["world-elevation", "none"] as const;
export type GroundSetting = (typeof GROUND_SETTINGS)[number];

/** `app.mode` values: `"auto"` follows the system's light or dark mode (branding). */
export const COLOR_MODES = ["auto", "light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

/**
 * Supported layer types and the views each works in (map-layers, map-scenes). The 3D-only
 * types fail validation in a 2D app (add-web-maps-and-scenes D8).
 */
export const LAYER_TYPE_VIEWS = {
  feature: ["2d", "3d"],
  "map-image": ["2d", "3d"],
  "vector-tile": ["2d", "3d"],
  tile: ["2d", "3d"],
  geojson: ["2d", "3d"],
  imagery: ["2d", "3d"],
  scene: ["3d"],
  "building-scene": ["3d"],
  "point-cloud": ["3d"],
  "integrated-mesh": ["3d"],
  elevation: ["3d"],
} as const satisfies Record<string, readonly MapViewKind[]>;
export type LayerType = keyof typeof LAYER_TYPE_VIEWS;
export const LAYER_TYPES = Object.keys(LAYER_TYPE_VIEWS) as readonly LayerType[];

/** True when a layer type works only in a 3D scene. */
export const isLayerType3dOnly = (type: LayerType): boolean => !(LAYER_TYPE_VIEWS[type] as readonly MapViewKind[]).includes("2d");

/** One validated `layers` entry. */
export interface LayerConfig {
  id: string;
  type: LayerType;
  /** Absolute URL (relative GeoJSON URLs are already resolved). Exactly one of url/portalItem. */
  url?: string;
  portalItem?: { id: string };
  title?: string;
  visible?: boolean;
  opacity?: number;
  popupEnabled?: boolean;
  /** `map-image` only: sublayer ids to turn on once loaded, groups above them included. */
  showSublayers?: number[];
  /** `map-image` only: sublayer ids to turn off once loaded. */
  hideSublayers?: number[];
  options: Record<string, unknown>;
  hooks: { preLoad?: string; onLoad?: string };
}

/** Map corners a component can be slotted into. */
export const CORNER_PLACEMENTS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end",
] as const;
export const COMPONENT_PLACEMENTS = [...CORNER_PLACEMENTS, "panel", "none"] as const;
export type ComponentPlacement = (typeof COMPONENT_PLACEMENTS)[number];

/** Sidebar heading and icon for a `panel` component; type defaults fill gaps (sidebar). */
export interface PanelSettings {
  heading?: string;
  icon?: string;
}

/** How an expand opens: next to its button, in a sheet, or the SDK's choice by screen size. */
export const EXPAND_MODES = ["auto", "floating", "drawer"] as const;
export type ExpandMode = (typeof EXPAND_MODES)[number];

/**
 * A corner component's `expand` setting (map-components, P-66). `"expand": true` is `{}`.
 * Gaps are filled at creation from the type's panel icon and heading and the corner (design D3).
 */
export interface ExpandSettings {
  icon?: string;
  tooltip?: string;
  /** Open at startup. */
  expanded?: boolean;
  /** Expands in one group close each other; false is no group. Defaults to the corner. */
  group?: string | false;
  mode?: ExpandMode;
}

/** One validated `components` entry. */
export interface ComponentConfig {
  id: string;
  type: string;
  placement: ComponentPlacement;
  /** Supported options only; unsupported ones were dropped with a warning. */
  options: Record<string, unknown>;
  /** Only on `panel` components. */
  panel?: PanelSettings;
  /** Only on corner components: show a button that opens the component (P-66). */
  expand?: ExpandSettings;
}

/** One validation problem, located by a path such as `map.center[1]`. */
export interface ConfigProblem {
  path: string;
  message: string;
}

/**
 * Defaults for optional settings. Settings required without `map.item` (`map.basemap`,
 * `map.center`, `map.zoom` or `map.scale`) have none.
 */
export const DEFAULTS = {
  app: { title: "ArcGIS Sidebar Viewer", titleVisible: true, selectorVisible: true, settingsVisible: true, mode: "auto" },
  portal: { url: "https://www.arcgis.com" },
  map: { fallbackBasemap: "osm", view: "2d", ground: "world-elevation" },
} as const;

/** Top-level sections the viewer recognizes. */
export const KNOWN_SECTIONS = ["app", "portal", "map", "services", "layers", "components", "geocoding", "debug", "request"] as const;

/** Keys that look like credentials and are never allowed in the config, at any depth. */
export const CREDENTIAL_KEYS = ["apiKey", "token", "clientSecret"] as const;

const credentialKeys = new Set<string>(CREDENTIAL_KEYS.map((k) => k.toLowerCase()));
/** True for a key that names a credential (any letter case). Reported as an error, never as unknown. */
export const isCredentialKey = (key: string): boolean => credentialKeys.has(key.toLowerCase());
