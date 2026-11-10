import { validateTheme } from "../config/theme.ts";
import type { ConfigProblem, ViewerConfig } from "../config/types.ts";
import type { Theme } from "../ui/theme.ts";

/** What the Apps panel shows for one app, from its config's `app` section (app-selector). */
export interface AppListing {
  title: string;
  summary?: string;
  description?: string;
  icon?: string;
  theme?: Pick<Theme, "color" | "textColor">;
}

export type ListingResult = { ok: true; listing: AppListing } | { ok: false; reason: string };

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/**
 * Read another app's listing from its raw config (add-app-selector D5). Only `app` is read, and
 * leniently: a missing or empty `app.title` makes the app unavailable, but any other invalid
 * listing value is treated as absent, and the rest of the config isn't checked at all.
 */
export function readListing(raw: unknown): ListingResult {
  const app = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as { app?: unknown }).app : undefined;
  const section = typeof app === "object" && app !== null && !Array.isArray(app) ? (app as Record<string, unknown>) : {};
  if (!nonEmpty(section.title)) return { ok: false, reason: "Its config has no app.title." };

  const listing: AppListing = { title: section.title };
  if (nonEmpty(section.summary)) listing.summary = section.summary;
  if (typeof section.description === "string") listing.description = section.description;
  if (nonEmpty(section.icon)) listing.icon = section.icon;
  // Throwaway lists: another app's theme problems are its own, reported when it is opened.
  const errors: ConfigProblem[] = [];
  const theme = validateTheme(section.theme, errors, []);
  if (theme && errors.length === 0) listing.theme = { color: theme.color, textColor: theme.textColor };
  return { ok: true, listing };
}

/** The open app's listing, from its already-validated config. */
export function currentListing(config: ViewerConfig): AppListing {
  const { title, summary, description, icon, theme } = config.app;
  return {
    title,
    ...(summary !== undefined ? { summary } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(theme ? { theme: { color: theme.color, textColor: theme.textColor } } : {}),
  };
}
