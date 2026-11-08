import esriConfig from "@arcgis/core/config.js";
import type { Config } from "@arcgis/core/config.js";
import { DEFAULT_GEOCODER_URL, geocoderSource } from "./geocoder.ts";
import type { ComponentContext, ConfigurableElement, KeylessResult } from "./registry.ts";

/** Esri's world route service. It needs a key with the Routing privilege. */
export const DEFAULT_ROUTE_SERVICE_URL = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

/** Units Directions can show distances in: the SDK's length units and measurement systems. */
export const DIRECTIONS_UNITS = [
  "miles",
  "kilometers",
  "meters",
  "feet",
  "yards",
  "nautical-miles",
  "us-feet",
  "inches",
  "millimeters",
  "centimeters",
  "decimeters",
  "metric",
  "imperial",
] as const;

/** ArcGIS routing services, which need a key: route.arcgis.com and route-api.arcgis.com (design D4). */
const ARCGIS_ROUTING_HOST = /(^|\.)route(-api)?\.arcgis\.com$/i;

export function isArcGISRoutingHost(url: string): boolean {
  try {
    return ARCGIS_ROUTING_HOST.test(new URL(url).host);
  } catch {
    return false;
  }
}

/**
 * Scope the key to one route service URL, so it accompanies only requests that start with it
 * (design D4). Adds nothing if that URL is already scoped.
 */
export function addRouteKeyScope(config: Pick<Config, "apiKeys">, token: string, url: string): void {
  const scopes = (config.apiKeys.scopes ??= []);
  const covered = scopes.some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).includes(url));
  if (!covered) scopes.push({ token, urls: [url] });
}

/** Directions: a RouteLayer for the configured service, miles, keyless stop search, no save or print. */
export async function configureDirections(
  element: ConfigurableElement,
  options: Readonly<Record<string, unknown>>,
  { map, apiKey }: ComponentContext,
): Promise<void> {
  const url = options.routeServiceUrl as string;
  // The key goes only to an ArcGIS routing service, never to a route service on another host.
  if (apiKey && isArcGISRoutingHost(url)) addRouteKeyScope(esriConfig, apiKey, url);

  const { default: RouteLayer } = await import("@arcgis/core/layers/RouteLayer.js");
  // Kept out of the layer list: it's the route being edited, not a map layer.
  const layer = new RouteLayer({ url, listMode: "hide" });
  map.add(layer);
  element.layer = layer;
  element.unit = options.unit;
  // Stops are found with the same keyless geocoder as Search (design D3).
  element.searchProperties = { includeDefaultSourcesDisabled: true, sources: [geocoderSource(DEFAULT_GEOCODER_URL)] };
  element.hideSaveButton = true;
  element.hideSaveAsButton = true;
  element.hidePrintButton = true;
}

/** Without a key, a Directions panel on an ArcGIS routing service would fail, so it's left out. */
export function directionsKeyless(options: Readonly<Record<string, unknown>>): KeylessResult {
  const url = options.routeServiceUrl as string;
  return isArcGISRoutingHost(url)
    ? { leaveOut: `Directions' route service ${new URL(url).host} needs an API key` }
    : { keep: { ...options } };
}
