import type { GeocodingConfig } from "../config/geocoding.ts";
import { geocoderSource } from "./geocoder.ts";

/**
 * The search sources Search and Directions share (geocoding spec, design D16), in order: the
 * keyless world geocoder, each additional geocoder from config, then Places when it is
 * configured and a key is available. Geocoders are plain locator sources with no key; Places
 * is loaded only when used.
 */
export async function buildSearchSources(
  primaryUrl: string,
  geocoding: GeocodingConfig | undefined,
  apiKey: string | undefined,
  loadPlaces: () => Promise<typeof import("./placesSource.ts")> = () => import("./placesSource.ts"),
): Promise<unknown[]> {
  const sources: unknown[] = [geocoderSource(primaryUrl)];
  for (const g of geocoding?.geocoders ?? []) sources.push(geocoderSource(g.url, g.name, g.placeholder));
  // Without a key, startup has already left Places out and warned (D16).
  if (geocoding?.places && apiKey) {
    const { createPlacesSource } = await loadPlaces();
    sources.push(createPlacesSource(geocoding.places, apiKey));
  }
  return sources;
}
