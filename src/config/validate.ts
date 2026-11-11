import { hooks } from "../extensions/hooks.ts";
import { validateLayers } from "./layers.ts";
import { validateMap } from "./map.ts";
import { validateRequest } from "./request.ts";
import { validateComponents } from "./components.ts";
import { validateTheme } from "./theme.ts";
import { validateGeocoding } from "./geocoding.ts";
import { COMPONENT_TYPES, type ComponentTypeSchema } from "../components/registry.ts";
import {
  isCredentialKey,
  COLOR_MODES,
  DEFAULTS,
  KNOWN_SECTIONS,
  type ColorMode,
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
  let titleVisible: boolean = DEFAULTS.app.titleVisible;
  if (app.titleVisible !== undefined) {
    if (typeof app.titleVisible === "boolean") titleVisible = app.titleVisible;
    else errors.push({ path: "app.titleVisible", message: "Expected true or false." });
  }
  const theme = validateTheme(app.theme, errors, warnings);
  // App listing settings (add-app-selector D10).
  let summary: string | undefined;
  if (app.summary !== undefined) {
    if (isNonEmptyString(app.summary)) summary = app.summary;
    else errors.push({ path: "app.summary", message: "Expected a non-empty string." });
  }
  let description: string | undefined;
  if (app.description !== undefined) {
    if (typeof app.description === "string") description = app.description;
    else errors.push({ path: "app.description", message: "Expected a string." });
  }
  let icon: string | undefined;
  if (app.icon !== undefined) {
    if (isNonEmptyString(app.icon)) icon = app.icon;
    else errors.push({ path: "app.icon", message: "Expected a non-empty string: a Calcite icon name." });
  }
  let selectorVisible: boolean = DEFAULTS.app.selectorVisible;
  if (app.selectorVisible !== undefined) {
    if (typeof app.selectorVisible === "boolean") selectorVisible = app.selectorVisible;
    else errors.push({ path: "app.selectorVisible", message: "Expected true or false." });
  }
  let settingsVisible: boolean = DEFAULTS.app.settingsVisible;
  if (app.settingsVisible !== undefined) {
    if (typeof app.settingsVisible === "boolean") settingsVisible = app.settingsVisible;
    else errors.push({ path: "app.settingsVisible", message: "Expected true or false." });
  }
  // Light or dark mode (add-color-mode D3).
  let mode: ColorMode = DEFAULTS.app.mode;
  if (app.mode !== undefined) {
    if ((COLOR_MODES as readonly unknown[]).includes(app.mode)) mode = app.mode as ColorMode;
    else errors.push({ path: "app.mode", message: 'Expected "auto", "light" or "dark".' });
  }

  // portal
  const portal = section(raw, "portal", errors);
  let portalUrl: string = DEFAULTS.portal.url;
  if (portal.url !== undefined) {
    if (isHttpsUrl(portal.url)) portalUrl = portal.url.replace(/\/+$/, "");
    else errors.push({ path: "portal.url", message: "Expected an absolute https URL." });
  }

  // map (required): basemap and starting view, or an item (viewer-config, web-maps, map-scenes)
  const { map, view } = validateMap(raw.map, errors, warnings);

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
    { hookNames: context.hookNames ?? Object.keys(hooks), configUrl: context.configUrl, view },
    errors,
    warnings,
  );

  const components = validateComponents(
    raw.components,
    { types: context.componentTypes ?? COMPONENT_TYPES, layerIds: layers.map((l) => l.id), view },
    errors,
    warnings,
  );

  // debug: boolean, default false
  let debug = false;
  if (raw.debug !== undefined) {
    if (typeof raw.debug === "boolean") debug = raw.debug;
    else errors.push({ path: "debug", message: "Expected true or false." });
  }

  const geocoding = validateGeocoding(raw.geocoding, errors, warnings);
  const request = validateRequest(raw.request, errors, warnings);

  if (errors.length > 0 || !map) return { config: undefined, errors, warnings };

  return {
    config: {
      app: {
        title,
        titleVisible,
        selectorVisible,
        settingsVisible,
        mode,
        ...(theme ? { theme } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
      },
      portal: { url: portalUrl },
      map,
      services,
      layers,
      components,
      geocoding,
      debug,
      request,
    },
    errors,
    warnings,
  };
}
