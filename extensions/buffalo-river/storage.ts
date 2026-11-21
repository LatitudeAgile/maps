// What the component keeps per app in the browser: whether the safety warning was acknowledged.
// Unreadable or missing values count as unset, and storage that can't be used (a private window, a
// full quota) is skipped without an error. Which points of interest show is up to the layer list.
import { appStorageKey } from "viewer";

const KEY = appStorageKey("buffalo-river");

export interface Saved {
  warningAcknowledged: boolean;
}

export function load(): Saved {
  let raw: unknown;
  try {
    raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "null");
  } catch {
    raw = null;
  }
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return { warningAcknowledged: value.warningAcknowledged === true };
}

export function save(saved: Saved): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Not saved: the choice lasts until the page is reloaded.
  }
}
