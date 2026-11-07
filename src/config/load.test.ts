import { describe, expect, test, vi } from "vitest";
import { configName, configUrl, loadConfig } from "./load.ts";

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

describe("configName (?config=)", () => {
  test("absent parameter means the default config", () => {
    expect(configName("")).toBe("viewer");
    expect(configName("?other=1")).toBe("viewer");
  });

  test("a plain name is accepted", () => {
    expect(configName("?config=county")).toBe("county");
    expect(configName("?config=North_County-2")).toBe("North_County-2");
  });

  test.each([
    ["path traversal", "?config=../secrets"],
    ["absolute URL", `?config=${encodeURIComponent("https://example.com/viewer.json")}`],
    ["sub-path", "?config=configs/county"],
    ["empty", "?config="],
    ["over 64 characters", `?config=${"a".repeat(65)}`],
  ])("%s is rejected", (_label, search) => {
    expect(configName(search)).toBeUndefined();
  });
});

describe("loadConfig with ?config=", () => {
  test("a valid name loads config/<name>.json", async () => {
    const fetch = fakeFetch('{"map":{}}');
    const result = await loadConfig({ fetch, baseUrl: "/", documentUrl: doc, search: "?config=county" });
    expect(result).toMatchObject({ ok: true, url: "https://viewer.example.org/config/county.json" });
  });

  test.each(["?config=../secrets", "?config=https%3A%2F%2Fexample.com%2Fviewer.json", `?config=${"a".repeat(65)}`])(
    "a rejected value (%s) names the parameter and makes no request",
    async (search) => {
      const fetch = fakeFetch("{}");
      const result = await loadConfig({ fetch, baseUrl: "/", documentUrl: doc, search });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain('"config" URL parameter');
      expect(result.url).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
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
