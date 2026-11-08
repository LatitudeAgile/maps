import { contrastRatio, formatRatio, MIN_CONTRAST, normalizeHex, parseHex, resolveTextColor, type Theme } from "../ui/theme.ts";
import type { ConfigProblem } from "./types.ts";

const KNOWN_KEYS = ["color", "opacity", "textColor"];
const HEX_EXPECTED = "Expected a hex color such as #1f6f8b.";

/**
 * Validate `app.theme` (branding, design D5). Returns the resolved theme, or undefined when it
 * is absent or invalid. Errors and warnings are added to the given lists, located by path.
 */
export function validateTheme(raw: unknown, errors: ConfigProblem[], warnings: ConfigProblem[]): Theme | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    errors.push({ path: "app.theme", message: "Expected an object with a color, and optionally opacity and textColor." });
    return undefined;
  }
  const theme = raw as Record<string, unknown>;
  for (const key of Object.keys(theme)) {
    if (!KNOWN_KEYS.includes(key)) warnings.push({ path: `app.theme.${key}`, message: "Unknown setting; it is ignored." });
  }

  const before = errors.length;
  if (theme.color === undefined) errors.push({ path: "app.theme.color", message: `Required. ${HEX_EXPECTED}` });
  else if (!parseHex(theme.color)) errors.push({ path: "app.theme.color", message: HEX_EXPECTED });

  let opacity = 1;
  if (theme.opacity !== undefined) {
    if (typeof theme.opacity === "number" && Number.isFinite(theme.opacity) && theme.opacity >= 0 && theme.opacity <= 1) opacity = theme.opacity;
    else errors.push({ path: "app.theme.opacity", message: "Expected a number from 0 to 1." });
  }

  if (theme.textColor !== undefined && !parseHex(theme.textColor)) errors.push({ path: "app.theme.textColor", message: HEX_EXPECTED });
  if (errors.length > before) return undefined;

  const color = normalizeHex(theme.color as string);
  const textColor = theme.textColor === undefined ? resolveTextColor(color) : normalizeHex(theme.textColor as string);
  // Measured against the opaque color: with opacity below 1 the map shows through, so the docs
  // advise 0.8 or more (design D5).
  const ratio = contrastRatio(color, textColor);
  if (ratio < MIN_CONTRAST) {
    warnings.push({
      path: "app.theme.textColor",
      message: `The text and background colors have a contrast of ${formatRatio(ratio)}, below the ${MIN_CONTRAST}:1 that WCAG asks for, so the title and icons may be hard to read.`,
    });
  }
  return { color, opacity, textColor };
}
