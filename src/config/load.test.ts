import { describe, expect, test, vi } from "vitest";
import { configUrl, loadConfig } from "./load.ts";

const doc = "https://viewer.example.org/apps/viewer/index.html";

function fakeFetch(body: string, init: ResponseInit = { status: 200 }) {
  return vi.fn<typeof fetch>(async () => new Response(body, init));
}

describe("configUrl", () => {
  test("resolves against the Vite base URL", () => {
    expect(configUrl("/", doc)).toBe("https://viewer.example.org/config/viewer.json");
    expect(configUrl("./", doc)).toBe("https://viewer.example.org/apps/viewer/config/viewer.json");
    expect(configUrl("/apps/viewer/", doc)).toBe(
      "https://viewer.example.org/apps/viewer/config/viewer.json",
    );
  });
});

describe("loadConfig", () => {
  const url = "https://viewer.example.org/config/viewer.json";

  test("returns the parsed config", async () => {
    const fetch = fakeFetch('{"map":{"zoom":3}}');
    const result = await loadConfig({ fetch, baseUrl: "/", documentUrl: doc });
    expect(result).toEqual({ ok: true, url, raw: { map: { zoom: 3 } } });
    expect(fetch).toHaveBeenCalledWith(url, { cache: "no-cache" });
  });

  test("Config file missing: reports the URL and the 404 status", async () => {
    const fetch = fakeFetch("Not found", { status: 404, statusText: "Not Found" });
    const result = await loadConfig({ fetch, baseUrl: "/", documentUrl: doc });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.url).toBe(url);
    expect(result.message).toContain(url);
    expect(result.message).toContain("404");
  });

  test("Malformed JSON: says the config is not valid JSON", async () => {
    const fetch = fakeFetch('{ "map": { "zoom": 5, } }');
    const result = await loadConfig({ fetch, baseUrl: "/", documentUrl: doc });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(url);
    expect(result.message).toMatch(/not valid JSON/);
  });

  test("network failure: reports the URL and the reason", async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await loadConfig({ fetch: failing, baseUrl: "/", documentUrl: doc });
    expect(result).toEqual({
      ok: false,
      url,
      message: `Could not load the config from ${url}: Failed to fetch`,
    });
  });
});
