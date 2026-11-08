import type { ComponentConfig } from "../config/types.ts";
import { COMPONENT_TYPES, type ComponentType } from "./registry.ts";

export interface LeftOutComponent {
  entry: ComponentConfig;
  /** Why it needs a key, for the console warning. */
  reason: string;
}

/**
 * Without an API key, apply each type's `keyless` hook (design D2): keep entries, possibly with
 * trimmed options, and leave out those that would need a key. With a key, keep everything.
 */
export function applyKeyless(
  entries: readonly ComponentConfig[],
  hasKey: boolean,
  types: Readonly<Record<string, ComponentType>> = COMPONENT_TYPES,
): { kept: ComponentConfig[]; leftOut: LeftOutComponent[] } {
  if (hasKey) return { kept: [...entries], leftOut: [] };
  const kept: ComponentConfig[] = [];
  const leftOut: LeftOutComponent[] = [];
  for (const entry of entries) {
    const hook = Object.hasOwn(types, entry.type) ? types[entry.type].keyless : undefined;
    const result = hook ? hook(entry.options) : { keep: entry.options };
    if ("leaveOut" in result) leftOut.push({ entry, reason: result.leaveOut });
    else kept.push({ ...entry, options: result.keep });
  }
  return { kept, leftOut };
}

/** The console warning for a component left out for want of a key. */
export function leftOutWarning({ entry, reason }: LeftOutComponent): string {
  return `[viewer] components "${entry.id}" is left out because ${reason}. Set VITE_ARCGIS_API_KEY, or configure it with services that need no key.`;
}
