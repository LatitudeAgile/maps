/**
 * What a component type is: the manifest an extension's `component.ts` exports, and the shape
 * the registry holds for built-in and extension types alike (add-drop-in-extensions D2).
 *
 * This module has no runtime imports, so the viewer API ("viewer", src/components/api.ts) can
 * re-export from it without pulling in the registry. Documented in docs/components/manifest.md
 * and docs/components/option-kinds.md.
 */
import type EsriMap from "@arcgis/core/Map.js";
import type { AppModel } from "../app/AppModel.ts";
import type { GeocodingConfig } from "../config/geocoding.ts";
import type { ComponentPlacement, ExpandMode, MapViewKind } from "../config/types.ts";

/** Option kinds named by a string. `{ oneOf }`, `{ integer }` and `{ listOf }` carry values. */
export const NAMED_OPTION_KINDS = [
  "string",
  "number",
  "boolean",
  "scale",
  "url",
  "basemap",
  "basemap[]",
  "layer",
  "layer[]",
  "layer-info[]",
  "color[]",
  "bookmark[]",
] as const;

/** The keys of the option kinds that carry values: `{ oneOf: [...] }` and the like. */
export const VALUED_OPTION_KINDS = ["oneOf", "integer", "listOf"] as const;

/**
 * How a component option's config value is checked and applied. `layer` and `layer[]`
 * options take layer ids from `layers`, resolved to the created layers. `layer-info[]` takes
 * `{ layer: <id>, title?: <text> }` entries, resolved to `{ layer: <Layer>, title }` (the SDK's
 * LayerInfo shape, used by the legend). `scale` is a number greater than 0. `basemap` is a
 * non-empty basemap ID; legacy IDs are accepted with a warning, as in `map.basemap`; `basemap[]`
 * is a non-empty list of them. `url` is an absolute https URL. `{ oneOf }` is one of a fixed
 * list of strings; `{ integer }` is a whole number in an inclusive range (design D1).
 * `color[]` is a list of 1 to 12 `{ name, color }` entries with unique `#rrggbb` colors,
 * normalized to lowercase (add-print-and-sketch-panels D5). `{ listOf }` is a non-empty list of
 * unique strings from a fixed list (add-map-expand-and-components D8). `bookmark[]` is a list of
 * `{ name, center, zoom | scale, tilt?, heading? }` places, checked like `map` (map-components).
 */
export type OptionKind =
  | (typeof NAMED_OPTION_KINDS)[number]
  | { readonly oneOf: readonly string[] }
  | { readonly integer: readonly [number, number] }
  | { readonly listOf: readonly string[] };

/**
 * How a component looks when placed straight into a map corner (add-drop-in-extensions D5):
 * `button`, with the shadow the SDK gives its own buttons; `panel`, with that shadow plus a
 * panel's width and scrolling. Without one, the viewer adds neither.
 */
export const CORNER_STYLES = ["button", "panel"] as const;
export type CornerStyle = (typeof CORNER_STYLES)[number];

/** What validation needs to know about a component type. */
export interface ComponentTypeSchema {
  /** Supported options and their kinds; anything else is warned about and dropped. */
  options: Readonly<Record<string, OptionKind>>;
  /** Values for options the config leaves out, filled in by validation (design D1). */
  defaults?: Readonly<Record<string, unknown>>;
  /** The only placements the type supports; any other fails validation. All when absent (D2). */
  placements?: readonly ComponentPlacement[];
  /**
   * The only views the type works in. In an app whose view the config decides, any other fails
   * validation; in an app opened from an item, the component is left out (add-web-maps-and-scenes
   * D8). Both when absent.
   */
  views?: readonly MapViewKind[];
  /**
   * The type can sit behind an expand button in a map corner (add-map-expand-and-components D2).
   * Set only once the type has been seen to work in one.
   */
  expandable?: true;
}

/** What a `configure` hook can use. */
export interface ComponentContext {
  /** The map the component works on. */
  map: EsriMap;
  /**
   * The app model. The viewer API version covers only `app.errors.report`; its other members
   * may change without a new version (add-drop-in-extensions D4).
   */
  app: AppModel;
  /** The build's API key, or undefined. Only hooks that need it should read it. */
  apiKey: string | undefined;
  /** The validated `geocoding` section: search sources for Search and Directions (D16). */
  geocoding?: GeocodingConfig;
  /** The map element (`arcgis-map` or `arcgis-scene`). */
  mapElement?: HTMLElement;
}

/** An element whose properties a `configure` hook sets. */
export type ConfigurableElement = HTMLElement & Record<string, unknown>;

export type KeylessResult = { keep: Record<string, unknown> } | { leaveOut: string };

/**
 * An extension's manifest: the default export of `extensions/<name>/component.ts`, made with
 * `defineComponentType`. The type's name is the folder's name.
 */
export interface ExtensionManifest extends ComponentTypeSchema {
  /** The viewer API version the extension was written for: `API_VERSION` from "viewer". */
  apiVersion: number;
  /** Custom element tag. */
  tag: string;
  /** Import that defines the element. Keep it lazy: `() => import("./index.ts")`. */
  load: () => Promise<unknown>;
  /** Sidebar heading and Calcite icon when placed in `panel` without its own `panel` settings. */
  panel: { heading: string; icon: string };
  /**
   * The expand mode when the entry doesn't set one; else `auto`. `floating` for types used on the
   * map while open: on a small map, `auto` opens a modal sheet, and a tap on the map closes it.
   */
  expandMode?: ExpandMode;
  /** How it looks placed straight into a map corner; the viewer adds nothing when absent. */
  cornerStyle?: CornerStyle;
  /**
   * Applies the validated options to the element, instead of assigning each one as a property.
   * For types whose config options don't map one-to-one to element properties.
   */
  configure?: (element: ConfigurableElement, options: Readonly<Record<string, unknown>>, context: ComponentContext) => void | Promise<void>;
  /**
   * Without an API key: keep the entry (possibly with trimmed options) or leave it out with a
   * reason. Applied before the component stage, so a left-out component sends no request.
   */
  keyless?: (options: Readonly<Record<string, unknown>>) => KeylessResult;
}

/** A registered component type, built in or from an extension, loaded on first use. */
export interface ComponentType extends Omit<ExtensionManifest, "apiVersion"> {
  /** The element emits `arcgisError` with a GeolocationPositionError, shown to the user (D3). */
  reportsLocationErrors?: boolean;
  /**
   * The element puts a location marker (its `graphic`) on the map, whose built-in remove action
   * the SDK 5.2 popup component can't carry out; the stage swaps in a working one (D14).
   */
  locationMarker?: boolean;
}

/** Gives an extension's manifest its type. Returns the manifest unchanged. */
export function defineComponentType(manifest: ExtensionManifest): ExtensionManifest {
  return manifest;
}
