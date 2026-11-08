import type Layer from "@arcgis/core/layers/Layer.js";
import type { LayerConfig } from "../config/types.ts";

/** The parts of a sublayer this module uses: SDK `Sublayer` satisfies it. */
export interface SublayerLike {
  id: number;
  visible: boolean;
  /** The parent group sublayer, or the layer itself for a top-level sublayer. */
  parent?: unknown;
}

/** The parts of a map image layer this module uses: SDK `MapImageLayer` satisfies it. */
export interface SublayerHost {
  findSublayerById(id: number): SublayerLike | null | undefined;
}

const hasSublayers = (layer: unknown): layer is SublayerHost =>
  typeof (layer as SublayerHost | null)?.findSublayerById === "function";

/**
 * Apply a loaded map image layer's `showSublayers` and `hideSublayers`. Only the listed
 * sublayers change; every other one keeps the service's default, and users can still change any
 * of them in the layer list. Showing a sublayer also shows the groups above it, since a sublayer
 * inside a hidden group draws nothing. Ids the service doesn't have are skipped with a warning
 * naming the layer and the id. Returns those ids.
 */
export function applySublayerVisibility(
  entry: Pick<LayerConfig, "id" | "showSublayers" | "hideSublayers">,
  layer: Layer | SublayerHost,
  warn: (message: string) => void = (m) => console.warn(m),
): number[] {
  const { showSublayers = [], hideSublayers = [] } = entry;
  if (showSublayers.length === 0 && hideSublayers.length === 0) return [];
  if (!hasSublayers(layer)) return [];

  const missing: number[] = [];
  const find = (id: number, setting: string) => {
    const sublayer = layer.findSublayerById(id);
    if (!sublayer) {
      missing.push(id);
      warn(`[viewer] Layer "${entry.id}" has no sublayer ${id}; its ${setting} entry is ignored.`);
    }
    return sublayer ?? undefined;
  };

  for (const id of hideSublayers) {
    const sublayer = find(id, "hideSublayers");
    if (sublayer) sublayer.visible = false;
  }
  for (const id of showSublayers) {
    const sublayer = find(id, "showSublayers");
    if (!sublayer) continue;
    sublayer.visible = true;
    // Groups above it, up to (not including) the layer itself.
    for (let p = sublayer.parent; p && p !== layer && typeof (p as SublayerLike).visible === "boolean"; p = (p as SublayerLike).parent) {
      (p as SublayerLike).visible = true;
    }
  }
  return missing;
}
