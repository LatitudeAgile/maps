import { loadNamedConfig, type LoadResult } from "../config/load.ts";
import { readListing, type AppListing } from "./listing.ts";

/** One catalog app as the Apps panel knows it (add-app-selector D5). */
export type AppEntry =
  | { name: string; state: "loading" }
  | { name: string; state: "ready"; listing: AppListing }
  | { name: string; state: "unavailable"; reason: string; url?: string };

export type AppEntryListener = (entry: AppEntry) => void;

export interface AppDirectoryOptions {
  /** Catalog names, in order. */
  names: readonly string[];
  /** The open app's name (`?app=`, or `default`). */
  currentName: string;
  /** The open app's listing, used for its own row instead of fetching its config again. */
  current: AppListing;
  /** Loads a config by name; defaults to `loadNamedConfig`. */
  load?: (name: string) => Promise<LoadResult>;
}

/**
 * The catalog's apps and their listings (D5). Starts with every other app loading; `load()`
 * fetches their configs all at once, the first time it is called, and reports each entry as it
 * changes. Entries keep catalog order.
 */
export class AppDirectory {
  readonly currentName: string;
  readonly #entries = new Map<string, AppEntry>();
  readonly #listeners = new Set<AppEntryListener>();
  readonly #load: (name: string) => Promise<LoadResult>;
  #started = false;

  constructor({ names, currentName, current, load = (name) => loadNamedConfig(name) }: AppDirectoryOptions) {
    this.currentName = currentName;
    this.#load = load;
    for (const name of names) {
      this.#entries.set(name, name === currentName ? { name, state: "ready", listing: current } : { name, state: "loading" });
    }
  }

  /** Entries in catalog order. */
  get entries(): AppEntry[] {
    return [...this.#entries.values()];
  }

  get(name: string): AppEntry | undefined {
    return this.#entries.get(name);
  }

  onChange(listener: AppEntryListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Fetch every other app's config, once per page load. Later calls do nothing. */
  load(): void {
    if (this.#started) return;
    this.#started = true;
    for (const entry of this.#entries.values()) {
      if (entry.state !== "loading") continue;
      void this.#load(entry.name).then(
        (result) => this.#set(this.#fromResult(entry.name, result)),
        (err: unknown) => this.#set({ name: entry.name, state: "unavailable", reason: String(err) }),
      );
    }
  }

  #fromResult(name: string, result: LoadResult): AppEntry {
    if (!result.ok) return { name, state: "unavailable", reason: result.message, ...(result.url ? { url: result.url } : {}) };
    const read = readListing(result.raw);
    if (read.ok) return { name, state: "ready", listing: read.listing };
    return { name, state: "unavailable", reason: `${read.reason.replace(/\.$/, "")}: ${result.url}.`, url: result.url };
  }

  #set(entry: AppEntry): void {
    this.#entries.set(entry.name, entry);
    if (entry.state === "unavailable") console.warn(`[viewer] App "${entry.name}" is unavailable. ${entry.reason}`);
    for (const listener of [...this.#listeners]) listener(entry);
  }
}
