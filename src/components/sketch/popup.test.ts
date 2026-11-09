import { describe, expect, test } from "vitest";
import Graphic from "@arcgis/core/Graphic.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import { DEFAULT_SKETCH_COLORS } from "./palette.ts";
import { EDIT_SKETCH_ACTION_ID, sketchPopupTemplate } from "./popup.ts";
import { styleSketch } from "./symbols.ts";

describe("sketch popup (map-sketches)", () => {
  const area = () => {
    const g = new Graphic({ geometry: new Polygon({ rings: [[[0, 0], [0, 10], [10, 10], [0, 0]]], spatialReference: { wkid: 3857 } }) });
    styleSketch(g, { color: "#1f5fd1", fillOpacity: 0.25 });
    return g;
  };

  test("the title comes from the graphic, and Edit sketch is its action", () => {
    const template = sketchPopupTemplate(() => DEFAULT_SKETCH_COLORS);
    const title = template.title as unknown as (e: { graphic: Graphic }) => string;
    expect(title({ graphic: area() })).toBe("Sketch");
    expect(template.actions?.map((a) => a.id)).toEqual([EDIT_SKETCH_ACTION_ID]);
    expect(template.actions?.getItemAt(0)?.title).toBe("Edit sketch");
  });
});
