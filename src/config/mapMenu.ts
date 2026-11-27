// The `mapMenu` setting (map-menu; add-map-menu D6, D10): which entries the map menu shows, in
// what order, with their options. Validated after `components`, so component ids are known.
import { isCredentialKey, type ConfigProblem } from "./types.ts";

/** The built-in items, in their default order. */
export const BUILT_IN_MENU_ITEMS = ["whats-here", "copy-coordinates", "center-here"] as const;
export type BuiltInMenuItemId = (typeof BUILT_IN_MENU_ITEMS)[number];

/** Copy coordinates' formats: decimal degrees (the default), degrees and decimal minutes, DMS, and grids. */
export const MENU_COORDINATE_FORMATS = ["dd", "ddm", "dms", "mgrs", "usng", "utm"] as const;
export type MenuCoordinateFormat = (typeof MENU_COORDINATE_FORMATS)[number];

/** A link item's icon when it names none. */
export const DEFAULT_LINK_ICON = "launch";

export type MapMenuEntry =
  | { kind: "whats-here"; id: "whats-here"; url?: string }
  | { kind: "copy-coordinates"; id: "copy-coordinates"; format: MenuCoordinateFormat }
  | { kind: "center-here"; id: "center-here" }
  /** All of a component's items, as one group headed with its heading. */
  | { kind: "component"; id: string }
  /** A page opened for the spot, with `{lat}` and `{lon}` filled in. */
  | { kind: "link"; id: string; label: string; url: string; icon: string };

/** `false` turns the menu off; otherwise the entries in the order shown. */
export type MapMenuConfig = false | MapMenuEntry[];

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isBuiltIn = (id: string): id is BuiltInMenuItemId => (BUILT_IN_MENU_ITEMS as readonly string[]).includes(id);

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/** A link item's URL with `{lat}` and `{lon}` filled in. */
export function fillLinkUrl(template: string, latitude: number, longitude: number): string {
  return template
    .replaceAll("{lat}", encodeURIComponent(latitude.toFixed(6)))
    .replaceAll("{lon}", encodeURIComponent(longitude.toFixed(6)));
}

/** The menu without a `mapMenu` setting: the built-ins, then every component in config order. */
export function defaultMapMenu(componentIds: readonly string[]): MapMenuEntry[] {
  return [
    { kind: "whats-here", id: "whats-here" },
    { kind: "copy-coordinates", id: "copy-coordinates", format: "dd" },
    { kind: "center-here", id: "center-here" },
    ...componentIds.map((id) => ({ kind: "component" as const, id })),
  ];
}

/** Warn about, and leave out, keys an entry doesn't use. */
function warnExtraKeys(entry: Obj, allowed: readonly string[], path: string, what: string, warnings: ConfigProblem[]): void {
  for (const key of Object.keys(entry)) {
    if (key === "id" || allowed.includes(key) || isCredentialKey(key)) continue;
    warnings.push({ path: `${path}.${key}`, message: `Not supported by ${what}; it is ignored.` });
  }
}

/**
 * Check `mapMenu` and normalize it: `false`, or a non-empty list of built-in ids, component ids
 * and link items. Strings become `{ id }`. Absent, it is the default menu.
 */
export function validateMapMenu(raw: unknown, componentIds: readonly string[], errors: ConfigProblem[], warnings: ConfigProblem[]): MapMenuConfig {
  if (raw === undefined) return defaultMapMenu(componentIds);
  if (raw === false) return false;
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push({ path: "mapMenu", message: "Expected false or a non-empty list of menu entries." });
    return false;
  }
  const entries: MapMenuEntry[] = [];
  const seen = new Set<string>();
  raw.forEach((value, i) => {
    const path = `mapMenu[${i}]`;
    const entry: Obj | undefined = typeof value === "string" ? { id: value } : isObject(value) ? value : undefined;
    if (!entry) {
      errors.push({ path, message: "Expected an item id, or an object with an id." });
      return;
    }
    const id = entry.id;
    if (!isNonEmptyString(id)) {
      errors.push({ path: `${path}.id`, message: "Expected a non-empty string." });
      return;
    }
    if (seen.has(id)) {
      errors.push({ path, message: `"${id}" is listed twice.` });
      return;
    }
    seen.add(id);
    const isComponent = componentIds.includes(id);
    // A link item: an object with a url or label whose id isn't taken. What's here? has a url of its own.
    const looksLikeLink = entry.label !== undefined || (entry.url !== undefined && id !== "whats-here");
    if (looksLikeLink && (isBuiltIn(id) || isComponent)) {
      errors.push({ path: `${path}.id`, message: `"${id}" is ${isComponent ? "a component's" : "a built-in item's"} id. A link item needs an id of its own.` });
      return;
    }

    if (id === "whats-here") {
      warnExtraKeys(entry, ["url"], path, "What's here?", warnings);
      if (entry.url === undefined) entries.push({ kind: "whats-here", id });
      else if (typeof entry.url === "string" && isHttpsUrl(entry.url)) entries.push({ kind: "whats-here", id, url: entry.url });
      else errors.push({ path: `${path}.url`, message: "Expected an absolute https URL of a GeocodeServer." });
      return;
    }
    if (id === "copy-coordinates") {
      warnExtraKeys(entry, ["format"], path, "Copy coordinates", warnings);
      const format = entry.format ?? "dd";
      if ((MENU_COORDINATE_FORMATS as readonly unknown[]).includes(format)) {
        entries.push({ kind: "copy-coordinates", id, format: format as MenuCoordinateFormat });
      } else {
        errors.push({ path: `${path}.format`, message: `Expected one of: ${MENU_COORDINATE_FORMATS.join(", ")}.` });
      }
      return;
    }
    if (id === "center-here") {
      warnExtraKeys(entry, [], path, "Center here", warnings);
      entries.push({ kind: "center-here", id });
      return;
    }
    if (isComponent) {
      warnExtraKeys(entry, [], path, "a component entry", warnings);
      entries.push({ kind: "component", id });
      return;
    }
    if (looksLikeLink) {
      const link = validateLink(entry, id, path, errors, warnings);
      if (link) entries.push(link);
      return;
    }
    warnings.push({ path, message: `"${id}" is not a built-in item, a component in this config or a link item; it is skipped.` });
  });
  return entries;
}

function validateLink(entry: Obj, id: string, path: string, errors: ConfigProblem[], warnings: ConfigProblem[]): MapMenuEntry | undefined {
  warnExtraKeys(entry, ["label", "url", "icon"], path, "a link item", warnings);
  let ok = true;
  if (!isNonEmptyString(entry.label)) {
    errors.push({ path: `${path}.label`, message: "A label is required: the text the menu shows." });
    ok = false;
  }
  if (typeof entry.url !== "string" || !isHttpsUrl(fillLinkUrl(entry.url, 0, 0))) {
    errors.push({ path: `${path}.url`, message: "Expected an absolute https URL, with {lat} and {lon} where the spot goes." });
    ok = false;
  }
  if (entry.icon !== undefined && !isNonEmptyString(entry.icon)) {
    errors.push({ path: `${path}.icon`, message: "Expected a non-empty string: a Calcite icon name." });
    ok = false;
  }
  if (!ok) return undefined;
  return { kind: "link", id, label: entry.label as string, url: entry.url as string, icon: (entry.icon as string | undefined) ?? DEFAULT_LINK_ICON };
}
