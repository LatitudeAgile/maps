import { describe, expect, test } from "vitest";
import { contrastRatio, formatRatio, normalizeHex, parseHex, resolveTextColor } from "../ui/theme.ts";
import { validateConfig } from "./validate.ts";

const minimal = () => ({ map: { basemap: "osm", center: [-98.5, 39.8], zoom: 5 } });
const withTheme = (theme: unknown) => validateConfig({ ...minimal(), app: { theme } });
const paths = (problems: { path: string }[]) => problems.map((p) => p.path);

describe("color helpers (design D5)", () => {
  test("parseHex reads #rgb and #rrggbb, any case, and rejects anything else", () => {
    expect(parseHex("#1f6f8b")).toEqual([31, 111, 139]);
    expect(parseHex("#FFF")).toEqual([255, 255, 255]);
    for (const bad of ["teal", "1f6f8b", "#12345", "#1f6f8g", "rgb(0,0,0)", 5, undefined]) expect(parseHex(bad), String(bad)).toBeUndefined();
  });

  test("normalizeHex gives lowercase #rrggbb", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#1F6F8B")).toBe("#1f6f8b");
  });

  test("contrastRatio follows WCAG 2.x (reference values from the design)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#3a9fc0", "#ffffff")).toBeCloseTo(3.04, 2);
    expect(contrastRatio("#1f6f8b", "#ffffff")).toBeCloseTo(5.67, 2);
    expect(contrastRatio("#f5f5f5", "#000000")).toBeCloseTo(19.26, 2);
  });

  test("Dark color: white text", () => expect(resolveTextColor("#1f6f8b")).toBe("#ffffff"));
  test("Light color: black text", () => expect(resolveTextColor("#f5f5f5")).toBe("#000000"));

  test("formatRatio rounds down, so a ratio just under 4.5 never reads as 4.5", () => {
    expect(formatRatio(3.04)).toBe("3.0:1");
    expect(formatRatio(4.46)).toBe("4.4:1");
  });
});

describe("app.theme validation (branding)", () => {
  test("Valid theme: passes with no warning, text color resolved", () => {
    const { config, errors, warnings } = withTheme({ color: "#1f6f8b", opacity: 0.85 });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config?.app.theme).toEqual({ color: "#1f6f8b", opacity: 0.85, textColor: "#ffffff" });
  });

  test("opacity defaults to 1", () => {
    expect(withTheme({ color: "#1f6f8b" }).config?.app.theme?.opacity).toBe(1);
  });

  test("No theme: none in the config", () => {
    expect(validateConfig(minimal()).config?.app.theme).toBeUndefined();
  });

  test("Color missing", () => {
    const { errors } = withTheme({ opacity: 0.5 });
    expect(paths(errors)).toEqual(["app.theme.color"]);
    expect(errors[0].message).toMatch(/Required.*hex color/);
  });

  test("Not a hex color", () => {
    const { errors } = withTheme({ color: "teal" });
    expect(paths(errors)).toEqual(["app.theme.color"]);
    expect(errors[0].message).toBe("Expected a hex color such as #1f6f8b.");
  });

  test("Opacity out of range", () => {
    for (const opacity of [1.5, -0.1, "0.5"]) {
      const { errors } = withTheme({ color: "#1f6f8b", opacity });
      expect(paths(errors), String(opacity)).toEqual(["app.theme.opacity"]);
      expect(errors[0].message).toBe("Expected a number from 0 to 1.");
    }
  });

  test("textColor must be a hex color too", () => {
    expect(paths(withTheme({ color: "#1f6f8b", textColor: "white" }).errors)).toEqual(["app.theme.textColor"]);
  });

  test("Not an object", () => {
    expect(paths(withTheme("#1f6f8b").errors)).toEqual(["app.theme"]);
  });

  test("Unknown theme key: one warning naming it", () => {
    const { errors, warnings } = withTheme({ color: "#1f6f8b", font: "Arial" });
    expect(errors).toEqual([]);
    expect(paths(warnings)).toEqual(["app.theme.font"]);
  });

  test("White on light teal: one warning giving 3.0:1", () => {
    const { config, errors, warnings } = withTheme({ color: "#3a9fc0", textColor: "#ffffff" });
    expect(errors).toEqual([]);
    expect(paths(warnings)).toEqual(["app.theme.textColor"]);
    expect(warnings[0].message).toContain("3.0:1");
    expect(config?.app.theme?.textColor).toBe("#ffffff");
  });

  test("Sufficient contrast: no warning", () => {
    const { errors, warnings } = withTheme({ color: "#1f6f8b", textColor: "#FFFFFF" });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
