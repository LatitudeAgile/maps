/**
 * How a component option's config value is checked and applied. `layer` and `layer[]`
 * options take layer ids from `layers`, resolved to the created layers. `layer-info[]` takes
 * `{ layer: <id>, title?: <text> }` entries, resolved to `{ layer: <Layer>, title }` (the SDK's
 * LayerInfo shape, used by the legend).
 */
export type OptionKind = "string" | "number" | "boolean" | "layer" | "layer[]" | "layer-info[]";

/** What validation needs to know about a component type. */
export interface ComponentTypeSchema {
  /** Supported options and their kinds; anything else is warned about and dropped. */
  options: Readonly<Record<string, OptionKind>>;
}

/** A registered component type: a map component, loaded on first use. */
export interface ComponentType extends ComponentTypeSchema {
  /** Custom element tag. */
  tag: string;
  /** Import that defines the element. */
  load: () => Promise<unknown>;
  /** Sidebar heading and Calcite icon when placed in `panel` without its own `panel` settings. */
  panel: { heading: string; icon: string };
}

/**
 * Component types a config can use under `components[].type`. Later changes register more here
 * (add-map-controls: locate, basemap-toggle).
 */
export const COMPONENT_TYPES: Readonly<Record<string, ComponentType>> = {
  home: {
    tag: "arcgis-home",
    load: () => import("@arcgis/map-components/components/arcgis-home"),
    // `label` is deliberately absent: arcgis-home 5.2 doesn't use it for the button's name
    // (it stays "Home"), so it would be a setting with no visible effect.
    options: { icon: "string" },
    panel: { heading: "Home", icon: "home" },
  },
  legend: {
    tag: "arcgis-legend",
    load: () => import("@arcgis/map-components/components/arcgis-legend"),
    options: { layerInfos: "layer-info[]", basemapLegendVisible: "boolean", hideLayersNotInCurrentView: "boolean" },
    panel: { heading: "Legend", icon: "legend" },
  },
};
