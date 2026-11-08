import { describe, expect, test } from "vitest";
import { applySublayerVisibility, type SublayerHost, type SublayerLike } from "./sublayers.ts";

/**
 * A fake map image layer:
 *   0 (group, off) -> 1 (off), 2 (on)
 *   3 (on)
 */
function fakeLayer() {
  const layer: SublayerHost & { subs: Record<number, SublayerLike> } = {
    subs: {},
    findSublayerById(id: number) {
      return this.subs[id];
    },
  };
  const group: SublayerLike = { id: 0, visible: false, parent: layer };
  layer.subs = {
    0: group,
    1: { id: 1, visible: false, parent: group },
    2: { id: 2, visible: true, parent: group },
    3: { id: 3, visible: true, parent: layer },
  };
  return layer;
}

describe("applySublayerVisibility", () => {
  test("hides listed sublayers and leaves the rest as the service has them", () => {
    const layer = fakeLayer();
    applySublayerVisibility({ id: "usa", hideSublayers: [3] }, layer, () => {});
    expect(layer.subs[3].visible).toBe(false);
    expect([layer.subs[0].visible, layer.subs[1].visible, layer.subs[2].visible]).toEqual([false, false, true]);
  });

  test("shows a sublayer that is off by default, and the group above it", () => {
    const layer = fakeLayer();
    applySublayerVisibility({ id: "usa", showSublayers: [1] }, layer, () => {});
    expect(layer.subs[1].visible).toBe(true);
    expect(layer.subs[0].visible).toBe(true);
    // Its sibling keeps the service's setting.
    expect(layer.subs[2].visible).toBe(true);
  });

  test("an id the service doesn't have: one warning naming the layer and the id, and the rest still apply", () => {
    const layer = fakeLayer();
    const warnings: string[] = [];
    const missing = applySublayerVisibility({ id: "usa", showSublayers: [9], hideSublayers: [3] }, layer, (m) => warnings.push(m));
    expect(missing).toEqual([9]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"usa"');
    expect(warnings[0]).toContain("sublayer 9");
    expect(layer.subs[3].visible).toBe(false);
  });

  test("a layer without sublayers is left alone", () => {
    expect(applySublayerVisibility({ id: "x", hideSublayers: [1] }, {} as never, () => {})).toEqual([]);
  });
});
