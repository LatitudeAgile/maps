import type Layer from "@arcgis/core/layers/Layer.js";
import type { LayerConfig, LayerType } from "../config/types.ts";

type LayerClass = new (properties: Record<string, unknown>) => Layer;
export type LayerLoaders = Record<LayerType, () => Promise<LayerClass>>;

/** Each type's SDK class, imported only when a config uses that type (design D3). */
export const LAYER_LOADERS: LayerLoaders = {
  feature: async () => (await import("@arcgis/core/layers/FeatureLayer.js")).default as unknown as LayerClass,
  "map-image": async () => (await import("@arcgis/core/layers/MapImageLayer.js")).default as unknown as LayerClass,
  "vector-tile": async () => (await import("@arcgis/core/layers/VectorTileLayer.js")).default as unknown as LayerClass,
  tile: async () => (await import("@arcgis/core/layers/TileLayer.js")).default as unknown as LayerClass,
  geojson: async () => (await import("@arcgis/core/layers/GeoJSONLayer.js")).default as unknown as LayerClass,
  imagery: async () => (await import("@arcgis/core/layers/ImageryLayer.js")).default as unknown as LayerClass,
  // 3D only (map-scenes).
  scene: async () => (await import("@arcgis/core/layers/SceneLayer.js")).default as unknown as LayerClass,
  "building-scene": async () => (await import("@arcgis/core/layers/BuildingSceneLayer.js")).default as unknown as LayerClass,
  "point-cloud": async () => (await import("@arcgis/core/layers/PointCloudLayer.js")).default as unknown as LayerClass,
  "integrated-mesh": async () => (await import("@arcgis/core/layers/IntegratedMeshLayer.js")).default as unknown as LayerClass,
  elevation: async () => (await import("@arcgis/core/layers/ElevationLayer.js")).default as unknown as LayerClass,
};

/** Types that get a default popup listing all attributes (map-layers, P-06; `scene`: map-scenes). */
const DEFAULT_POPUP_TYPES: ReadonlySet<LayerType> = new Set(["feature", "geojson", "imagery", "scene"]);

/**
 * Constructor properties for a layer entry. `options` pass through, but the entry's own
 * fields (id, source, title, visibility, opacity) always win over them.
 */
export function layerProperties(entry: LayerConfig): Record<string, unknown> {
  const popup: Record<string, unknown> = {};
  if (DEFAULT_POPUP_TYPES.has(entry.type) && entry.popupEnabled === false) popup.popupEnabled = false;
  return {
    ...popup,
    ...entry.options,
    id: entry.id,
    ...(entry.url !== undefined ? { url: entry.url } : {}),
    ...(entry.portalItem ? { portalItem: { id: entry.portalItem.id } } : {}),
    ...(entry.title !== undefined ? { title: entry.title } : {}),
    ...(entry.visible !== undefined ? { visible: entry.visible } : {}),
    ...(entry.opacity !== undefined ? { opacity: entry.opacity } : {}),
  };
}

interface PopupCapable {
  popupTemplate?: unknown;
  createPopupTemplate?: () => unknown;
}

/**
 * After a layer loads, give it a default popup template listing all attributes, unless the
 * entry turns popups off or a template is already set (for example through `options`).
 * Set explicitly because the Popup component ignores the layer's
 * `defaultPopupTemplateEnabled` on click (observed with SDK 5.2).
 */
export function applyDefaultPopup(entry: LayerConfig, layer: Layer): void {
  if (!DEFAULT_POPUP_TYPES.has(entry.type) || entry.popupEnabled === false) return;
  const target = layer as unknown as PopupCapable;
  if (target.popupTemplate || typeof target.createPopupTemplate !== "function") return;
  target.popupTemplate = target.createPopupTemplate();
}

/** Create (but don't load) the SDK layer for a validated entry. */
export async function createLayer(entry: LayerConfig, loaders: LayerLoaders = LAYER_LOADERS): Promise<Layer> {
  const LayerClass = await loaders[entry.type]();
  return new LayerClass(layerProperties(entry));
}
