import type ElevationLayer from "@arcgis/core/layers/ElevationLayer.js";
import type Layer from "@arcgis/core/layers/Layer.js";
import type { AppModel } from "../app/AppModel.ts";
import { errorText } from "../app/errors.ts";
import { isLayerType3dOnly, type LayerConfig, type MapViewKind } from "../config/types.ts";
import { hooks as builtInHooks, type LayerHook } from "../extensions/hooks.ts";
import { applyDefaultPopup, createLayer } from "./factory.ts";
import { applySublayerVisibility } from "./sublayers.ts";

/** How long to wait for layers before creating components anyway (design D5). */
export const SETTLE_TIMEOUT_MS = 15_000;

/** The part of the SDK Map the stage uses. */
export interface LayerHost {
  addMany(layers: Layer[]): unknown;
  /** In 3D, where `elevation` layers go (map-scenes, design D5). */
  ground?: { layers: { addMany(layers: ElevationLayer[]): unknown } } | null;
}

export interface AddLayersOptions {
  entries: LayerConfig[];
  map: LayerHost;
  app: AppModel;
  create?: (entry: LayerConfig) => Promise<Layer>;
  hooks?: Record<string, LayerHook>;
  settleTimeoutMs?: number;
  /**
   * The layers of the map's item, already on the map. They count toward the settle wait, and
   * their failures are reported by title (add-web-maps-and-scenes D7).
   */
  itemLayers?: Layer[];
  /** The app's view. In 2D (a web map item), 3D-only entries fail without being created. */
  view?: MapViewKind;
}

export interface AddLayersResult {
  /** Ids of config layers that failed to load, or hadn't loaded when waiting stopped. */
  failed: string[];
  /** Titles of the item's layers that failed, or hadn't loaded when waiting stopped. */
  failedItemLayers: string[];
}

const source = (id: string) => `layer:${id}`;
const itemSource = (title: string) => `item-layer:${title}`;
/** How an item layer is named to the user: its title, or its id when it has none. */
const itemLayerName = (layer: Layer) => layer.title || layer.id;

/**
 * The layer stage (design D3–D5): create every layer, run `preLoad` hooks, add them so the
 * first entry draws on top, then wait (at most `settleTimeoutMs`) for each to load, running
 * `onLoad` hooks as they do. Never throws; problems go to the app model's error channel.
 */
export async function addLayers(options: AddLayersOptions): Promise<AddLayersResult> {
  const { entries, map, app, create = createLayer, hooks = builtInHooks } = options;
  const settleTimeoutMs = options.settleTimeoutMs ?? SETTLE_TIMEOUT_MS;
  const failed = new Set<string>();

  const runHook = async (kind: "preLoad" | "onLoad", entry: LayerConfig, layer: Layer) => {
    const name = entry.hooks[kind];
    const hook = name ? hooks[name] : undefined;
    if (!hook) return;
    try {
      await hook(layer, { app, entry });
    } catch (err) {
      app.errors.report({
        source: source(entry.id),
        message: `The ${kind} hook "${name}" failed for layer "${entry.id}".`,
        detail: errorText(err),
      });
    }
  };

  // 1. Create, in config order. A 3D-only type in a 2D app (a web map item: validation can't
  // know the item's type) fails without being created (D7).
  const created: { entry: LayerConfig; layer: Layer }[] = [];
  for (const entry of entries) {
    if (options.view === "2d" && isLayerType3dOnly(entry.type)) {
      failed.add(entry.id);
      app.errors.report({ source: source(entry.id), message: `Layer "${entry.id}" needs a 3D scene, but the app's web map is 2D.` });
      continue;
    }
    try {
      created.push({ entry, layer: await create(entry) });
    } catch (err) {
      failed.add(entry.id);
      app.errors.report({ source: source(entry.id), message: `Layer "${entry.id}" could not be created.`, detail: errorText(err) });
    }
  }

  // 2. preLoad hooks run before the layer is on the map.
  for (const { entry, layer } of created) await runHook("preLoad", entry, layer);

  // 3. map.layers index 0 draws at the bottom, so add in reverse: the first entry ends up on top.
  // Elevation layers go into the ground instead, in the same order (design D5).
  const reversed = [...created].reverse();
  map.addMany(reversed.filter((c) => c.entry.type !== "elevation").map((c) => c.layer));
  const elevation = reversed.filter((c) => c.entry.type === "elevation").map((c) => c.layer as ElevationLayer);
  if (elevation.length > 0) map.ground?.layers.addMany(elevation);
  for (const record of created) app.addLayer(record);

  // 4. Wait for loads; onLoad runs after each load, even one that finishes after the wait ends.
  // The item's layers are waited for alongside (D7).
  const itemLayers = options.itemLayers ?? [];
  const failedItem = new Set<Layer>();
  const pendingItem = new Set<Layer>(itemLayers);
  const itemLoads = itemLayers.map((layer) =>
    layer.load().then(
      () => {
        pendingItem.delete(layer);
      },
      (err: unknown) => {
        pendingItem.delete(layer);
        failedItem.add(layer);
        const name = itemLayerName(layer);
        app.errors.report({ source: itemSource(name), message: `The item's layer "${name}" failed to load.`, detail: errorText(err) });
      },
    ),
  );
  const pending = new Set(created.map((c) => c.entry.id));
  const loads = created.map(({ entry, layer }) =>
    layer.load().then(
      async () => {
        pending.delete(entry.id);
        applyDefaultPopup(entry, layer);
        // Before onLoad, so hooks see the configured sublayer visibility.
        applySublayerVisibility(entry, layer);
        await runHook("onLoad", entry, layer);
      },
      (err: unknown) => {
        pending.delete(entry.id);
        failed.add(entry.id);
        app.errors.report({ source: source(entry.id), message: `Layer "${entry.id}" failed to load.`, detail: errorText(err) });
      },
    ),
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = await Promise.race([
    Promise.all([...loads, ...itemLoads]).then(() => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), settleTimeoutMs);
    }),
  ]);
  clearTimeout(timer);

  if (timedOut) {
    for (const id of pending) {
      failed.add(id);
      app.errors.report({
        source: source(id),
        message: `Layer "${id}" had not loaded after ${settleTimeoutMs / 1000} seconds; continuing without it.`,
      });
    }
  }

  if (timedOut) {
    for (const layer of pendingItem) {
      failedItem.add(layer);
      const name = itemLayerName(layer);
      app.errors.report({ source: itemSource(name), message: `The item's layer "${name}" had not loaded after ${settleTimeoutMs / 1000} seconds; continuing without it.` });
    }
  }

  // Report in config order, then the item's order.
  return {
    failed: entries.map((e) => e.id).filter((id) => failed.has(id)),
    failedItemLayers: itemLayers.filter((l) => failedItem.has(l)).map(itemLayerName),
  };
}
