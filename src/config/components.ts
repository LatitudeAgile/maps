import type { OptionKind, ComponentTypeSchema } from "../components/registry.ts";
import { skippedMessage } from "../components/extensions.ts";
import { LEGACY_BASEMAP_IDS } from "../map/basemapIds.ts";
import { ID_PATTERN } from "./layers.ts";
import {
  COMPONENT_PLACEMENTS,
  CORNER_PLACEMENTS,
  EXPAND_MODES,
  isCredentialKey,
  type ComponentConfig,
  type ComponentPlacement,
  type ConfigProblem,
  type ExpandMode,
  type ExpandSettings,
  type MapViewKind,
  type PanelSettings,
} from "./types.ts";

/** "2D maps", "3D scenes", or both, for view-limit messages. */
export function viewsText(views: readonly MapViewKind[]): string {
  return views.map((v) => (v === "2d" ? "2D maps" : "3D scenes")).join(" and ");
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN_KEYS = ["id", "type", "placement", "options", "panel", "expand"];

/** Placement used when an entry doesn't set one. */
export const DEFAULT_PLACEMENT: ComponentPlacement = "panel";

export interface ComponentValidationContext {
  /** Registered component types and their supported options. */
  types: Readonly<Record<string, ComponentTypeSchema>>;
  /** Ids of the configured layers, for layer-reference options. */
  layerIds: string[];
  /** The app's view when the config decides it; undefined with `map.item` (design D8). */
  view?: MapViewKind;
  /** Extension folders that were skipped, and why: an entry of such a type gets the reason. */
  skipped?: ReadonlyMap<string, string>;
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
    if (!schema) {
      const skipped = typeof type === "string" ? context.skipped?.get(type) : undefined;
      errors.push({ path: `${at}.type`, message: skipped ? skippedMessage(type as string, skipped) : `Expected one of: ${typeNames.join(", ")}.` });
    }
    else if (context.view && schema.views && !schema.views.includes(context.view)) {
      errors.push({ path: `${at}.type`, message: `The "${type}" component works only in ${viewsText(schema.views)}.` });
    }

    // Omitted placement means a sidebar panel.
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
        if (checkOption(kind, value, path, context.layerIds, errors, warnings, context.view)) options[name] = kind === "color[]" ? normalizeColors(value) : value;
      }
    }
    // Fill options the entry leaves out from the type's defaults (design D1).
    if (schema?.defaults) {
      for (const [name, value] of Object.entries(schema.defaults)) {
        if (!Object.hasOwn(options, name)) options[name] = value;
      }
    }

    const panel = validatePanel(entry.panel, placement === "panel", `${at}.panel`, errors, warnings);
    const isCorner = typeof placement === "string" && (CORNER_PLACEMENTS as readonly string[]).includes(placement);
    const expand = validateExpand(entry.expand, isCorner, schema, type, context.types, `${at}.expand`, errors, warnings);

    if (errors.length > before) return;
    result.push({
      id: id as string,
      type: type as string,
      placement: placement as ComponentPlacement,
      options,
      ...(panel ? { panel } : {}),
      ...(expand ? { expand } : {}),
    });
  });

  return result;
}

/**
 * A component's `panel` setting: sidebar heading and icon (sidebar). Only meaningful
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

const EXPAND_KEYS = ["icon", "tooltip", "expanded", "group", "mode"];

/**
 * A component's `expand` setting (add-map-expand-and-components D1): `true` is `{}`, `false` is
 * none. The value is checked first; then, off a corner placement, it is ignored with one warning
 * (before the type check, so a button type with the default `panel` placement warns, not fails);
 * then the type must accept it (D2).
 */
function validateExpand(
  raw: unknown,
  isCorner: boolean,
  schema: ComponentTypeSchema | undefined,
  type: unknown,
  types: Readonly<Record<string, ComponentTypeSchema>>,
  path: string,
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): ExpandSettings | undefined {
  if (raw === undefined || raw === false) return undefined;
  if (raw !== true && !isObject(raw)) {
    errors.push({ path, message: 'Expected true, false, or a settings object, such as { "icon": "print" }.' });
    return undefined;
  }
  const expand: ExpandSettings = {};
  let ok = true;
  if (isObject(raw)) {
    for (const key of Object.keys(raw)) {
      if (!EXPAND_KEYS.includes(key) && !isCredentialKey(key)) warnings.push({ path: `${path}.${key}`, message: "Unknown setting; it is ignored." });
    }
    for (const key of ["icon", "tooltip"] as const) {
      if (raw[key] === undefined) continue;
      if (typeof raw[key] === "string" && raw[key].trim() !== "") expand[key] = raw[key];
      else {
        errors.push({ path: `${path}.${key}`, message: key === "icon" ? 'Expected a Calcite icon name, such as "print".' : "Expected a non-empty string." });
        ok = false;
      }
    }
    if (raw.expanded !== undefined) {
      if (typeof raw.expanded === "boolean") expand.expanded = raw.expanded;
      else {
        errors.push({ path: `${path}.expanded`, message: "Expected true or false." });
        ok = false;
      }
    }
    if (raw.group !== undefined) {
      if (raw.group === false || (typeof raw.group === "string" && raw.group.trim() !== "")) expand.group = raw.group;
      else {
        errors.push({ path: `${path}.group`, message: "Expected a non-empty group name, or false for no group." });
        ok = false;
      }
    }
    if (raw.mode !== undefined) {
      if (typeof raw.mode === "string" && (EXPAND_MODES as readonly string[]).includes(raw.mode)) expand.mode = raw.mode as ExpandMode;
      else {
        errors.push({ path: `${path}.mode`, message: `Expected one of: ${EXPAND_MODES.join(", ")}.` });
        ok = false;
      }
    }
  }
  if (!ok) return undefined;
  if (!isCorner) {
    warnings.push({ path, message: "Only used with a corner placement; it is ignored." });
    return undefined;
  }
  if (schema && !schema.expandable) {
    const accepting = Object.entries(types)
      .filter(([, t]) => t.expandable)
      .map(([name]) => name);
    errors.push({ path, message: `The "${String(type)}" component can't open from an expand. These can: ${accepting.join(", ")}.` });
    return undefined;
  }
  return expand;
}

/** Check one option value against its kind. Returns true when it is valid. */
function checkOption(
  kind: OptionKind,
  value: unknown,
  path: string,
  layerIds: string[],
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
  view?: MapViewKind,
): boolean {
  const unknownLayer = (id: unknown) => `"${String(id)}" is not a configured layer. Use an id from layers.`;
  if (typeof kind === "object") {
    if ("oneOf" in kind) {
      if (typeof value === "string" && kind.oneOf.includes(value)) return true;
      errors.push({ path, message: `Expected one of: ${kind.oneOf.join(", ")}.` });
      return false;
    }
    if ("listOf" in kind) return checkListOf(kind.listOf, value, path, errors);
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
    case "bookmark[]":
      return checkBookmarks(value, path, view, errors, warnings);
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

/** A `{ listOf }` option: a non-empty list of unique values from `allowed` (D8). */
function checkListOf(allowed: readonly string[], value: unknown, path: string, errors: ConfigProblem[]): boolean {
  const expected = `a list of ${allowed.join(", ")}, each at most once`;
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: `Expected ${expected}, such as ["${allowed[0]}"].` });
    return false;
  }
  let ok = true;
  const seen = new Map<string, number>();
  value.forEach((item: unknown, j) => {
    if (typeof item !== "string" || !allowed.includes(item)) {
      errors.push({ path: `${path}[${j}]`, message: `Expected one of: ${allowed.join(", ")}.` });
      ok = false;
    } else if (seen.has(item)) {
      errors.push({ path, message: `Expected ${expected}; "${item}" is listed at [${seen.get(item)}] and [${j}].` });
      ok = false;
    } else {
      seen.set(item, j);
    }
  });
  return ok;
}

const BOOKMARK_KEYS = ["name", "center", "zoom", "scale", "tilt", "heading"];
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A `bookmark[]` option: places to go to, each `{ name, center, zoom | scale, tilt?, heading? }`,
 * checked like the same settings in `map`. Tilt and heading need a 3D scene; with `map.item` the
 * view isn't known yet, so they are accepted and used only if it turns out to be a scene.
 */
function checkBookmarks(value: unknown, path: string, view: MapViewKind | undefined, errors: ConfigProblem[], warnings: ConfigProblem[]): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: 'Expected a list of at least one bookmark, such as [{ "name": "Downtown", "center": [-104.99, 39.74], "zoom": 14 }].' });
    return false;
  }
  let ok = true;
  const fail = (at: string, message: string) => {
    errors.push({ path: at, message });
    ok = false;
  };
  value.forEach((item: unknown, j) => {
    const at = `${path}[${j}]`;
    if (!isObject(item)) return fail(at, 'Expected { "name": <text>, "center": [longitude, latitude], "zoom" or "scale": <number> }.');
    for (const key of Object.keys(item)) {
      if (!BOOKMARK_KEYS.includes(key) && !isCredentialKey(key)) warnings.push({ path: `${at}.${key}`, message: "Unknown setting; it is ignored." });
    }
    if (typeof item.name !== "string" || item.name.trim() === "") fail(`${at}.name`, "Required. Expected a non-empty string.");
    const c = item.center;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(isFiniteNumber)) {
      fail(`${at}.center`, "Required. Expected [longitude, latitude]: an array of two numbers.");
    } else {
      if (c[0] < -180 || c[0] > 180) fail(`${at}.center[0]`, "Expected a longitude between -180 and 180.");
      if (c[1] < -90 || c[1] > 90) fail(`${at}.center[1]`, "Expected a latitude between -90 and 90.");
    }
    if (item.zoom !== undefined && item.scale !== undefined) fail(at, "Set either zoom or scale, not both.");
    else if (item.zoom === undefined && item.scale === undefined) fail(at, "Required: zoom or scale.");
    else if (item.zoom !== undefined && !(isFiniteNumber(item.zoom) && item.zoom >= 0)) fail(`${at}.zoom`, "Expected a number 0 or greater.");
    else if (item.scale !== undefined && !(isFiniteNumber(item.scale) && item.scale > 0)) fail(`${at}.scale`, "Expected a number greater than 0.");
    for (const [key, label, valid, range] of [
      ["tilt", "Tilt", (v: number) => v >= 0 && v <= 90, "a number from 0 to 90"],
      ["heading", "Heading", (v: number) => v >= 0 && v < 360, "a number from 0 up to, but not including, 360"],
    ] as const) {
      const v = item[key];
      if (v === undefined) continue;
      if (view === "2d") fail(`${at}.${key}`, `${label} needs "view": "3d".`);
      else if (!(isFiniteNumber(v) && valid(v))) fail(`${at}.${key}`, `Expected ${range}.`);
    }
  });
  return ok;
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
