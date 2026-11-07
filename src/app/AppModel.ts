import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type Layer from "@arcgis/core/layers/Layer.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type { LayerConfig, ComponentConfig } from "../config/types.ts";
import { ErrorChannel } from "./errors.ts";

/** A configured layer: its config entry and the layer created from it. */
export interface LayerRecord {
  entry: LayerConfig;
  layer: Layer;
}

/** A configured component: its config entry and the element created from it, if any. */
export interface ComponentRecord {
  entry: ComponentConfig;
  /** Undefined for components that aren't rendered yet (`panel` placement). */
  element: HTMLElement | undefined;
}

export type ViewStateName = "extent" | "center" | "zoom" | "scale";

/** The view properties the model reads. A MapView satisfies it. */
type ViewLike = Pick<MapView, ViewStateName>;

/**
 * Runtime model shared by the viewer and its components (design D7): view state, layer and
 * component lookups, and the error channel. Exposed as `window.app` in debug mode.
 */
export class AppModel {
  /** The map view, once the map exists. */
  view: ViewLike | undefined;
  readonly errors: ErrorChannel;
  readonly #layers = new Map<string, LayerRecord>();
  readonly #components = new Map<string, ComponentRecord>();

  constructor(errors: ErrorChannel = new ErrorChannel()) {
    this.errors = errors;
  }

  get extent(): MapView["extent"] | undefined {
    return this.view?.extent;
  }
  get center(): MapView["center"] | undefined {
    return this.view?.center;
  }
  get zoom(): number | undefined {
    return this.view?.zoom;
  }
  get scale(): number | undefined {
    return this.view?.scale;
  }

  /**
   * Watch a view-state value. The callback runs when it changes. Returns a handle with
   * `remove()`. Works for code without its own SDK import, such as the console in debug mode.
   */
  watch<K extends ViewStateName>(name: K, callback: (value: AppModel[K]) => void): { remove(): void } {
    return reactiveUtils.watch(() => this[name], (value) => callback(value as AppModel[K]));
  }

  addLayer(record: LayerRecord): void {
    this.#layers.set(record.entry.id, record);
  }
  addComponent(record: ComponentRecord): void {
    this.#components.set(record.entry.id, record);
  }

  /** The configured layer with this id, or undefined. */
  getLayer(id: string): LayerRecord | undefined {
    return this.#layers.get(id);
  }
  /** The configured component with this id, or undefined. */
  getComponent(id: string): ComponentRecord | undefined {
    return this.#components.get(id);
  }

  get layers(): LayerRecord[] {
    return [...this.#layers.values()];
  }
  get components(): ComponentRecord[] {
    return [...this.#components.values()];
  }
}
