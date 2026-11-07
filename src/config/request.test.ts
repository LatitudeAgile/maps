import esriConfig from "@arcgis/core/config.js";
import * as urlUtils from "@arcgis/core/core/urlUtils.js";
import { afterEach, describe, expect, test } from "vitest";
import { applyRequest } from "./applyRequest.ts";
import { isProxyUrl, validateRequest } from "./request.ts";
import type { ConfigProblem } from "./types.ts";

function run(raw: unknown) {
  const errors: ConfigProblem[] = [];
  const warnings: ConfigProblem[] = [];
  const request = validateRequest(raw, errors, warnings);
  return { request, errors, warnings, paths: errors.map((e) => e.path) };
}

describe("validateRequest", () => {
  test("absent section means no proxy", () => {
    expect(run(undefined)).toMatchObject({ request: { proxyRules: [] }, errors: [] });
  });

  test("Invalid proxy URL: ftp proxy in a rule is rejected at its path", () => {
    const { paths, request } = run({
      proxyRules: [{ urlPrefix: "https://services.example.com/", proxyUrl: "ftp://proxy.example.com" }],
    });
    expect(paths).toEqual(["request.proxyRules[0].proxyUrl"]);
    expect(request.proxyRules).toEqual([]);
  });

  test("a relative proxy path on this site is accepted", () => {
    const { errors, request } = run({
      proxyUrl: "proxy/forward",
      proxyRules: [{ urlPrefix: "https://services.example.com/", proxyUrl: "/proxy/forward" }],
    });
    expect(errors).toEqual([]);
    expect(request).toEqual({
      proxyUrl: "proxy/forward",
      proxyRules: [{ urlPrefix: "https://services.example.com/", proxyUrl: "/proxy/forward" }],
    });
  });

  test("a missing urlPrefix is rejected", () => {
    expect(run({ proxyRules: [{ proxyUrl: "proxy/forward" }] }).paths).toEqual(["request.proxyRules[0].urlPrefix"]);
  });

  test.each([
    ["http proxy", "http://proxy.example.com/p"],
    ["protocol-relative", "//evil.example.com/p"],
    ["javascript:", "javascript:alert(1)"],
    ["empty", ""],
  ])("%s is not a valid proxy URL", (_label, value) => {
    expect(isProxyUrl(value)).toBe(false);
  });

  test("unknown keys warn", () => {
    expect(run({ alwaysUseProxy: true }).warnings.map((w) => w.path)).toEqual(["request.alwaysUseProxy"]);
  });

  test("non-object section is an error", () => {
    expect(run("proxy").paths).toEqual(["request"]);
  });
});

describe("applyRequest", () => {
  afterEach(() => {
    esriConfig.request.proxyUrl = null;
    esriConfig.request.proxyRules.length = 0;
  });

  test("resolves relative proxy paths against the page base and registers rules with the SDK", () => {
    applyRequest(
      esriConfig,
      { proxyUrl: "proxy/default", proxyRules: [{ urlPrefix: "https://services.example.com/", proxyUrl: "proxy/forward" }] },
      "https://viewer.example.org/app/",
    );
    expect(esriConfig.request.proxyUrl).toBe("https://viewer.example.org/app/proxy/default");
    expect(urlUtils.getProxyRule("https://services.example.com/arcgis/rest/services/x")?.proxyUrl).toBe(
      "https://viewer.example.org/app/proxy/forward",
    );
  });

  test("no request settings leave the SDK unchanged", () => {
    applyRequest(esriConfig, { proxyRules: [] }, "https://viewer.example.org/");
    expect(esriConfig.request.proxyUrl ?? null).toBeNull();
    expect(esriConfig.request.proxyRules).toEqual([]);
  });
});
