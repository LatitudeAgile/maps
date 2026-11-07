import { LEGACY_BASEMAP_IDS, isBasemapStyleId } from "../map/basemapIds.ts";
import { hooks } from "../extensions/hooks.ts";
import { validateLayers } from "./layers.ts";
import { validateRequest } from "./request.ts";
import { validateComponents } from "./components.ts";
import { COMPONENT_TYPES, type ComponentTypeSchema } from "../components/registry.ts";
import {
  isCredentialKey,
  DEFAULTS,
  KNOWN_SECTIONS,
  type ConfigProblem,
  type ViewerConfig,
} from "./types.ts";

export interface ValidationResult {
  /** The config with defaults applied; undefined when there are errors. */
  config: ViewerConfig | undefined;
  errors: ConfigProblem[];
  warnings: ConfigProblem[];
}

/** What validation needs to know beyond the config itself. */
export interface ValidationContext {
  /** URL of the loaded config file; relative GeoJSON URLs resolve against it. */
  configUrl?: string;
  /** Available layer hook names; defaults to the built-in hook registry. */
  hookNames?: string[];
  /** Registered component types; defaults to the built-in component registry. */
  componentTypes?: Readonly<Record<string, ComponentTypeSchema>>;
}

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}


const CREDENTIAL_MESSAGE =
  "Credentials must not be stored in the config. Supply the API key through the build environment (VITE_ARCGIS_API_KEY in .env.local) instead.";

/** Find credential-like keys at any depth. Reports paths only, never values. */
function findCredentials(value: unknown, path: string, out: ConfigProblem[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findCredentials(item, `${path}[${i}]`, out));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isCredentialKey(key)) out.push({ path: childPath, message: CREDENTIAL_MESSAGE });
    else findCredentials(child, childPath, out);
  }
}

/** Read an optional object section; report a type error if present but not an object. */
function section(raw: Obj, name: string, errors: ConfigProblem[]): Obj {
  const value = raw[name];
  if (value === undefined) return {};
  if (!isObject(value)) {
    errors.push({ path: name, message: "Expected an object." });
    return {};
  }
  return value;
}

/**
 * Validate a parsed config and apply defaults. Every problem is collected, so a deployer
 * sees all of them at once. Messages name what was expected and never echo values.
 */
export function validateConfig(raw: unknown, context: ValidationContext = {}): ValidationResult {
  const errors: ConfigProblem[] = [];
  const warnings: ConfigProblem[] = [];

  if (!isObject(raw)) {
    errors.push({ path: "(root)", message: "Expected the config to be a JSON object." });
    return { config: undefined, errors, warnings };
  }

  findCredentials(raw, "", errors);

  for (const key of Object.keys(raw)) {
    if (!(KNOWN_SECTIONS as readonly string[]).includes(key) && !isCredentialKey(key)) {
      warnings.push({ path: key, message: "Unknown setting; it is ignored." });
    }
  }

  // app
  const app = section(raw, "app", errors);
  let title: string = DEFAULTS.app.title;
  if (app.title !== undefined) {
    if (isNonEmptyString(app.title)) title = app.title;
    else errors.push({ path: "app.title", message: "Expected a non-empty string." });
  }

  // portal
  const portal = section(raw, "portal", errors);
  let portalUrl: string = DEFAULTS.portal.url;
  if (portal.url !== undefined) {
    if (isHttpsUrl(portal.url)) portalUrl = portal.url.replace(/\/+$/, "");
    else errors.push({ path: "portal.url", message: "Expected an absolute https URL." });
  }

  // map (required)
  if (raw.map === undefined) {
    errors.push({ path: "map", message: "Required. Expected an object with basemap, center, and zoom or scale." });
  }
  const map = section(raw, "map", errors);
  const mapPresent = isObject(raw.map);

  let basemap = "";
  if (mapPresent) {
    if (isNonEmptyString(map.basemap)) {
      basemap = map.basemap.trim();
      const modern = LEGACY_BASEMAP_IDS[basemap];
      if (modern) {
        warnings.push({
          path: "map.basemap",
          message: `"${basemap}" is a legacy basemap ID. Use the basemap styles ID "${modern}" instead.`,
        });
      }
    } else {
      errors.push({
        path: "map.basemap",
        message: 'Expected a non-empty basemap ID, such as "arcgis/streets" or "osm".',
      });
    }
  }

  let fallbackBasemap: string = DEFAULTS.map.fallbackBasemap;
  if (map.fallbackBasemap !== undefined) {
    if (!isNonEmptyString(map.fallbackBasemap)) {
      errors.push({ path: "map.fallbackBasemap", message: "Expected a non-empty basemap ID." });
    } else if (isBasemapStyleId(map.fallbackBasemap.trim())) {
      errors.push({
        path: "map.fallbackBasemap",
        message: 'Expected a basemap that needs no API key, such as "osm" (not a provider/style ID).',
      });
    } else {
      fallbackBasemap = map.fallbackBasemap.trim();
    }
  }

  let center: [number, number] = [0, 0];
  if (mapPresent) {
    const c: unknown = map.center;
    if (!Array.isArray(c) || c.length !== 2) {
      errors.push({ path: "map.center", message: "Expected [longitude, latitude]: an array of two numbers." });
    } else {
      const [lon, lat] = c as [unknown, unknown];
      if (!isFiniteNumber(lon) || lon < -180 || lon > 180) {
        errors.push({ path: "map.center[0]", message: "Expected a longitude between -180 and 180." });
      }
      if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
        errors.push({ path: "map.center[1]", message: "Expected a latitude between -90 and 90." });
      }
      center = [lon as number, lat as number];
    }
  }

  // Initial view: exactly one of zoom or scale (design D10).
  let view: { zoom: number } | { scale: number } | undefined;
  if (mapPresent) {
    const hasZoom = map.zoom !== undefined;
    const hasScale = map.scale !== undefined;
    if (hasZoom && hasScale) {
      errors.push({ path: "map", message: "Set either map.zoom or map.scale, not both." });
    } else if (!hasZoom && !hasScale) {
      errors.push({ path: "map", message: "Required: map.zoom or map.scale." });
    } else if (hasZoom) {
      if (isFiniteNumber(map.zoom) && map.zoom >= 0) view = { zoom: map.zoom };
      else errors.push({ path: "map.zoom", message: "Expected a number 0 or greater." });
    } else if (isFiniteNumber(map.scale) && map.scale > 0) {
      view = { scale: map.scale };
    } else {
      errors.push({ path: "map.scale", message: "Expected a number greater than 0." });
    }
  }

  // services: named https URLs
  const servicesRaw = section(raw, "services", errors);
  const services: Record<string, string> = {};
  for (const [name, url] of Object.entries(servicesRaw)) {
    if (isCredentialKey(name)) continue; // already reported as a credential
    if (isHttpsUrl(url)) services[name] = url;
    else errors.push({ path: `services.${name}`, message: "Expected an absolute https URL." });
  }

  const layers = validateLayers(
    raw.layers,
    { hookNames: context.hookNames ?? Object.keys(hooks), configUrl: context.configUrl },
    errors,
    warnings,
  );

  const components = validateComponents(
    raw.components,
    { types: context.componentTypes ?? COMPONENT_TYPES, layerIds: layers.map((l) => l.id) },
    errors,
    warnings,
  );

  // debug: boolean, default false
  let debug = false;
  if (raw.debug !== undefined) {
    if (typeof raw.debug === "boolean") debug = raw.debug;
    else errors.push({ path: "debug", message: "Expected true or false." });
  }

  const request = validateRequest(raw.request, errors, warnings);

  if (errors.length > 0 || !view) return { config: undefined, errors, warnings };

  return {
    config: {
      app: { title },
      portal: { url: portalUrl },
      map: { basemap, fallbackBasemap, center, ...view },
      services,
      layers,
      components,
      debug,
      request,
    },
    errors,
    warnings,
  };
}
