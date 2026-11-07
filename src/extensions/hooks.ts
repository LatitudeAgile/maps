import type Layer from "@arcgis/core/layers/Layer.js";
import type { AppModel } from "../app/AppModel.ts";
import type { LayerConfig } from "../config/types.ts";

/** What a hook receives besides the layer. */
export interface HookContext {
  app: AppModel;
  /** The layer's validated config entry. */
  entry: LayerConfig;
}

/**
 * A layer hook (design D4). `preLoad` hooks run after the layer is created and before it is
 * added to the map; `onLoad` hooks run once, after the layer loads. Thrown errors and
 * rejections are reported on the error channel; the layer stays on the map.
 */
export type LayerHook = (layer: Layer, context: HookContext) => void | Promise<void>;

/**
 * Hooks a config can name under `layers[].hooks`. Add an entry here to make a hook available.
 * See docs/extensions.md.
 */
export const hooks: Record<string, LayerHook> = {};
