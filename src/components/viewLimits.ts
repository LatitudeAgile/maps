import { viewsText } from "../config/components.ts";
import type { ComponentConfig, MapViewKind } from "../config/types.ts";
import { COMPONENT_TYPES, type ComponentType } from "./registry.ts";

/**
 * In an app opened from an item, leave out the components whose type doesn't work in the
 * item's view (map-components; add-web-maps-and-scenes D8). Validation can't do this, because
 * the view is known only once the item has been read. Runs before the sidebar is built, so a
 * left-out panel never gets an icon. Returns the kept entries and one console warning for each
 * left-out one.
 */
export function applyViewLimits(
  entries: readonly ComponentConfig[],
  view: MapViewKind,
  types: Readonly<Record<string, ComponentType>> = COMPONENT_TYPES,
): { kept: ComponentConfig[]; warnings: string[] } {
  const kept: ComponentConfig[] = [];
  const warnings: string[] = [];
  for (const entry of entries) {
    const views = Object.hasOwn(types, entry.type) ? types[entry.type].views : undefined;
    if (!views || views.includes(view)) {
      kept.push(entry);
      continue;
    }
    const itemKind = view === "3d" ? "web scene, which opens in 3D" : "web map, which opens in 2D";
    warnings.push(`[viewer] components "${entry.id}" is left out because the "${entry.type}" component works only in ${viewsText(views)}, and this app's item is a ${itemKind}.`);
  }
  return { kept, warnings };
}
