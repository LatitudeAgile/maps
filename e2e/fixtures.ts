import { test as base, expect, type ConsoleMessage, type Request } from "@playwright/test";

import { defaultConfig, SAMPLE_LAYER_HOST } from "./helpers.ts";

export { hasApiKey, buildApiKey } from "./env.ts";

export interface PageLog {
  /** Every console message the page emitted, in order. */
  console: ConsoleMessage[];
  /** Every request the page issued, in order. */
  requests: Request[];
}

/**
 * `log` starts recording as soon as a test asks for it, so request it before `page.goto`
 * (listing it in the test's fixture arguments is enough).
 */
export const test = base.extend<{ log: PageLog; liveSampleLayer: boolean; offlineSampleLayer: void }>({
  log: async ({ page }, use) => {
    const log: PageLog = { console: [], requests: [] };
    page.on("console", (msg) => log.console.push(msg));
    page.on("request", (req) => log.requests.push(req));
    await use(log);
  },
  /** Set true (`test.use({ liveSampleLayer: true })`) to serve the shipped config untouched. */
  liveSampleLayer: [false, { option: true }],
  /**
   * Automatic: unless a test opts in, serve the shipped config without its live sample layer,
   * so tests that load the default config don't depend on an external service. A test's own
   * `serveConfig`/`serveModifiedConfig` route is registered later and takes precedence.
   */
  offlineSampleLayer: [
    async ({ page, liveSampleLayer }, use) => {
      if (!liveSampleLayer) {
        await page.route("**/config/viewer.json", (route) =>
          route.fulfill({ contentType: "application/json", body: JSON.stringify(defaultConfig()) }),
        );
        // Enforce it: any request to the sample service fails the way an outage would.
        await page.context().route(`${SAMPLE_LAYER_HOST}**`, (route) => route.abort("blockedbyclient"));
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
