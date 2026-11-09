import type { OptionKind, ComponentTypeSchema } from "../components/registry.ts";
import { LEGACY_BASEMAP_IDS } from "../map/basemapIds.ts";
import { ID_PATTERN } from "./layers.ts";
import {
  COMPONENT_PLACEMENTS,
  isCredentialKey,
  type ComponentConfig,
  type ComponentPlacement,
  type ConfigProblem,
  type PanelSettings,
} from "./types.ts";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN_KEYS = ["id", "type", "placement", "options", "panel"];

/** Placement used when an entry doesn't set one. */
export const DEFAULT_PLACEMENT: ComponentPlacement = "panel";

export interface ComponentValidationContext {
  /** Registered component types and their supported options. */
  types: Readonly<Record<string, ComponentTypeSchema>>;
  /** Ids of the configured layers, for layer-reference options. */
  layerIds: string[];
}

/** Validate the `components` section. Problems are appended to `errors` and `warnings`. */
export function validateComponents(
  raw: unknown,
  context: ComponentValidationContext,
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): ComponentConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ path: "components", message: "Expected an array of component entries." });
    return [];
  }

  const typeNames = Object.keys(context.types);
  const result: ComponentConfig[] = [];
  const seen = new Map<string, number>();

  raw.forEach((entry: unknown, i) => {
    const at = `components[${i}]`;
    if (!isObject(entry)) {
      errors.push({ path: at, message: "Expected a component entry object." });
      return;
    }
    const before = errors.length;

    for (const key of Object.keys(entry)) {
      if (!KNOWN_KEYS.includes(key) && !isCredentialKey(key)) warnings.push({ path: `${at}.${key}`, message: "Unknown setting; it is ignored." });
    }

    const id = entry.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      errors.push({ path: `${at}.id`, message: "Required. Expected 1 to 64 letters, digits, hyphens, or underscores." });
    } else if (seen.has(id)) {
      errors.push({ path: `${at}.id`, message: `IDs must be unique; "${id}" is also used by components[${seen.get(id)}].` });
    } else {
      seen.set(id, i);
    }

    const type = entry.type;
    const schema = typeof type === "string" && Object.hasOwn(context.types, type) ? context.types[type] : undefined;
    if (!schema) errors.push({ path: `${at}.type`, message: `Expected one of: ${typeNames.join(", ")}.` });

    // Omitted placement means a sidebar panel, as `tab` did in dojo-sidebar (P-14).
    const placement = entry.placement ?? DEFAULT_PLACEMENT;
    if (typeof placement !== "string" || !(COMPONENT_PLACEMENTS as readonly string[]).includes(placement)) {
      errors.push({ path: `${at}.placement`, message: `Expected one of: ${COMPONENT_PLACEMENTS.join(", ")}.` });
    } else if (schema?.placements && !schema.placements.includes(placement as ComponentPlacement)) {
      // A type limited to some placements, such as the panel-only sketch (D2). Checked after
      // defaulting, so an omitted placement counts as `panel`.
      errors.push({ path: `${at}.placement`, message: `The "${type}" component supports only: ${schema.placements.join(", ")}.` });
    }

    const options: Obj = {};
    if (entry.options !== undefined && !isObject(entry.options)) {
      errors.push({ path: `${at}.options`, message: "Expected an object." });
    } else if (isObject(entry.options) && schema) {
      for (const [name, value] of Object.entries(entry.options)) {
        const path = `${at}.options.${name}`;
        if (isCredentialKey(name)) continue; // already reported as a credential
        const kind = Object.hasOwn(schema.options, name) ? schema.options[name] : undefined;
        if (!kind) {
          warnings.push({ path, message: `Not supported by the "${type}" component; it is ignored.` });
          continue;
        }
        if (checkOption(kind, value, path, context.layerIds, errors, warnings)) options[name] = kind === "color[]" ? normalizeColors(value) : value;
      }
    }
    // Fill options the entry leaves out from the type's defaults (design D1).
    if (schema?.defaults) {
      for (const [name, value] of Object.entries(schema.defaults)) {
        if (!Object.hasOwn(options, name)) options[name] = value;
      }
    }

    const panel = validatePanel(entry.panel, placement === "panel", `${at}.panel`, errors, warnings);

    if (errors.length > before) return;
    result.push({
      id: id as string,
      type: type as string,
      placement: placement as ComponentPlacement,
      options,
      ...(panel ? { panel } : {}),
    });
  });

  return result;
}

/**
 * A component's `panel` setting: sidebar heading and icon (sidebar, P-21). Only meaningful
 * for `panel` placement; elsewhere it is ignored with one warning.
 */
function validatePanel(
  raw: unknown,
  isPanel: boolean,
  path: string,
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): PanelSettings | undefined {
  if (raw === undefined) return undefined;
  if (!isPanel) {
    warnings.push({ path, message: 'Only used when placement is "panel"; it is ignored.' });
    return undefined;
  }
  if (!isObject(raw)) {
    errors.push({ path, message: "Expected an object, such as { \"heading\": \"Legend\", \"icon\": \"legend\" }." });
    return undefined;
  }
  const panel: PanelSettings = {};
  for (const key of Object.keys(raw)) {
    if (key !== "heading" && key !== "icon") warnings.push({ path: `${path}.${key}`, message: "Unknown setting; it is ignored." });
  }
  if (raw.heading !== undefined) {
    if (typeof raw.heading === "string" && raw.heading.trim() !== "") panel.heading = raw.heading;
    else errors.push({ path: `${path}.heading`, message: "Expected a non-empty string." });
  }
  if (raw.icon !== undefined) {
    if (typeof raw.icon === "string" && raw.icon.trim() !== "") panel.icon = raw.icon;
    else errors.push({ path: `${path}.icon`, message: "Expected a Calcite icon name, such as \"legend\"." });
  }
  return panel;
}

/** Check one option value against its kind. Returns true when it is valid. */
function checkOption(
  kind: OptionKind,
  value: unknown,
  path: string,
  layerIds: string[],
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): boolean {
  const unknownLayer = (id: unknown) => `"${String(id)}" is not a configured layer. Use an id from layers.`;
  if (typeof kind === "object") {
    if ("oneOf" in kind) {
      if (typeof value === "string" && kind.oneOf.includes(value)) return true;
      errors.push({ path, message: `Expected one of: ${kind.oneOf.join(", ")}.` });
      return false;
    }
    const [min, max] = kind.integer;
    if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) return true;
    errors.push({ path, message: `Expected a whole number from ${min} to ${max}.` });
    return false;
  }
  switch (kind) {
    case "string":
      if (typeof value === "string") return true;
      errors.push({ path, message: "Expected a string." });
      return false;
    case "number":
      if (typeof value === "number" && Number.isFinite(value)) return true;
      errors.push({ path, message: "Expected a number." });
      return false;
    case "scale":
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return true;
      errors.push({ path, message: "Expected a number greater than 0." });
      return false;
    case "url":
      if (isHttpsUrl(value)) return true;
      errors.push({ path, message: "Expected an https URL, such as https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer." });
      return false;
    case "basemap":
      return checkBasemapId(value, path, errors, warnings);
    case "basemap[]": {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push({ path, message: 'Expected a list of at least one basemap ID, such as ["osm", "hybrid"].' });
        return false;
      }
      let ok = true;
      value.forEach((id, j) => {
        if (!checkBasemapId(id, `${path}[${j}]`, errors, warnings)) ok = false;
      });
      return ok;
    }
    case "boolean":
      if (typeof value === "boolean") return true;
      errors.push({ path, message: "Expected true or false." });
      return false;
    case "layer":
      if (typeof value === "string" && layerIds.includes(value)) return true;
      errors.push({ path, message: unknownLayer(value) });
      return false;
    case "layer[]": {
      if (!Array.isArray(value)) {
        errors.push({ path, message: "Expected an array of layer ids." });
        return false;
      }
      let ok = true;
      value.forEach((id, j) => {
        if (typeof id !== "string" || !layerIds.includes(id)) {
          errors.push({ path: `${path}[${j}]`, message: unknownLayer(id) });
          ok = false;
        }
      });
      return ok;
    }
    case "color[]":
      return checkColors(value, path, errors);
    case "layer-info[]": {
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'Expected an array of { "layer": <layer id>, "title": <text> } entries.' });
        return false;
      }
      let ok = true;
      value.forEach((item: unknown, j) => {
        const at = `${path}[${j}]`;
        if (!isObject(item)) {
          errors.push({ path: at, message: 'Expected { "layer": <layer id>, "title": <text> }.' });
          ok = false;
          return;
        }
        if (typeof item.layer !== "string" || !layerIds.includes(item.layer)) {
          errors.push({ path: `${at}.layer`, message: unknownLayer(item.layer) });
          ok = false;
        }
        if (item.title !== undefined && typeof item.title !== "string") {
          errors.push({ path: `${at}.title`, message: "Expected a string." });
          ok = false;
        }
      });
      return ok;
    }
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_COLORS = 12;

/** A `color[]` option: 1 to 12 `{ name, color }` entries with unique `#rrggbb` colors. */
function checkColors(value: unknown, path: string, errors: ConfigProblem[]): boolean {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COLORS) {
    errors.push({ path, message: `Expected a list of 1 to ${MAX_COLORS} colors, such as [{ "name": "Red", "color": "#d7263d" }].` });
    return false;
  }
  let ok = true;
  const seen = new Map<string, number>();
  value.forEach((item: unknown, j) => {
    const at = `${path}[${j}]`;
    if (!isObject(item)) {
      errors.push({ path: at, message: 'Expected { "name": <text>, "color": "#rrggbb" }.' });
      ok = false;
      return;
    }
    if (typeof item.name !== "string" || item.name.trim() === "") {
      errors.push({ path: `${at}.name`, message: "Expected a non-empty string." });
      ok = false;
    }
    if (typeof item.color !== "string" || !HEX_COLOR.test(item.color)) {
      errors.push({ path: `${at}.color`, message: 'Expected a #rrggbb color, such as "#d7263d".' });
      ok = false;
      return;
    }
    const hex = item.color.toLowerCase();
    if (seen.has(hex)) {
      errors.push({ path: `${at}.color`, message: `Colors must be unique; ${hex} is also colors[${seen.get(hex)}].` });
      ok = false;
    } else {
      seen.set(hex, j);
    }
  });
  return ok;
}

/** A checked `color[]` value with its colors in lowercase. */
function normalizeColors(value: unknown): { name: string; color: string }[] {
  return (value as { name: string; color: string }[]).map(({ name, color }) => ({ name, color: color.toLowerCase() }));
}

/** An absolute URL with the https scheme. */
function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** A non-empty basemap ID; a legacy ID is accepted with a warning naming its replacement. */
function checkBasemapId(value: unknown, path: string, errors: ConfigProblem[], warnings: ConfigProblem[]): boolean {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({ path, message: 'Expected a non-empty basemap ID, such as "hybrid", "osm", or "arcgis/imagery/standard".' });
    return false;
  }
  const modern = Object.hasOwn(LEGACY_BASEMAP_IDS, value) ? LEGACY_BASEMAP_IDS[value] : undefined;
  if (modern) warnings.push({ path, message: `"${value}" is a legacy basemap ID. Use the basemap styles ID "${modern}" instead.` });
  return true;
}
