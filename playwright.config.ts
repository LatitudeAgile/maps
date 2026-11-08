import { defineConfig, devices } from "@playwright/test";
import { hasApiKey } from "./e2e/env.ts";

const port = 4173;

// Report once, up front (main process only), whether key-dependent tests will run.
if (process.env.TEST_WORKER_INDEX === undefined) console.log(
  hasApiKey()
    ? "[e2e] VITE_ARCGIS_API_KEY found: key-dependent tests will run."
    : "[e2e] No VITE_ARCGIS_API_KEY: key-dependent tests will be skipped.",
);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: "retain-on-failure",
  },
  projects: [
    // Tests tagged @live use real ArcGIS services; set E2E_OFFLINE=1 to skip them.
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: process.env.E2E_OFFLINE ? /@timing|@live/ : /@timing/ },
    // Tests that assert a wall-clock bound (tagged @timing) run after everything else, so
    // parallel workers competing for CPU don't eat into the bound being tested.
    { name: "chromium-timing", use: { ...devices["Desktop Chrome"] }, grep: /@timing/, dependencies: ["chromium"] },
  ],
  // Test the production build so "edit the deployed config" scenarios are real.
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
