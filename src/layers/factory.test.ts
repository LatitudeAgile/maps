import { beforeAll, describe, expect, test } from "vitest";
import type { LayerConfig, LayerType } from "../config/types.ts";
import { applyDefaultPopup, createLayer, layerProperties } from "./factory.ts";

beforeAll(() => {
  // ImageryLayer's module reads the browser global `self` on import; Node doesn't have it.
  (globalThis as { self?: unknown }).self ??= globalThis;
});

const ITEM = "0123456789abcdef0123456789abcdef";

const entry = (type: LayerType, extra: Partial<LayerConfig> = {}): LayerConfig => ({
  id: `${type}-layer`,
  type,
  options: {},
  hooks: {},
  ...extra,
});

describe("createLayer: Every type is created from its source", () => {
  const cases: [LayerType, Partial<LayerConfig>][] = [
    ["feature", { url: "https://s.example.com/arcgis/rest/services/P/FeatureServer/0" }],
    ["map-image", { url: "https://s.example.com/arcgis/rest/services/D/MapServer" }],
    ["vector-tile", { portalItem: { id: ITEM } }],
    ["tile", { url: "https://s.example.com/arcgis/rest/services/T/MapServer" }],
    ["geojson", { url: "https://viewer.example.org/config/sites.geojson" }],
    ["imagery", { portalItem: { id: ITEM } }],
  ];

  test.each(cases)("%s", async (type, source) => {
    const layer = await createLayer(
      entry(type, { ...source, title: `${type} title`, visible: false, opacity: 0.25 }),
    );
    expect(layer.type).toBe(type);
    expect(layer.id).toBe(`${type}-layer`);
    expect(layer.title).toBe(`${type} title`);
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(0.25);
    const sourced = layer as unknown as { url?: string; layerId?: number; portalItem?: { id: string } };
    // FeatureLayer splits ".../FeatureServer/0" into url ".../FeatureServer" and layerId 0.
    const fullUrl = typeof sourced.layerId === "number" ? `${sourced.url}/${sourced.layerId}` : sourced.url;
    if (source.url) expect(fullUrl).toBe(source.url);
    else expect(sourced.portalItem?.id).toBe(ITEM);
  });
});

describe("options pass-through", () => {
  test("Definition expression applied", async () => {
    const layer = await createLayer(
      entry("feature", {
        url: "https://s.example.com/arcgis/rest/services/P/FeatureServer/0",
        options: { definitionExpression: "STATUS = 'Open'" },
      }),
    );
    expect((layer as unknown as { definitionExpression: string }).definitionExpression).toBe("STATUS = 'Open'");
  });

  test("entry fields win over options", () => {
    const props = layerProperties(entry("feature", { url: "https://a.example.com/x", options: { id: "other", url: "https://b" } }));
    expect(props.id).toBe("feature-layer");
    expect(props.url).toBe("https://a.example.com/x");
  });
});

describe("popup settings (design D3)", () => {
  const popupLayer = (template?: unknown) => {
    const layer = { popupTemplate: template, createPopupTemplate: () => ({ title: "default" }) };
    return layer as unknown as import("@arcgis/core/layers/Layer.js").default & { popupTemplate: unknown };
  };

  test.each(["feature", "geojson", "imagery"] as const)("%s gets a default popup template after load", (type) => {
    const layer = popupLayer();
    applyDefaultPopup(entry(type, { url: "https://x.example.com" }), layer);
    expect(layer.popupTemplate).toEqual({ title: "default" });
  });

  test("popupEnabled false: no template, and popups are turned off on the layer", () => {
    const layer = popupLayer();
    const e = entry("geojson", { url: "https://x.example.com", popupEnabled: false });
    applyDefaultPopup(e, layer);
    expect(layer.popupTemplate).toBeUndefined();
    expect(layerProperties(e).popupEnabled).toBe(false);
  });

  test("an existing template (for example from options) is kept", () => {
    const layer = popupLayer({ title: "custom" });
    applyDefaultPopup(entry("feature", { url: "https://x.example.com" }), layer);
    expect(layer.popupTemplate).toEqual({ title: "custom" });
  });

  test.each(["map-image", "vector-tile", "tile"] as const)("%s gets no default popup", (type) => {
    const layer = popupLayer();
    applyDefaultPopup(entry(type, { url: "https://x.example.com" }), layer);
    expect(layer.popupTemplate).toBeUndefined();
    expect(layerProperties(entry(type, { url: "https://x.example.com" }))).not.toHaveProperty("popupEnabled");
  });
});
