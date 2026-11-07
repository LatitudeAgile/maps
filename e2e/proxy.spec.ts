import { test, expect } from "./fixtures.ts";
import { drawnFeatureCount, fixture, mapReady, serveModifiedConfig } from "./helpers.ts";

test("Proxy rule applied: a matching layer's requests go through the proxy with the original URL", async ({ page, log, baseURL }) => {
  const original = "https://services.example.com/data/sites.geojson";
  const proxied: string[] = [];
  // The proxy on the viewer's own site answers with the fixture.
  await page.context().route("**/proxy/forward?**", async (route) => {
    proxied.push(route.request().url());
    await route.fulfill({ contentType: "application/geo+json", body: fixture("points.geojson") });
  });
  // A direct request would mean the rule was ignored: fail it loudly.
  await page.context().route("https://services.example.com/**", (route) => route.abort("blockedbyclient"));
  await serveModifiedConfig(page, (c) => {
    c.request = { proxyRules: [{ urlPrefix: "https://services.example.com/", proxyUrl: "proxy/forward" }] };
    c.layers = [{ id: "sites", type: "geojson", url: original }];
  });
  await page.goto("./");
  await mapReady(page);
  expect(await drawnFeatureCount(page, "sites")).toBe(3);

  const expectedPrefix = new URL("proxy/forward?", baseURL).href;
  expect(proxied.length).toBeGreaterThan(0);
  for (const url of proxied) {
    expect(url.startsWith(expectedPrefix)).toBe(true);
    expect(decodeURIComponent(url.slice(expectedPrefix.length))).toContain(original);
  }
  expect(log.requests.filter((r) => r.url().startsWith("https://services.example.com/"))).toEqual([]);
});
