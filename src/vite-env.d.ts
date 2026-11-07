/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional ArcGIS API key, scoped to the basemap styles service. Never commit one. */
  readonly VITE_ARCGIS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
