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

export interface CreateComponentsOptions {
  entries: ComponentConfig[];
  /** The `arcgis-map` element components are slotted into. */
  mapElement: { append(...nodes: ComponentElement[]): void };
  app: AppModel;
  types?: Readonly<Record<string, ComponentType>>;
  /** Defaults to `document.createElement`. */
  createElement?: (tag: string) => ComponentElement;
  /** Defaults to `console.warn`. */
  warn?: (message: string) => void;
}

/**
 * The component stage (design D6). Runs after layers settle. Corner components are slotted into
 * the map in config order; `none` components are attached hidden; `panel` components wait for the
 * sidebar. Never throws; problems go to the app model's error channel.
 */
export async function createComponents(options: CreateComponentsOptions): Promise<void> {
  const { entries, mapElement, app, types = COMPONENT_TYPES } = options;
  const createElement = options.createElement ?? ((tag: string) => document.createElement(tag) as unknown as ComponentElement);
  const warn = options.warn ?? ((message: string) => console.warn(message));

  // Load each type once, before creating anything, so corner order isn't affected by load order.
  const needed = new Set(entries.filter((e) => e.placement !== "panel").map((e) => e.type));
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

  const panelIds: string[] = [];
  for (const entry of entries) {
    if (entry.placement === "panel") {
      panelIds.push(entry.id);
      app.addComponent({ entry, element: undefined });
      continue;
    }
    if (!loaded.has(entry.type)) continue;

    const type = types[entry.type];
    const element = createElement(type.tag);
    element.setAttribute("data-component-id", entry.id);
    for (const [name, value] of Object.entries(entry.options)) {
      (element as unknown as Record<string, unknown>)[name] = resolveOption(type.options[name], value, app);
    }
    if (entry.placement === "none") element.hidden = true;
    else element.slot = entry.placement;
    mapElement.append(element);
    app.addComponent({ entry, element: element as unknown as HTMLElement });
  }

  if (panelIds.length > 0) {
    warn(
      `Viewer: panel components need the sidebar, which this version doesn't have yet. Not shown: ${panelIds.join(", ")}.`,
    );
  }
}

/** Layer-reference options become the created layers; everything else passes as is. */
function resolveOption(kind: string | undefined, value: unknown, app: AppModel): unknown {
  const layer = (id: string): Layer | undefined => app.getLayer(id)?.layer;
  if (kind === "layer") return layer(value as string);
  if (kind === "layer[]") return (value as string[]).map(layer).filter((l): l is Layer => l !== undefined);
  return value;
}
