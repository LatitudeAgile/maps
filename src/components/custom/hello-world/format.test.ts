import { describe, expect, test } from "vitest";
import { formatCenter, formatScale } from "./format.ts";

describe("hello-world formatting", () => {
  test("center: longitude, latitude to two decimal places", () => {
    expect(formatCenter(-104.98765, 39.7392)).toBe("-104.99, 39.74");
    expect(formatCenter(0, 0)).toBe("0.00, 0.00");
  });

  test("scale: 1:n, rounded, with thousands separators", () => {
    expect(formatScale(18489297.737236)).toBe("1:18,489,298");
    expect(formatScale(500)).toBe("1:500");
  });
});
