/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional ArcGIS API key, scoped to the basemap styles service. Never commit one. */
  readonly VITE_ARCGIS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * The extension folders under extensions/, found at build time (vite/extensionsPlugin.ts,
 * add-drop-in-extensions D1). `manifest` is the default export of the folder's component.ts,
 * unchecked; src/components/extensions.ts checks it.
 */
declare module "virtual:viewer-extensions" {
  export const folders: ReadonlyArray<{ folder: string; manifest?: unknown; problem?: string }>;
}
