import type { ConfigurableElement } from "./registry.ts";

interface LayerListItemEvent {
  item: { layer?: { type?: string } | null; open: boolean };
}

/**
 * Applies the layer list's options. A type with `configure` sets its own options, so the SDK's
 * options pass through as properties. `openGroups` isn't the SDK's: it opens each group layer's
 * row when the row is first listed, including groups added after the app starts.
 */
export function configureLayerList(element: ConfigurableElement, options: Readonly<Record<string, unknown>>): void {
  for (const [name, value] of Object.entries(options)) {
    if (name !== "openGroups") element[name] = value;
  }
  if (options.openGroups === true) {
    element.listItemCreatedFunction = ({ item }: LayerListItemEvent) => {
      if (item.layer?.type === "group") item.open = true;
    };
  }
}
