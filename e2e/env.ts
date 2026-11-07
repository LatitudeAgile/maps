import { loadEnv } from "vite";

/**
 * The API key the production build sees, read the same way `vite build` reads it
 * (`.env`, `.env.local`, `.env.production`, `.env.production.local`, then process env).
 * Blank or whitespace-only means no key.
 */
export function buildApiKey(): string | undefined {
  const env = loadEnv("production", process.cwd(), "VITE_");
  const key = (process.env.VITE_ARCGIS_API_KEY ?? env.VITE_ARCGIS_API_KEY ?? "").trim();
  return key === "" ? undefined : key;
}

/** True when the build under test was made with an API key. */
export function hasApiKey(): boolean {
  return buildApiKey() !== undefined;
}
