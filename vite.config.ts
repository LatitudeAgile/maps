import { defineConfig } from "vite";
import { extensionsPlugin } from "./vite/extensionsPlugin.ts";

// https://vitejs.dev/config/
export default defineConfig({
  // Extension folders under extensions/ (add-drop-in-extensions D1).
  plugins: [extensionsPlugin()],
  resolve: {
    // Extensions import viewer features from "viewer" (add-drop-in-extensions D4). The pattern
    // matches that exact specifier only, so a package named "viewer-something" isn't caught.
    // Root-relative, so it is the same module as the viewer's own imports of api.ts: an absolute
    // path can differ from the root in its drive letter's case on Windows, and Vite then serves
    // it as /@fs/..., a second copy of the API and of the map menu's registry (map-menu).
    alias: [{ find: /^viewer$/, replacement: "/src/components/api.ts" }],
  },
  server: {
    open: true,
  },
  build: {
    outDir: "dist",
    // The ArcGIS Maps SDK ships large chunks by design (the main bundle is ~1.7 MB
    // minified). Raise the limit so only unexpected growth warns.
    chunkSizeWarningLimit: 2000,
    // Calcite's design tokens use CSS light-dark(). Vite's default CSS target predates it,
    // so Lightning CSS lowers it to a polyfill that leaves every color token invalid
    // (transparent notices, missing status colors). Target browsers with native support.
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
  },
});
