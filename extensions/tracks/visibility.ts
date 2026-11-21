// Which library entries are on in the app that's open (design D4): `{ version: 1, on: [ids] }` in
// localStorage under appStorageKey("tracks"). Unreadable values count as none on, and storage that
// can't be used is skipped without an error.
import { appStorageKey } from "viewer";

const KEY = appStorageKey("tracks");
const VERSION = 1;

export function loadVisible(): Set<string> {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "null");
    if (typeof raw === "object" && raw !== null) {
      const { version, on } = raw as { version?: unknown; on?: unknown };
      if (version === VERSION && Array.isArray(on)) return new Set(on.filter((id): id is string => typeof id === "string"));
    }
  } catch {
    // Unreadable: none on.
  }
  return new Set();
}

export function saveVisible(ids: Iterable<string>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ version: VERSION, on: [...ids] }));
  } catch {
    // Not saved: the checkboxes last until the page is reloaded.
  }
}
