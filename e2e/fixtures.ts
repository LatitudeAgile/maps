import { test as base, expect, type ConsoleMessage, type Request } from "@playwright/test";

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
export const test = base.extend<{ log: PageLog }>({
  log: async ({ page }, use) => {
    const log: PageLog = { console: [], requests: [] };
    page.on("console", (msg) => log.console.push(msg));
    page.on("request", (req) => log.requests.push(req));
    await use(log);
  },
});

export { expect };
