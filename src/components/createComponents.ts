import type Layer from "@arcgis/core/layers/Layer.js";
import type { AppModel } from "../app/AppModel.ts";
import { errorText } from "../app/errors.ts";
import type { ComponentConfig } from "../config/types.ts";
import { COMPONENT_TYPES, type ComponentContext, type ComponentType, type ConfigurableElement, type OptionKind } from "./registry.ts";
import { resolveBasemap } from "../map/freeBasemaps.ts";
import { cornerStack } from "../map/cornerStack.ts";
import { handleRemoveLocationAction, replaceRemoveAction } from "./locationMarker.ts";

/** The parts of an element the stage touches. Real DOM elements satisfy it. */
export interface ComponentElement {
  slot: string;
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

/** A component for the sidebar, with its heading and icon resolved (config, else type default). */
export interface PanelComponent {
  entry: ComponentConfig;
  element: ComponentElement;
  heading: string;
  icon: string;
}

/** A sidebar panel known from config alone, before its component exists. */
export interface PanelSlot {
  /** The component entry's id. */
  id: string;
  heading: string;
  icon: string;
}

/**
 * A `panel` entry's heading and icon: its own `panel` settings, else its type's defaults. Used
 * for the sidebar at startup and by the component stage, so the two always agree.
 */
export function panelSlot(entry: ComponentConfig, types: Readonly<Record<string, ComponentType>> = COMPONENT_TYPES): PanelSlot {
  const type = types[entry.type];
  return {
    id: entry.id,
    heading: entry.panel?.heading ?? type.panel.heading,
    icon: entry.panel?.icon ?? type.panel.icon,
  };
}

export interface CreateComponentsResult {
  /** `panel` components in config order, for the sidebar to show. */
  panels: PanelComponent[];
}

export interface CreateComponentsOptions {
  entries: ComponentConfig[];
  /** The `arcgis-map` element components are slotted into. */
  mapElement: { append(...nodes: ComponentElement[]): void };
  app: AppModel;
  types?: Readonly<Record<string, ComponentType>>;
  /** Defaults to `document.createElement`. */
  createElement?: (tag: string) => ComponentElement;
  /**
   * Called with the GeolocationPositionError code when a location component can't get the
   * device's position (design D3), after the error is reported to the error channel.
   */
  onLocationError?: (code: number) => void;
  /** The map, for `configure` hooks (design D2). */
  map?: ComponentContext["map"];
  /** The build's API key, for `configure` hooks that need it. */
  apiKey?: string;
  /** The validated `geocoding` section, for Search and Directions (D16). */
  geocoding?: ComponentContext["geocoding"];
  /**
   * The container for a map corner (design D1). Defaults to the viewer's corner stack inside
   * `mapElement`.
   */
  cornerStack?: (slot: string) => { append(...nodes: ComponentElement[]): void };
}

/**
 * The component stage. Runs after layers settle. Corner components go into their corner's
 * stack in config order, so each corner reads top to bottom (design D1); `none` components are
 * attached hidden; `panel` components are created with a reference to the map (they live
 * outside it, in the sidebar) and returned for the sidebar to place. Never throws; problems go
 * to the app model's error channel.
 */
export async function createComponents(options: CreateComponentsOptions): Promise<CreateComponentsResult> {
  const { entries, mapElement, app, types = COMPONENT_TYPES } = options;
  const createElement = options.createElement ?? ((tag: string) => document.createElement(tag) as unknown as ComponentElement);
  const stackFor =
    options.cornerStack ?? ((slot: string) => cornerStack(mapElement as unknown as HTMLElement, slot) as unknown as { append(...nodes: ComponentElement[]): void });

  // Load each type once, before creating anything, so order isn't affected by load order.
  const needed = new Set(entries.map((e) => e.type));
  const loaded = new Set<string>();
  await Promise.all(
    [...needed].map(async (name) => {
      try {
        await types[name].load();
        loaded.add(name);
      } catch (err) {
        app.errors.report({ source: `component-type:${name}`, message: `The "${name}" component could not be loaded.`, detail: errorText(err) });
      }
    }),
  );

  const panels: PanelComponent[] = [];
  for (const entry of entries) {
    if (!loaded.has(entry.type)) continue;

    const type = types[entry.type];
    const element = createElement(type.tag);
    element.setAttribute("data-component-id", entry.id);
    if (type.configure) {
      if (!options.map) {
        app.errors.report({ source: `component:${entry.id}`, message: `The "${entry.type}" component needs the map, which isn't available.` });
        continue;
      }
      try {
        await type.configure(element as unknown as ConfigurableElement, entry.options, { map: options.map, app, apiKey: options.apiKey, geocoding: options.geocoding });
      } catch (err) {
        app.errors.report({ source: `component:${entry.id}`, message: `The "${entry.id}" component could not be set up.`, detail: errorText(err) });
        continue;
      }
    } else {
      for (const [name, value] of Object.entries(entry.options)) {
        (element as unknown as Record<string, unknown>)[name] = resolveOption(type.options[name], value, app);
      }
    }
    app.addComponent({ entry, element: element as unknown as HTMLElement });
    if (type.locationMarker) {
      // The marker's built-in remove action throws in SDK 5.2; use ours (D14).
      replaceRemoveAction(element as unknown as Parameters<typeof replaceRemoveAction>[0]);
      handleRemoveLocationAction(mapElement as unknown as Parameters<typeof handleRemoveLocationAction>[0]);
    }
    if (type.reportsLocationErrors) {
      element.addEventListener("arcgisError", (event) => {
        const error = (event as CustomEvent<{ error?: { code?: number; message?: string } }>).detail?.error;
        const code = typeof error?.code === "number" ? error.code : 2;
        app.errors.report({
          source: `component:${entry.id}`,
          message: "The device's location isn't available.",
          detail: `GeolocationPositionError ${code}${error?.message ? `: ${error.message}` : ""}`,
        });
        options.onLocationError?.(code);
      });
    }

    if (entry.placement === "panel") {
      // Outside arcgis-map, a map component finds its view through referenceElement (design D6).
      (element as unknown as { referenceElement: unknown }).referenceElement = mapElement;
      const { heading, icon } = panelSlot(entry, types);
      panels.push({ entry, element, heading, icon });
      continue;
    }
    if (entry.placement === "none") {
      element.hidden = true;
      mapElement.append(element);
    } else {
      stackFor(entry.placement).append(element);
    }
  }

  return { panels };
}

/**
 * Layer-reference options become the created layers, and basemap IDs become the built-in free
 * basemap where there is one (design D4); everything else passes as is.
 */
function resolveOption(kind: OptionKind | undefined, value: unknown, app: AppModel): unknown {
  const layer = (id: string): Layer | undefined => app.getLayer(id)?.layer;
  if (kind === "layer") return layer(value as string);
  if (kind === "layer[]") return (value as string[]).map(layer).filter((l): l is Layer => l !== undefined);
  if (kind === "layer-info[]") {
    return (value as { layer: string; title?: string }[]).flatMap((info) => {
      const resolved = layer(info.layer);
      return resolved ? [{ layer: resolved, ...(info.title !== undefined ? { title: info.title } : {}) }] : [];
    });
  }
  if (kind === "basemap") return resolveBasemap(value as string);
  return value;
}
