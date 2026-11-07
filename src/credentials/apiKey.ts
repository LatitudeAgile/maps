import type { Config } from "@arcgis/core/config.js";

/**
 * Normalize the build-time API key. Absent, empty, or whitespace-only means no key.
 * Pass `import.meta.env.VITE_ARCGIS_API_KEY`.
 */
export function readApiKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  return key ? key : undefined;
}

/**
 * Scope a key to the basemap styles service only. The global `apiKey` is never set, so
 * the key isn't attached to portal or other service requests and can't shadow a signed-in
 * user's credential. Does nothing without a key.
 */
export function applyApiKey(esriConfig: Pick<Config, "apiKey" | "apiKeys">, key: string | undefined): void {
  if (!key) return;
  esriConfig.apiKeys.basemapStyles = key;
}
