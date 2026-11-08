/**
 * Esri's public World Geocoding Service. It answers suggestions and searches without a key
 * (probed 2026-11-06), unlike geocode-api.arcgis.com, the SDK's default, which needs one.
 */
export const DEFAULT_GEOCODER_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

/**
 * A Search source for a geocoding service, as a plain object (design D3). `sources` autocasts it
 * to a locator source, so no `@arcgis/core/widgets/` import is needed. No API key is set on it.
 */
export function geocoderSource(url: string, name = "ArcGIS World Geocoding Service", placeholder = "Find address or place"): Record<string, unknown> {
  return { url, name, placeholder, singleLineFieldName: "SingleLine" };
}
