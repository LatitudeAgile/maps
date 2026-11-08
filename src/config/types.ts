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
  };
  portal: {
    /** Absolute https URL of the ArcGIS portal (Online, Enterprise, or Location Platform). */
    url: string;
  };
  map: {
    /** Basemap styles ID (`provider/style`, needs a key) or well-known basemap ID. */
    basemap: string;
    /** Basemap used when `basemap` needs a credential and none is configured. */
    fallbackBasemap: string;
    /** [longitude, latitude] in WGS84 degrees. */
    center: [number, number];
    /**
     * Initial view: exactly one of `zoom` or `scale` is set (design D10).
     * `zoom` is a level of the basemap's tiling scheme, so its scale depends on the basemap;
     * `scale` (a map scale denominator) is basemap-independent.
     */
    zoom?: number;
    scale?: number;
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

/** Supported layer types (map-layers). */
export const LAYER_TYPES = ["feature", "map-image", "vector-tile", "tile", "geojson", "imagery"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

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

/** One validated `components` entry. */
export interface ComponentConfig {
  id: string;
  type: string;
  placement: ComponentPlacement;
  /** Supported options only; unsupported ones were dropped with a warning. */
  options: Record<string, unknown>;
  /** Only on `panel` components. */
  panel?: PanelSettings;
}

/** One validation problem, located by a path such as `map.center[1]`. */
export interface ConfigProblem {
  path: string;
  message: string;
}

/** Defaults for optional settings. Required settings (`map.basemap`, `map.center`, `map.zoom`) have none. */
export const DEFAULTS = {
  app: { title: "ArcGIS Sidebar Viewer", titleVisible: true },
  portal: { url: "https://www.arcgis.com" },
  map: { fallbackBasemap: "osm" },
} as const;

/** Top-level sections the viewer recognizes. */
export const KNOWN_SECTIONS = ["app", "portal", "map", "services", "layers", "components", "geocoding", "debug", "request"] as const;

/** Keys that look like credentials and are never allowed in the config, at any depth. */
export const CREDENTIAL_KEYS = ["apiKey", "token", "clientSecret"] as const;

const credentialKeys = new Set<string>(CREDENTIAL_KEYS.map((k) => k.toLowerCase()));
/** True for a key that names a credential (any letter case). Reported as an error, never as unknown. */
export const isCredentialKey = (key: string): boolean => credentialKeys.has(key.toLowerCase());
