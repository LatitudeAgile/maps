/**
 * Checks the extension folders found by the build (vite/extensionsPlugin.ts) and turns each
 * valid manifest into a component type (add-drop-in-extensions D3). A folder with a problem is
 * skipped with a reason: the viewer keeps starting, logs it, and validation shows it for a config
 * entry of that type. Every reason here has a troubleshooting entry in docs/components/sharing.md.
 */
import { COMPONENT_PLACEMENTS, EXPAND_MODES, MAP_VIEWS } from "../config/types.ts";
import { API_VERSION } from "./api.ts";
import { CORNER_STYLES, NAMED_OPTION_KINDS, VALUED_OPTION_KINDS, type ComponentType } from "./componentType.ts";

/** A folder as the build found it. */
export interface ExtensionFolder {
  folder: string;
  /** The default export of its component.ts, unchecked. */
  manifest?: unknown;
  /** Why the build couldn't take a manifest from it, such as "it has no component.ts". */
  problem?: string;
}

export interface CheckedExtensions {
  /** The valid extensions' types, by folder name. */
  types: Record<string, ComponentType>;
  /** Skipped folders and why, by folder name. */
  skipped: Map<string, string>;
}

/** Folder names: lowercase words of letters and digits, joined by hyphens, starting with a letter. */
const FOLDER_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A valid custom element name, simplified to ASCII: lowercase, starting with a letter, with a hyphen. */
const ELEMENT_NAME = /^[a-z][.0-9_a-z]*-[-.0-9_a-z]*$/;

/** Names the HTML spec reserves, which can't be custom element names. */
const RESERVED_ELEMENT_NAMES = ["annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph"];

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** The full message for a skipped folder, as logged and as shown by validation. */
export const skippedMessage = (folder: string, reason: string): string => `extensions/${folder}/ was skipped: ${reason}.`;

/**
 * Check every folder, in the order given (alphabetical, from the build). `builtIns` are the
 * built-in types: their names and tags can't be taken. The first folder to use a tag keeps it.
 */
export function checkExtensions(folders: readonly ExtensionFolder[], builtIns: Readonly<Record<string, ComponentType>>): CheckedExtensions {
  const types: Record<string, ComponentType> = {};
  const skipped = new Map<string, string>();
  // Tag -> who has it: a built-in type name, or an extension folder.
  const tags = new Map<string, string>(Object.entries(builtIns).map(([name, type]) => [type.tag, `the built-in ${name} type`]));

  for (const { folder, manifest, problem } of folders) {
    const reason = folderProblem(folder, builtIns) ?? problem ?? manifestProblem(manifest, tags);
    if (reason) {
      skipped.set(folder, reason);
      continue;
    }
    const { apiVersion: _version, ...type } = manifest as ComponentType & { apiVersion: number };
    types[folder] = type;
    tags.set(type.tag, folder);
  }
  return { types, skipped };
}

/** What's wrong with a folder's name, if anything. */
function folderProblem(folder: string, builtIns: Readonly<Record<string, ComponentType>>): string | undefined {
  if (!FOLDER_NAME.test(folder)) return `"${folder}" isn't a valid type name; use lowercase letters, digits and hyphens, starting with a letter`;
  if (Object.hasOwn(builtIns, folder)) return `${folder} is a built-in type`;
  return undefined;
}

/** What's wrong with a manifest, if anything. `tags` says which tags are taken, and by whom. */
function manifestProblem(manifest: unknown, tags: ReadonlyMap<string, string>): string | undefined {
  if (manifest === undefined) return "its component.ts has no default export";
  if (!isObject(manifest)) return "its component.ts default export isn't a manifest object; export defineComponentType({ ... })";

  const { apiVersion, tag, load, panel, options, defaults, placements, views, expandable, expandMode, cornerStyle, configure, keyless } = manifest;
  if (apiVersion === undefined) return "its manifest has no apiVersion";
  if (apiVersion !== API_VERSION) return `it was written for viewer API ${String(apiVersion)}, and this viewer supports version ${API_VERSION}`;

  if (tag === undefined) return "its manifest has no tag";
  if (typeof tag !== "string" || !ELEMENT_NAME.test(tag) || RESERVED_ELEMENT_NAMES.includes(tag)) {
    return `its tag ${JSON.stringify(tag)} isn't a valid custom element name; use lowercase letters with a hyphen, such as "viewer-my-component"`;
  }
  if (tag.startsWith("arcgis-") || tag.startsWith("calcite-")) return `its tag ${tag} starts with "arcgis-" or "calcite-", which belong to Esri's components`;
  const owner = tags.get(tag);
  if (owner) return `its tag ${tag} is already used by ${owner}`;

  if (typeof load !== "function") return "its manifest has no load function";
  if (!isObject(panel)) return "its manifest has no panel heading and icon";
  if (!isNonEmptyString(panel.heading)) return "its manifest's panel.heading isn't a non-empty string";
  if (!isNonEmptyString(panel.icon)) return "its manifest's panel.icon isn't a non-empty string";

  if (!isObject(options)) return "its manifest has no options object; use options: {} for none";
  for (const [name, kind] of Object.entries(options)) {
    const problem = optionKindProblem(kind);
    if (problem) return `its option ${name} ${problem}`;
  }
  if (defaults !== undefined && !isObject(defaults)) return "its manifest's defaults isn't an object";

  const listProblem = (field: string, value: unknown, allowed: readonly string[]): string | undefined =>
    value === undefined || (Array.isArray(value) && value.length > 0 && value.every((v) => allowed.includes(v as string)))
      ? undefined
      : `its manifest's ${field} must be a non-empty list of: ${allowed.join(", ")}`;
  const oneProblem = (field: string, value: unknown, allowed: readonly string[]): string | undefined =>
    value === undefined || allowed.includes(value as string) ? undefined : `its manifest's ${field} must be one of: ${allowed.join(", ")}`;

  return (
    listProblem("placements", placements, COMPONENT_PLACEMENTS) ??
    listProblem("views", views, MAP_VIEWS) ??
    (expandable === undefined || expandable === true ? undefined : "its manifest's expandable must be true, or left out") ??
    oneProblem("expandMode", expandMode, EXPAND_MODES) ??
    oneProblem("cornerStyle", cornerStyle, CORNER_STYLES) ??
    (configure === undefined || typeof configure === "function" ? undefined : "its manifest's configure isn't a function") ??
    (keyless === undefined || typeof keyless === "function" ? undefined : "its manifest's keyless isn't a function")
  );
}

/** What's wrong with an option kind, if anything, phrased to follow "its option <name>". */
function optionKindProblem(kind: unknown): string | undefined {
  const known = `use one of ${NAMED_OPTION_KINDS.join(", ")}, or { oneOf }, { integer } or { listOf }`;
  if (typeof kind === "string") return (NAMED_OPTION_KINDS as readonly string[]).includes(kind) ? undefined : `has an unknown kind "${kind}"; ${known}`;
  if (!isObject(kind)) return `has an unknown kind; ${known}`;
  const keys = Object.keys(kind);
  const valued = keys.length === 1 ? (VALUED_OPTION_KINDS as readonly string[]).find((k) => k === keys[0]) : undefined;
  if (!valued) return `has an unknown kind; ${known}`;
  const value = kind[valued];
  if (valued === "integer") {
    return Array.isArray(value) && value.length === 2 && value.every(Number.isInteger) && value[0] <= value[1]
      ? undefined
      : "has an { integer } kind without a [min, max] range of whole numbers";
  }
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString) ? undefined : `has a { ${valued} } kind without a non-empty list of strings`;
}
