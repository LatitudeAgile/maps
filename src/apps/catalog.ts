import { APPS_FOLDER, fetchJson, isConfigName, type LoadOptions } from "../config/load.ts";

/** Path of the app catalog, relative to the app's base URL (add-app-selector D1, D12). */
export const CATALOG_PATH = `${APPS_FOLDER}/index.json`;

export interface Catalog {
  /** App names to offer, in catalog order, without invalid or repeated names. */
  names: string[];
}

export interface CatalogResult {
  /** Undefined when there is no usable catalog: no Apps button. */
  catalog?: Catalog;
  /** Console warnings: one per skipped name, or one for a catalog that can't be used. */
  warnings: string[];
}

/** Check a parsed catalog: `{ "apps": [names] }` (D1). Never throws. */
export function parseCatalog(raw: unknown, url: string): CatalogResult {
  const apps = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as { apps?: unknown }).apps : undefined;
  if (!Array.isArray(apps)) {
    return { warnings: [`The app catalog at ${url} has no "apps" list, so no apps are offered. Expected { "apps": ["default", ...] }.`] };
  }
  const names: string[] = [];
  const warnings: string[] = [];
  for (const [i, value] of apps.entries()) {
    if (typeof value !== "string" || !isConfigName(value)) {
      warnings.push(`App catalog apps[${i}]: ${JSON.stringify(value)} is not an app name (1 to 64 letters, digits, hyphens, or underscores); it is skipped.`);
    } else if (names.includes(value)) {
      warnings.push(`App catalog apps[${i}]: "${value}" is listed more than once; the repeat is skipped.`);
    } else {
      names.push(value);
    }
  }
  return { catalog: { names }, warnings };
}

/**
 * Load the app catalog (D1, D2). A 404 means no catalog, silently: a single-app deployment. Any
 * other failure means no catalog, with a warning naming the URL and the reason. Never throws.
 */
export async function loadCatalog(options: Omit<LoadOptions, "search"> = {}): Promise<CatalogResult> {
  const url = new URL(
    CATALOG_PATH,
    new URL(options.baseUrl ?? import.meta.env.BASE_URL, options.documentUrl ?? globalThis.location.href),
  ).href;
  const loaded = await fetchJson(url, "the app catalog", options.fetch);
  if (loaded.ok) return parseCatalog(loaded.raw, url);
  if (loaded.status === 404) return { warnings: [] };
  return { warnings: [`${loaded.message.replace(/\.?$/, ".")} No apps are offered.`] };
}
