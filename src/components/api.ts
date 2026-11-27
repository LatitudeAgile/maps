/**
 * The viewer API: what extension code under `extensions/` imports, as `"viewer"`
 * (add-drop-in-extensions D4). Documented in docs/components/viewer-api.md.
 *
 * Exports here change incompatibly only together with a new API_VERSION. Adding an export
 * doesn't need one. Keep this module small: a manifest imports it at startup, and it must not
 * import the registry at runtime (type imports are fine), or registry -> extensions -> manifest
 * -> "viewer" would be a cycle.
 */
import { configName, DEFAULT_CONFIG_NAME } from "../config/load.ts";

/** The viewer API version a manifest's `apiVersion` must state. */
export const API_VERSION = 1;

/**
 * A browser-storage key for `name` in the current app (`?app=`, or the default app):
 * `viewer:<name>:<app>`. Pass your type name, so keys can't clash with another component's.
 */
export function appStorageKey(name: string): string {
  return `viewer:${name}:${configName(globalThis.location?.search ?? "") ?? DEFAULT_CONFIG_NAME}`;
}

export { findViewElement, type ViewElement } from "../map/viewElement.ts";
export { PANEL_CLOSE, PANEL_OPEN, PANEL_REQUEST_OPEN, requestPanelOpen } from "../sidebar/panelEvents.ts";
// The map menu (map-menu). Its registry has no runtime imports, so this adds no cycle.
export { addMapMenuItems, type MapMenuContext, type MapMenuItem } from "../map/menu/registry.ts";
export { defineComponentType } from "./componentType.ts";
export type { ComponentContext, ConfigurableElement, CornerStyle, ExtensionManifest, KeylessResult, OptionKind } from "./componentType.ts";
export type { ComponentPlacement, ExpandMode, MapViewKind } from "../config/types.ts";
