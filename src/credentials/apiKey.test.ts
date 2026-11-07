import esriConfig from "@arcgis/core/config.js";
import { afterEach, describe, expect, test } from "vitest";
import { applyApiKey, readApiKey } from "./apiKey.ts";

describe("readApiKey", () => {
  test("Key provided: a non-empty value counts as a configured credential", () => {
    expect(readApiKey("AAPTxyz")).toBe("AAPTxyz");
    expect(readApiKey("  AAPTxyz \n")).toBe("AAPTxyz");
  });

  test("Blank key: absent, empty, or whitespace-only means no key", () => {
    expect(readApiKey(undefined)).toBeUndefined();
    expect(readApiKey("")).toBeUndefined();
    expect(readApiKey("   ")).toBeUndefined();
    expect(readApiKey("\t\n ")).toBeUndefined();
  });
});

describe("applyApiKey against @arcgis/core/config", () => {
  afterEach(() => {
    esriConfig.apiKeys.basemapStyles = undefined;
    esriConfig.apiKey = null;
  });

  test("a present key goes only to apiKeys.basemapStyles; global apiKey stays unset", () => {
    expect(esriConfig.apiKey ?? undefined).toBeUndefined();
    applyApiKey(esriConfig, "AAPTxyz");
    expect(esriConfig.apiKeys.basemapStyles).toBe("AAPTxyz");
    expect(esriConfig.apiKey ?? undefined).toBeUndefined();
    expect(esriConfig.apiKeys.scopes ?? []).toEqual([]);
  });

  test("no key leaves both unset", () => {
    applyApiKey(esriConfig, undefined);
    expect(esriConfig.apiKeys.basemapStyles).toBeUndefined();
    expect(esriConfig.apiKey ?? undefined).toBeUndefined();
  });
});
