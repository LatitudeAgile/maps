// Sketch colors (add-print-and-sketch-panels D5), ported from StewardshipOS's mapSketches.ts:
// the configured colors, and up to six the user adds. Pure functions, with no DOM.

/** A color on the strip: from config, or added by the user (named by its hex). */
export interface SketchColor {
  name: string;
  /** `#rrggbb`, lowercase. */
  color: string;
}

/** The `colors` option's default: the five StewardshipOS colors, red first. */
export const DEFAULT_SKETCH_COLORS: readonly SketchColor[] = [
  { name: "Red", color: "#d7263d" },
  { name: "Blue", color: "#1f5fd1" },
  { name: "Green", color: "#1a9e3f" },
  { name: "Orange", color: "#f28c00" },
  { name: "Black", color: "#1a1a1a" },
];

/** Up to this many colors the user adds, after the configured ones. */
export const MAX_CUSTOM_COLORS = 6;

/** A color as stored: `#rrggbb`, lowercase; null for anything else. Accepts a missing `#`. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** Why a color can't be added, or undefined when it can. */
export function addColorProblem(value: string, configured: readonly SketchColor[], custom: readonly string[]): string | undefined {
  const hex = normalizeHex(value);
  if (!hex) return "Choose a color.";
  if (configured.some((c) => c.color === hex) || custom.includes(hex)) return "That color is already on the strip.";
  if (custom.length >= MAX_CUSTOM_COLORS) return `Up to ${MAX_CUSTOM_COLORS} added colors: remove one to add another.`;
  return undefined;
}

/** The added colors with `value` at the end, or the same list when it can't be added. */
export function addCustomColor(value: string, configured: readonly SketchColor[], custom: readonly string[]): string[] {
  if (addColorProblem(value, configured, custom)) return [...custom];
  return [...custom, normalizeHex(value)!];
}

/** The added colors without `hex`. Sketches drawn in it keep it. */
export function removeCustomColor(hex: string, custom: readonly string[]): string[] {
  return custom.filter((h) => h !== hex);
}

/**
 * Added colors as remembered, cleaned up: valid, unique, not already configured, at most six.
 * A config whose colors changed since may now include one of them; it is dropped.
 */
export function cleanCustomColors(saved: unknown, configured: readonly SketchColor[]): string[] {
  if (!Array.isArray(saved)) return [];
  const hexes = saved.map(normalizeHex).filter((h): h is string => h !== null);
  return [...new Set(hexes)].filter((h) => !configured.some((c) => c.color === h)).slice(0, MAX_CUSTOM_COLORS);
}

/** The chosen color: the remembered one while it is on the strip, else the first configured. */
export function chosenColor(saved: unknown, configured: readonly SketchColor[], custom: readonly string[]): string {
  const hex = normalizeHex(saved);
  if (hex && (configured.some((c) => c.color === hex) || custom.includes(hex))) return hex;
  return configured[0].color;
}

/** A color's name from the configured colors, or undefined for any other (a custom color). */
export function colorName(hex: string | undefined, configured: readonly SketchColor[]): string | undefined {
  return configured.find((c) => c.color === hex)?.name;
}
