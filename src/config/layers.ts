import { LAYER_TYPES, isCredentialKey, type ConfigProblem, type LayerConfig, type LayerType } from "./types.ts";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Config ids: also used as SDK layer ids and in error paths. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PORTAL_ITEM_ID = /^[0-9a-f]{32}$/i;
const KNOWN_KEYS = ["id", "type", "url", "portalItem", "title", "visible", "opacity", "popupEnabled", "options", "hooks"];
const HOOK_KEYS = ["preLoad", "onLoad"] as const;

export interface LayerValidationContext {
  /** Names of available hooks (design D4). */
  hookNames: string[];
  /** URL of the loaded config file; relative GeoJSON URLs resolve against it. */
  configUrl?: string;
}

function absoluteUrl(v: string): URL | undefined {
  try {
    return new URL(v);
  } catch {
    return undefined;
  }
}

/** Validate the `layers` section. Problems are appended to `errors` and `warnings`. */
export function validateLayers(
  raw: unknown,
  context: LayerValidationContext,
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): LayerConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ path: "layers", message: "Expected an array of layer entries." });
    return [];
  }

  const result: LayerConfig[] = [];
  const seen = new Map<string, number>();

  raw.forEach((entry: unknown, i) => {
    const at = `layers[${i}]`;
    if (!isObject(entry)) {
      errors.push({ path: at, message: "Expected a layer entry object." });
      return;
    }
    const before = errors.length;

    for (const key of Object.keys(entry)) {
      if (!KNOWN_KEYS.includes(key) && !isCredentialKey(key)) warnings.push({ path: `${at}.${key}`, message: "Unknown setting; it is ignored." });
    }

    // id
    const id = entry.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      errors.push({ path: `${at}.id`, message: "Required. Expected 1 to 64 letters, digits, hyphens, or underscores." });
    } else if (seen.has(id)) {
      errors.push({ path: `${at}.id`, message: `IDs must be unique; "${id}" is also used by layers[${seen.get(id)}].` });
    } else {
      seen.set(id, i);
    }

    // type
    const type = entry.type;
    if (typeof type !== "string" || !(LAYER_TYPES as readonly string[]).includes(type)) {
      errors.push({ path: `${at}.type`, message: `Expected one of: ${LAYER_TYPES.join(", ")}.` });
    }

    // source: exactly one of url or portalItem
    let url: string | undefined;
    let portalItem: { id: string } | undefined;
    const hasUrl = entry.url !== undefined;
    const hasItem = entry.portalItem !== undefined;
    if (hasUrl === hasItem) {
      errors.push({ path: at, message: "Set exactly one of url or portalItem." });
    } else if (hasUrl) {
      url = validateUrl(entry.url, type === "geojson", `${at}.url`, context.configUrl, errors);
    } else {
      const item = entry.portalItem;
      if (isObject(item) && typeof item.id === "string" && PORTAL_ITEM_ID.test(item.id)) portalItem = { id: item.id };
      else errors.push({ path: `${at}.portalItem.id`, message: "Expected a 32-character portal item ID." });
    }

    // optional properties
    if (entry.title !== undefined && (typeof entry.title !== "string" || entry.title.trim() === "")) {
      errors.push({ path: `${at}.title`, message: "Expected a non-empty string." });
    }
    for (const key of ["visible", "popupEnabled"] as const) {
      if (entry[key] !== undefined && typeof entry[key] !== "boolean") {
        errors.push({ path: `${at}.${key}`, message: "Expected true or false." });
      }
    }
    if (entry.opacity !== undefined) {
      const o = entry.opacity;
      if (typeof o !== "number" || !Number.isFinite(o) || o < 0 || o > 1) {
        errors.push({ path: `${at}.opacity`, message: "Expected a number between 0 and 1." });
      }
    }
    if (entry.options !== undefined && !isObject(entry.options)) {
      errors.push({ path: `${at}.options`, message: "Expected an object of layer properties." });
    }

    // hooks
    const hooks: LayerConfig["hooks"] = {};
    if (entry.hooks !== undefined) {
      if (!isObject(entry.hooks)) {
        errors.push({ path: `${at}.hooks`, message: "Expected an object, such as { \"onLoad\": \"hookName\" }." });
      } else {
        for (const [key, name] of Object.entries(entry.hooks)) {
          const path = `${at}.hooks.${key}`;
          if (!(HOOK_KEYS as readonly string[]).includes(key)) {
            warnings.push({ path, message: "Unknown hook; expected preLoad or onLoad. It is ignored." });
          } else if (typeof name !== "string" || !context.hookNames.includes(name)) {
            const available = context.hookNames.length ? context.hookNames.join(", ") : "none (see docs/extensions.md)";
            errors.push({ path, message: `Expected the name of an available hook. Available: ${available}.` });
          } else {
            hooks[key as (typeof HOOK_KEYS)[number]] = name;
          }
        }
      }
    }

    if (errors.length > before) return;
    result.push({
      id: id as string,
      type: type as LayerType,
      ...(url !== undefined ? { url } : {}),
      ...(portalItem ? { portalItem } : {}),
      ...(entry.title !== undefined ? { title: entry.title as string } : {}),
      ...(entry.visible !== undefined ? { visible: entry.visible as boolean } : {}),
      ...(entry.opacity !== undefined ? { opacity: entry.opacity as number } : {}),
      ...(entry.popupEnabled !== undefined ? { popupEnabled: entry.popupEnabled as boolean } : {}),
      options: (entry.options as Obj | undefined) ?? {},
      hooks,
    });
  });

  return result;
}

/**
 * Layer URLs must be absolute https. A GeoJSON URL may also be a path, resolved against the
 * config file's URL (so data can sit next to the config).
 */
function validateUrl(
  value: unknown,
  allowRelative: boolean,
  path: string,
  configUrl: string | undefined,
  errors: ConfigProblem[],
): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({ path, message: "Expected a URL." });
    return undefined;
  }
  const absolute = absoluteUrl(value);
  if (absolute) {
    if (absolute.protocol === "https:") return value;
  } else if (allowRelative && !value.startsWith("//") && !value.startsWith("\\")) {
    return configUrl ? new URL(value, configUrl).href : value;
  }
  errors.push({
    path,
    message: allowRelative
      ? "Expected an absolute https URL or a path relative to the config file."
      : "Expected an absolute https URL.",
  });
  return undefined;
}
