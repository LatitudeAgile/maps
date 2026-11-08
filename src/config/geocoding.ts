import type { ConfigProblem } from "./types.ts";

/** An additional geocoder: a public geocoding service, sent no key. */
export interface GeocoderConfig {
  /** Absolute https URL of the GeocodeServer. */
  url: string;
  /** Its name in the search source menu. */
  name: string;
  placeholder?: string;
}

/** ArcGIS Places search near the map's center. Needs a key with the Places privilege. */
export interface PlacesConfig {
  /** Meters around the map's center, 1 to 10,000. */
  radius: number;
  /** Places category ids to limit results to, at most 10. Empty means any category. */
  categories: string[];
  /** Its name in the search source menu. */
  name: string;
}

/** The `geocoding` section: search sources shared by Search and Directions (design D16). */
export interface GeocodingConfig {
  geocoders: GeocoderConfig[];
  places?: PlacesConfig;
}

export const PLACES_DEFAULTS = { radius: 5000, name: "Places" } as const;
/** The Places API's limits: radius in meters, and category ids per request. */
export const PLACES_MAX_RADIUS = 10_000;
export const PLACES_MAX_CATEGORIES = 10;

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isHttpsUrl = (v: unknown): v is string => {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

const warnUnknown = (raw: Obj, known: string[], at: string, warnings: ConfigProblem[]) => {
  for (const key of Object.keys(raw)) {
    if (!known.includes(key)) warnings.push({ path: `${at}.${key}`, message: "Unknown setting; it is ignored." });
  }
};

/** Validate the `geocoding` section. Problems are appended to `errors` and `warnings`. */
export function validateGeocoding(raw: unknown, errors: ConfigProblem[], warnings: ConfigProblem[]): GeocodingConfig {
  const result: GeocodingConfig = { geocoders: [] };
  if (raw === undefined) return result;
  if (!isObject(raw)) {
    errors.push({ path: "geocoding", message: "Expected an object with geocoders and/or places." });
    return result;
  }
  warnUnknown(raw, ["geocoders", "places"], "geocoding", warnings);

  if (raw.geocoders !== undefined) {
    if (!Array.isArray(raw.geocoders)) {
      errors.push({ path: "geocoding.geocoders", message: "Expected a list of geocoders, each { \"url\", \"name\" }." });
    } else {
      raw.geocoders.forEach((entry: unknown, i) => {
        const at = `geocoding.geocoders[${i}]`;
        if (!isObject(entry)) {
          errors.push({ path: at, message: "Expected an object with url and name." });
          return;
        }
        warnUnknown(entry, ["url", "name", "placeholder"], at, warnings);
        const before = errors.length;
        if (!isHttpsUrl(entry.url)) errors.push({ path: `${at}.url`, message: "Required. Expected an absolute https URL of a GeocodeServer." });
        if (!isNonEmptyString(entry.name)) errors.push({ path: `${at}.name`, message: "Required. Expected a non-empty name, shown in the search source menu." });
        if (entry.placeholder !== undefined && !isNonEmptyString(entry.placeholder)) {
          errors.push({ path: `${at}.placeholder`, message: "Expected a non-empty string." });
        }
        if (errors.length > before) return;
        result.geocoders.push({
          url: entry.url as string,
          name: entry.name as string,
          ...(entry.placeholder !== undefined ? { placeholder: entry.placeholder as string } : {}),
        });
      });
    }
  }

  if (raw.places !== undefined) {
    const places = raw.places;
    if (!isObject(places)) {
      errors.push({ path: "geocoding.places", message: "Expected an object, such as { \"radius\": 5000 }." });
      return result;
    }
    warnUnknown(places, ["radius", "categories", "name"], "geocoding.places", warnings);
    const before = errors.length;
    let radius: number = PLACES_DEFAULTS.radius;
    if (places.radius !== undefined) {
      if (Number.isInteger(places.radius) && (places.radius as number) >= 1 && (places.radius as number) <= PLACES_MAX_RADIUS) radius = places.radius as number;
      else errors.push({ path: "geocoding.places.radius", message: `Expected a whole number from 1 to ${PLACES_MAX_RADIUS} (meters).` });
    }
    let categories: string[] = [];
    if (places.categories !== undefined) {
      if (!Array.isArray(places.categories) || !places.categories.every(isNonEmptyString)) {
        errors.push({ path: "geocoding.places.categories", message: "Expected a list of Places category ids." });
      } else if (places.categories.length > PLACES_MAX_CATEGORIES) {
        errors.push({ path: "geocoding.places.categories", message: `At most ${PLACES_MAX_CATEGORIES} category ids are allowed.` });
      } else {
        categories = [...new Set(places.categories as string[])];
      }
    }
    let name: string = PLACES_DEFAULTS.name;
    if (places.name !== undefined) {
      if (isNonEmptyString(places.name)) name = places.name;
      else errors.push({ path: "geocoding.places.name", message: "Expected a non-empty string." });
    }
    if (errors.length === before) result.places = { radius, categories, name };
  }
  return result;
}
