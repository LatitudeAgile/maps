import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    open: true,
  },
  preview: {
    // Preview options inherit server.open; keep `vite preview` (used by Playwright) headless.
    open: false,
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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
