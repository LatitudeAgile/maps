// What the map menu shows for one opening (map-menu; add-map-menu D6): the normalized `mapMenu`
// entries, in order. Built-in and link entries next to each other form one unlabeled group; each
// component entry is its own group, headed with the component's heading. Items that don't apply
// to the spot are left out, and so are empty groups.
import type { MapMenuEntry } from "../../config/mapMenu.ts";
import { itemsForComponent, type MapMenuContext, type MapMenuItem } from "./registry.ts";

export interface MenuGroup {
  /** A component's heading; absent for the built-in and link items. */
  title?: string;
  items: MapMenuItem[];
}

export interface ContentsOptions {
  entries: readonly MapMenuEntry[];
  context: MapMenuContext;
  /** The item for a built-in or link entry. */
  itemFor: (entry: Exclude<MapMenuEntry, { kind: "component" }>) => MapMenuItem;
  /** A component's heading, from its config entry or its type. */
  headingFor: (componentId: string) => string;
}

/** An item is listed unless its `appliesTo` says no. One that throws counts as no, and is logged. */
function applies(item: MapMenuItem, context: MapMenuContext): boolean {
  if (!item.appliesTo) return true;
  try {
    return item.appliesTo(context) === true;
  } catch (error) {
    console.error(`[viewer] The map menu item "${item.label}" failed to say whether it applies here; it is left out.`, error);
    return false;
  }
}

export function menuContents({ entries, context, itemFor, headingFor }: ContentsOptions): MenuGroup[] {
  const groups: MenuGroup[] = [];
  let loose: MenuGroup | undefined;
  for (const entry of entries) {
    if (entry.kind === "component") {
      loose = undefined;
      // A component left out at startup has no element, so no items: skipped without a warning.
      const items = itemsForComponent(entry.id).filter((item) => applies(item, context));
      if (items.length > 0) groups.push({ title: headingFor(entry.id), items });
      continue;
    }
    const item = itemFor(entry);
    if (!applies(item, context)) continue;
    if (!loose) {
      loose = { items: [] };
      groups.push(loose);
    }
    loose.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}
