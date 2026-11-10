/**
 * The user's Appearance choice, remembered for the whole viewer site (add-settings D1).
 *
 * Keep the key and the accepted values in step with the pre-paint script in `index.html`
 * (add-settings D2), which reads the same key before any module loads.
 */
import { COLOR_MODES, type ColorMode } from "../config/types.ts";

const KEY_PREFIX = "arcgis-sidebar-viewer:mode:";

/** One key per viewer deployment: every `?app=` link of a deployment shares its directory. */
function key(): string {
  return KEY_PREFIX + new URL(".", location.href).pathname;
}

const isColorMode = (value: unknown): value is ColorMode => (COLOR_MODES as readonly unknown[]).includes(value);

/** The stored choice, or undefined when there is none, it isn't recognized, or storage fails. */
export function readChoice(): ColorMode | undefined {
  try {
    const value = localStorage.getItem(key());
    return isColorMode(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remember a choice. When storage fails, nothing is remembered; the caller still applies it. */
export function storeChoice(mode: ColorMode): void {
  try {
    localStorage.setItem(key(), mode);
  } catch {
    // Storage blocked or full: the mode applies to this page only.
  }
}

/** Forget the choice, so each app opens in its own `app.mode`. */
export function forgetChoice(): void {
  try {
    localStorage.removeItem(key());
  } catch {
    // Nothing could be stored either, so there is nothing to forget.
  }
}
