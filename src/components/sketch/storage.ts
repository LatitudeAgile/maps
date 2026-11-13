// Keeping sketches in the browser (add-print-and-sketch-panels D9), ported from StewardshipOS's
// mapSketches.ts: per app name (`?app=`) instead of per account, and preferences per browser. Written
// against a Storage-like interface, and every storage error is caught.
import Graphic from "@arcgis/core/Graphic.js";
import type TextSymbol from "@arcgis/core/symbols/TextSymbol.js";

/** The parts of `localStorage` used here. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Preferences, per browser: shared by every config. */
export const PREF_KEYS = {
  color: "viewer:sketch:color",
  customColors: "viewer:sketch:customColors",
  fillPercent: "viewer:sketch:fillPercent",
} as const;

const VERSION = 1;

/** A sketch as saved: its geometry, symbol and attributes, without its popup. */
export function sketchJSON(graphic: Graphic): Record<string, unknown> {
  const { popupTemplate: _template, popupInfo: _info, ...json } = graphic.toJSON() as Record<string, unknown>;
  return json;
}

/**
 * The sketches saved under `key`. Read one at a time, so one that can't be read doesn't lose the
 * others. A note saved without text (the page closed with its dialog open) is dropped. A store
 * that can't be read gives none.
 */
export function loadSketches(store: StorageLike, key: string): Graphic[] {
  let saved: unknown;
  try {
    saved = JSON.parse(store.getItem(key) ?? "null");
  } catch {
    return [];
  }
  const graphics = (saved as { v?: unknown; graphics?: unknown } | null)?.graphics;
  if ((saved as { v?: unknown } | null)?.v !== VERSION || !Array.isArray(graphics)) return [];
  return graphics.flatMap((json: unknown) => {
    try {
      const graphic = Graphic.fromJSON(json);
      const emptyNote = graphic.symbol?.type === "text" && !(graphic.symbol as TextSymbol).text?.trim();
      return graphic.geometry && !emptyNote ? [graphic] : [];
    } catch {
      return [];
    }
  });
}

/** Save `graphics` under `key`, or remove the key when there are none. False when it failed. */
export function saveSketches(store: StorageLike, key: string, graphics: readonly Graphic[]): boolean {
  try {
    if (graphics.length === 0) store.removeItem(key);
    else store.setItem(key, JSON.stringify({ v: VERSION, graphics: graphics.map(sketchJSON) }));
    return true;
  } catch {
    return false;
  }
}

/** Read a preference; undefined when absent or unreadable. */
export function loadPref(store: StorageLike, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Remember a preference. Only a convenience: a failure is ignored. */
export function savePref(store: StorageLike, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // the next start uses the defaults
  }
}

/** Debounce delay: quick edits in a row are saved once. */
export const SAVE_DELAY_MS = 300;

/**
 * Saves one layer's sketches soon after each change. `onResult` hears whether each save worked,
 * so the panel can say when the latest changes weren't saved.
 */
export class SketchSaver {
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly store: StorageLike,
    private readonly key: string,
    private readonly graphics: () => readonly Graphic[],
    private readonly onResult: (saved: boolean) => void,
  ) {}

  /** Save after a short pause; another change in the meantime restarts it. */
  saveSoon(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /** Whether a save is waiting. */
  get pending(): boolean {
    return this.#timer !== undefined;
  }

  /** Save now, if a save is waiting (or always, with `force`). */
  flush(force = false): void {
    if (this.#timer === undefined && !force) return;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.onResult(saveSketches(this.store, this.key, this.graphics()));
  }

  /** Forget a waiting save and remove every saved sketch. */
  clear(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.onResult(saveSketches(this.store, this.key, []));
  }
}
