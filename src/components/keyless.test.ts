import { describe, expect, test } from "vitest";
import type { ComponentConfig } from "../config/types.ts";
import { applyKeyless, leftOutWarning } from "./keyless.ts";
import type { ComponentType } from "./registry.ts";

const entry = (id: string, type: string, options: Record<string, unknown> = {}): ComponentConfig => ({
  id,
  type,
  placement: "panel",
  options,
});

const base = { tag: "x-test", load: async () => undefined, options: {}, panel: { heading: "T", icon: "t" } };
const TYPES: Record<string, ComponentType> = {
  plain: base,
  trims: { ...base, keyless: (o) => ({ keep: { ...o, list: (o.list as string[]).filter((v) => v !== "keyed") } }) },
  needs: { ...base, keyless: () => ({ leaveOut: "it needs a key" }) },
};

describe("applyKeyless (design D2)", () => {
  test("without a key: types without a hook are kept, hooks trim or leave out", () => {
    const { kept, leftOut } = applyKeyless(
      [entry("a", "plain"), entry("b", "trims", { list: ["free", "keyed"] }), entry("c", "needs")],
      false,
      TYPES,
    );
    expect(kept.map((e) => e.id)).toEqual(["a", "b"]);
    expect(kept[1].options).toEqual({ list: ["free"] });
    expect(leftOut).toEqual([{ entry: entry("c", "needs"), reason: "it needs a key" }]);
  });

  test("with a key: every entry is kept unchanged", () => {
    const entries = [entry("b", "trims", { list: ["free", "keyed"] }), entry("c", "needs")];
    const { kept, leftOut } = applyKeyless(entries, true, TYPES);
    expect(kept).toEqual(entries);
    expect(leftOut).toEqual([]);
  });

  test("the shipped basemap toggle leaves out a style next basemap and keeps a free one", () => {
    const { kept, leftOut } = applyKeyless(
      [
        entry("styled", "basemap-toggle", { nextBasemap: "arcgis/imagery/standard" }),
        entry("free", "basemap-toggle", { nextBasemap: "hybrid" }),
      ],
      false,
    );
    expect(kept.map((e) => e.id)).toEqual(["free"]);
    expect(leftOut.map((l) => l.entry.id)).toEqual(["styled"]);
    expect(leftOutWarning(leftOut[0])).toContain('next basemap "arcgis/imagery/standard" needs an API key');
    expect(leftOutWarning(leftOut[0])).toContain("basemap toggle");
  });
});
