import type Layer from "@arcgis/core/layers/Layer.js";
import type { AppModel } from "../app/AppModel.ts";
import { errorText } from "../app/errors.ts";
import type { LayerConfig } from "../config/types.ts";
import { hooks as builtInHooks, type LayerHook } from "../extensions/hooks.ts";
import { applyDefaultPopup, createLayer } from "./factory.ts";
import { applySublayerVisibility } from "./sublayers.ts";

/** How long to wait for layers before creating components anyway (design D5). */
export const SETTLE_TIMEOUT_MS = 15_000;

/** The part of the SDK Map the stage uses. */
export interface LayerHost {
  addMany(layers: Layer[]): unknown;
}

export interface AddLayersOptions {
  entries: LayerConfig[];
  map: LayerHost;
  app: AppModel;
  create?: (entry: LayerConfig) => Promise<Layer>;
  hooks?: Record<string, LayerHook>;
  settleTimeoutMs?: number;
}

export interface AddLayersResult {
  /** Ids of layers that failed to load, or hadn't loaded when waiting stopped. */
  failed: string[];
}

const source = (id: string) => `layer:${id}`;

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

  // 1. Create, in config order.
  const created: { entry: LayerConfig; layer: Layer }[] = [];
  for (const entry of entries) {
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
  map.addMany([...created].reverse().map((c) => c.layer));
  for (const record of created) app.addLayer(record);

  // 4. Wait for loads; onLoad runs after each load, even one that finishes after the wait ends.
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
    Promise.all(loads).then(() => false),
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

  // Report in config order.
  return { failed: entries.map((e) => e.id).filter((id) => failed.has(id)) };
}
