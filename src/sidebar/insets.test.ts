import { describe, expect, test } from "vitest";
import { computeInsets } from "./insets.ts";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height });
const MAP = box(0, 0, 1280, 800);

describe("computeInsets", () => {
  test("wide, collapsed: the icon bar's right edge", () => {
    expect(computeInsets([box(9, 8, 49, 784)], MAP, true)).toEqual({ start: 58, bottom: 0 });
  });

  test("wide, open: the open panel's right edge", () => {
    expect(computeInsets([box(9, 8, 49, 784), box(58, 8, 256, 784)], MAP, true)).toEqual({ start: 314, bottom: 0 });
  });

  test("narrow: from the top of the bar or panel to the map's bottom", () => {
    const phone = box(0, 0, 375, 667);
    expect(computeInsets([box(0, 619, 375, 48)], phone, false)).toEqual({ start: 0, bottom: 48 });
    expect(computeInsets([box(0, 619, 375, 48), box(0, 300, 375, 319)], phone, false)).toEqual({ start: 0, bottom: 367 });
  });

  test("hidden parts (zero size) are ignored; nothing visible means no inset", () => {
    expect(computeInsets([box(58, 8, 0, 0), box(9, 8, 49, 784)], MAP, true)).toEqual({ start: 58, bottom: 0 });
    expect(computeInsets([], MAP, true)).toEqual({ start: 0, bottom: 0 });
  });
});
