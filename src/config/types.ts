/** The viewer's runtime configuration, after defaults are applied. */
export interface ViewerConfig {
  app: {
    /** Browser document title. */
    title: string;
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
  /** Reserved for port-config-engine; accepted but not acted on. */
  layers: unknown[];
  /** Reserved for port-config-engine; accepted but not acted on. */
  widgets: unknown[];
}

/** One validation problem, located by a path such as `map.center[1]`. */
export interface ConfigProblem {
  path: string;
  message: string;
}

/** Defaults for optional settings. Required settings (`map.basemap`, `map.center`, `map.zoom`) have none. */
export const DEFAULTS = {
  app: { title: "ArcGIS Sidebar Viewer" },
  portal: { url: "https://www.arcgis.com" },
  map: { fallbackBasemap: "osm" },
} as const;

/** Top-level sections the viewer recognizes. */
export const KNOWN_SECTIONS = ["app", "portal", "map", "services", "layers", "widgets"] as const;

/** Keys that look like credentials and are never allowed in the config, at any depth. */
export const CREDENTIAL_KEYS = ["apiKey", "token", "clientSecret"] as const;
