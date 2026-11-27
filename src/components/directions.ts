import esriConfig from "@arcgis/core/config.js";
import type { Config } from "@arcgis/core/config.js";
import { DEFAULT_GEOCODER_URL, geocoderSource } from "./geocoder.ts";
import { buildSearchSources } from "./searchSources.ts";
import type { ComponentContext, ConfigurableElement, KeylessResult } from "./registry.ts";
import type Point from "@arcgis/core/geometry/Point.js";
import type RouteLayer from "@arcgis/core/layers/RouteLayer.js";
import type Stop from "@arcgis/core/rest/support/Stop.js";
import { addMapMenuItems, type MapMenuContext, type MapMenuItem } from "../map/menu/registry.ts";
import { requestPanelOpen } from "../sidebar/panelEvents.ts";

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
  { map, apiKey, geocoding }: ComponentContext,
): Promise<void> {
  const url = options.routeServiceUrl as string;
  // The key goes only to an ArcGIS routing service, never to a route service on another host.
  if (apiKey && isArcGISRoutingHost(url)) addRouteKeyScope(esriConfig, apiKey, url);

  const [{ default: RouteLayer }, { default: StopClass }] = await Promise.all([
    import("@arcgis/core/layers/RouteLayer.js"),
    import("@arcgis/core/rest/support/Stop.js"),
  ]);
  // Kept out of the layer list: it's the route being edited, not a map layer.
  const layer = new RouteLayer({ url, listMode: "hide" });
  map.add(layer);
  element.layer = layer;
  element.unit = options.unit;
  // Stops are found with the same sources as Search (design D3, D16).
  element.searchProperties = directionsSearchProperties(await buildSearchSources(DEFAULT_GEOCODER_URL, geocoding, apiKey));
  element.hideSaveButton = true;
  element.hideSaveAsButton = true;
  element.hidePrintButton = true;
  // From here, To here and Add stop here in the map menu (map-menu; add-map-menu D8).
  addMapMenuItems(element, directionsMenuItems(element as unknown as DirectionsElement, layer, (point, name) => new StopClass({ geometry: point, name })));
}

/** The parts of arcgis-directions the map menu items use. */
type DirectionsElement = HTMLElement & { getDirections(): Promise<unknown> };

/** A stop's name: the spot to five decimal places, latitude first. */
const stopName = ({ latitude, longitude }: MapMenuContext) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

/**
 * The Directions items (add-map-menu D8). Each opens the panel and sets a stop; once the route
 * has a start and an end, it's solved through the component, which then lists the directions.
 * The component doesn't solve stops set from code by itself (checked in the browser).
 */
export function directionsMenuItems(element: DirectionsElement, layer: RouteLayer, makeStop: (point: Point, name: string) => Stop): MapMenuItem[] {
  const stops = layer.stops;
  const hasRoute = () => stops.length >= 2 && !!stops.at(0)?.geometry && !!stops.at(-1)?.geometry;
  const setStop = async (context: MapMenuContext, change: (stop: Stop) => void) => {
    requestPanelOpen(element);
    change(makeStop(context.mapPoint, stopName(context)));
    if (hasRoute()) await element.getDirections();
  };
  return [
    {
      id: "from-here",
      label: "Directions from here",
      icon: "beginning",
      // The first stop, replaced if there is one.
      run: (context) =>
        setStop(context, (stop) => {
          if (stops.length > 0) stops.removeAt(0);
          stops.add(stop, 0);
        }),
    },
    {
      id: "to-here",
      label: "Directions to here",
      icon: "end",
      // The last stop, replaced; with only a start, a new last stop.
      run: (context) =>
        setStop(context, (stop) => {
          if (stops.length >= 2) stops.removeAt(stops.length - 1);
          stops.add(stop);
        }),
    },
    {
      id: "add-stop",
      label: "Add stop here",
      icon: "add-in-new",
      // Only on a route: a stop before the last.
      appliesTo: hasRoute,
      run: (context) => setStop(context, (stop) => stops.add(stop, stops.length - 1)),
    },
  ];
}

/**
 * Directions' stop search: only the keyless geocoder (design D3). `searchProperties` takes the
 * core Search properties, where the switch is `includeDefaultSources: false`; the Search
 * component's `includeDefaultSourcesDisabled` means nothing here, and with it the portal's
 * default World geocoder (geocode-api.arcgis.com, which needs a key) was listed as a second
 * source. Setting `searchProperties` replaces Directions' defaults, so those are restated.
 */
export function directionsSearchProperties(sources: unknown[] = [geocoderSource(DEFAULT_GEOCODER_URL)]): {
  includeDefaultSources: false;
  popupEnabled: false;
  resultGraphicEnabled: false;
  searchAllEnabled: true;
  sources: unknown[];
} {
  return {
    includeDefaultSources: false,
    popupEnabled: false,
    resultGraphicEnabled: false,
    // With more than one source, a search covers all of them (D16).
    searchAllEnabled: true,
    sources,
  };
}

/** Without a key, a Directions panel on an ArcGIS routing service would fail, so it's left out. */
export function directionsKeyless(options: Readonly<Record<string, unknown>>): KeylessResult {
  const url = options.routeServiceUrl as string;
  return isArcGISRoutingHost(url)
    ? { leaveOut: `Directions' route service ${new URL(url).host} needs an API key` }
    : { keep: { ...options } };
}
