import type Layer from "@arcgis/core/layers/Layer.js";
import type { AppModel } from "../app/AppModel.ts";
import { errorText } from "../app/errors.ts";
import type { ComponentConfig } from "../config/types.ts";
import { COMPONENT_TYPES, type ComponentType } from "./registry.ts";

/** The parts of an element the stage touches. Real DOM elements satisfy it. */
export interface ComponentElement {
  slot: string;
  hidden: boolean;
  setAttribute(name: string, value: string): void;
}

/** A component for the sidebar, with its heading and icon resolved (config, else type default). */
export interface PanelComponent {
  entry: ComponentConfig;
  element: ComponentElement;
  heading: string;
  icon: string;
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
}

/**
 * The component stage. Runs after layers settle. Corner components are slotted into the map in
 * config order; `none` components are attached hidden; `panel` components are created with a
 * reference to the map (they live outside it, in the sidebar) and returned for the sidebar to
 * place. Never throws; problems go to the app model's error channel.
 */
export async function createComponents(options: CreateComponentsOptions): Promise<CreateComponentsResult> {
  const { entries, mapElement, app, types = COMPONENT_TYPES } = options;
  const createElement = options.createElement ?? ((tag: string) => document.createElement(tag) as unknown as ComponentElement);

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
    for (const [name, value] of Object.entries(entry.options)) {
      (element as unknown as Record<string, unknown>)[name] = resolveOption(type.options[name], value, app);
    }
    app.addComponent({ entry, element: element as unknown as HTMLElement });

    if (entry.placement === "panel") {
      // Outside arcgis-map, a map component finds its view through referenceElement (design D6).
      (element as unknown as { referenceElement: unknown }).referenceElement = mapElement;
      panels.push({
        entry,
        element,
        heading: entry.panel?.heading ?? type.panel.heading,
        icon: entry.panel?.icon ?? type.panel.icon,
      });
      continue;
    }
    if (entry.placement === "none") element.hidden = true;
    else element.slot = entry.placement;
    mapElement.append(element);
  }

  return { panels };
}

/** Layer-reference options become the created layers; everything else passes as is. */
function resolveOption(kind: string | undefined, value: unknown, app: AppModel): unknown {
  const layer = (id: string): Layer | undefined => app.getLayer(id)?.layer;
  if (kind === "layer") return layer(value as string);
  if (kind === "layer[]") return (value as string[]).map(layer).filter((l): l is Layer => l !== undefined);
  if (kind === "layer-info[]") {
    return (value as { layer: string; title?: string }[]).flatMap((info) => {
      const resolved = layer(info.layer);
      return resolved ? [{ layer: resolved, ...(info.title !== undefined ? { title: info.title } : {}) }] : [];
    });
  }
  return value;
}
