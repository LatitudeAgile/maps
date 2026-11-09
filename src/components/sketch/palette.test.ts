import { describe, expect, test } from "vitest";
import {
  addColorProblem,
  addCustomColor,
  chosenColor,
  cleanCustomColors,
  colorName,
  DEFAULT_SKETCH_COLORS,
  MAX_CUSTOM_COLORS,
  normalizeHex,
  removeCustomColor,
} from "./palette.ts";

const C = DEFAULT_SKETCH_COLORS;
const six = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"];

describe("sketch palette (map-sketches)", () => {
  test("the default colors are Red, Blue, Green, Orange and Black, red first", () => {
    expect(C.map((c) => c.name)).toEqual(["Red", "Blue", "Green", "Orange", "Black"]);
    expect(MAX_CUSTOM_COLORS).toBe(6);
  });

  test.each([
    ["#D7263D", "#d7263d"],
    ["d7263d", "#d7263d"],
    ["  #abcdef ", "#abcdef"],
    ["#abc", null],
    ["red", null],
    [5, null],
  ])("normalizeHex(%j) is %j", (value, expected) => {
    expect(normalizeHex(value)).toBe(expected);
  });

  test("adding puts the color at the end, in lowercase", () => {
    expect(addCustomColor("#FF00FF", C, ["#123456"])).toEqual(["#123456", "#ff00ff"]);
  });

  test("A color that's already there: refused, whether configured or added", () => {
    expect(addColorProblem("#D7263D", C, [])).toBe("That color is already on the strip.");
    expect(addColorProblem("#123456", C, ["#123456"])).toBe("That color is already on the strip.");
    expect(addCustomColor("#d7263d", C, [])).toEqual([]);
  });

  test("Six added colors: a seventh is refused", () => {
    expect(addColorProblem("#777777", C, six)).toMatch(/Up to 6 added colors/);
    expect(addCustomColor("#777777", C, six)).toEqual(six);
  });

  test("removing takes only that color off", () => {
    expect(removeCustomColor("#333333", six)).toEqual(["#111111", "#222222", "#444444", "#555555", "#666666"]);
  });

  test("remembered added colors are cleaned: invalid, duplicate, configured and extra ones dropped", () => {
    expect(cleanCustomColors(["#111111", "bad", "#111111", "#D7263D", ...six, "#999999"], C)).toEqual(six);
    expect(cleanCustomColors("nope", C)).toEqual([]);
  });

  test("The chosen color is remembered while on the strip; otherwise the first color", () => {
    expect(chosenColor("#1a9e3f", C, [])).toBe("#1a9e3f");
    expect(chosenColor("#123456", C, ["#123456"])).toBe("#123456");
    expect(chosenColor("#123456", C, [])).toBe("#d7263d");
    expect(chosenColor(null, C, [])).toBe("#d7263d");
  });

  test("colorName names configured colors only", () => {
    expect(colorName("#1f5fd1", C)).toBe("Blue");
    expect(colorName("#ff00ff", C)).toBeUndefined();
  });
});
