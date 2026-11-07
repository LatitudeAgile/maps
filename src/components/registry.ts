/**
 * How a component option's config value is checked and applied. `layer` and `layer[]`
 * options take layer ids from `layers`, resolved to the created layers. `layer-info[]` takes
 * `{ layer: <id>, title?: <text> }` entries, resolved to `{ layer: <Layer>, title }` (the SDK's
 * LayerInfo shape, used by the legend). `scale` is a number greater than 0. `basemap` is a
 * non-empty basemap ID; legacy IDs are accepted with a warning, as in `map.basemap`.
 */
export type OptionKind = "string" | "number" | "boolean" | "scale" | "basemap" | "layer" | "layer[]" | "layer-info[]";

/** What validation needs to know about a component type. */
export interface ComponentTypeSchema {
  /** Supported options and their kinds; anything else is warned about and dropped. */
  options: Readonly<Record<string, OptionKind>>;
  /** Values for options the config leaves out, filled in by validation (design D1). */
  defaults?: Readonly<Record<string, unknown>>;
}

/** A registered component type: a map component, loaded on first use. */
export interface ComponentType extends ComponentTypeSchema {
  /** Custom element tag. */
  tag: string;
  /** Import that defines the element. */
  load: () => Promise<unknown>;
  /** Sidebar heading and Calcite icon when placed in `panel` without its own `panel` settings. */
  panel: { heading: string; icon: string };
  /** The element emits `arcgisError` with a GeolocationPositionError, shown to the user (D3). */
  reportsLocationErrors?: boolean;
}

/** Component types a config can use under `components[].type`. */
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
  // Panel icons are each component's own default icon (design D2).
  locate: {
    tag: "arcgis-locate",
    load: () => import("@arcgis/map-components/components/arcgis-locate"),
    options: { scale: "scale", icon: "string", popupDisabled: "boolean" },
    panel: { heading: "Locate", icon: "gps-off" },
    reportsLocationErrors: true,
  },
  track: {
    tag: "arcgis-track",
    load: () => import("@arcgis/map-components/components/arcgis-track"),
    options: { scale: "scale", icon: "string", rotationDisabled: "boolean" },
    panel: { heading: "Track", icon: "compass-north-circle" },
    reportsLocationErrors: true,
  },
  "basemap-toggle": {
    tag: "arcgis-basemap-toggle",
    load: () => import("@arcgis/map-components/components/arcgis-basemap-toggle"),
    options: { nextBasemap: "basemap", showTitle: "boolean" },
    // dojo-sidebar's `satellite`, as a basemap styles ID (P-32).
    defaults: { nextBasemap: "hybrid" },
    panel: { heading: "Basemap", icon: "layer-basemap" },
  },
};
