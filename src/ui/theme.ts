/**
 * Theme colors for the sidebar's icon bar and the title box (branding, P-28, design D4, D5).
 * The color helpers are pure, so validation uses them without a DOM.
 */
import { COLOR_MODES, type ColorMode } from "../config/types.ts";

/** A validated theme: `color` and `textColor` as lowercase `#rrggbb`, `opacity` from 0 to 1. */
export interface Theme {
  color: string;
  opacity: number;
  textColor: string;
}

/** WCAG 2.x minimum contrast for normal text. */
export const MIN_CONTRAST = 4.5;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `[r, g, b]` (0–255) for `#rgb` or `#rrggbb`, or undefined for anything else. */
export function parseHex(value: unknown): [number, number, number] | undefined {
  if (typeof value !== "string" || !HEX.test(value)) return undefined;
  const digits = value.length === 4 ? [...value.slice(1)].map((d) => d + d).join("") : value.slice(1);
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** `#rrggbb`, lowercase, for a color `parseHex` accepts. */
export function normalizeHex(value: string): string {
  const rgb = parseHex(value);
  if (!rgb) throw new Error(`Not a hex color: ${value}`);
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG 2.x relative luminance of an sRGB color. */
function luminance([r, g, b]: [number, number, number]): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a)!);
  const lb = luminance(parseHex(b)!);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or black, whichever contrasts more with `color` (white on a tie). */
export function resolveTextColor(color: string): "#ffffff" | "#000000" {
  return contrastRatio(color, "#ffffff") >= contrastRatio(color, "#000000") ? "#ffffff" : "#000000";
}

/**
 * Theme the icon bar and the title box (design D4): set `--viewer-theme-*` on `root` and mark it
 * `themed`; `style.css` maps these onto Calcite's action-bar and action tokens. The opacity goes
 * into the background color's alpha only, so icons and text stay fully opaque. It applies while
 * the sidebar is collapsed; with a panel open, the icon bar is solid.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  const [r, g, b] = parseHex(theme.color)!;
  root.classList.add("themed");
  root.style.setProperty("--viewer-theme-background", `rgb(${r} ${g} ${b} / ${theme.opacity})`);
  // The icon bar while a panel is open: the same color, solid, so the bar and the panel read as
  // one block (add-print-and-sketch-panels D13).
  root.style.setProperty("--viewer-theme-solid", `rgb(${r} ${g} ${b})`);
  root.style.setProperty("--viewer-theme-text", theme.textColor);
  // The open panel's icon: the theme color darkened, opaque, so it stands out on any map.
  root.style.setProperty("--viewer-theme-pressed", `color-mix(in srgb, ${theme.color} 75%, black)`);
  // Hover: a light wash of the text color over the bar.
  root.style.setProperty("--viewer-theme-hover", `color-mix(in srgb, ${theme.textColor} 15%, transparent)`);
}

/**
 * Put the page in light, dark or the system's mode (add-color-mode D1, D2): swap the
 * `calcite-mode-*` class on `<html>`. `index.html` starts with `calcite-mode-auto`, so the page
 * matches the system until this runs. Calcite's tokens pick their light or dark value from it,
 * and map components and the viewer's CSS use those tokens.
 */
export function applyMode(mode: ColorMode, root: HTMLElement = document.documentElement): void {
  root.classList.remove(...COLOR_MODES.map((m) => `calcite-mode-${m}`));
  root.classList.add(`calcite-mode-${mode}`);
}

/** A contrast ratio for messages, rounded down to one decimal so 4.46 never reads as 4.5. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}
