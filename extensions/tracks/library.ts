// The track library, shared by every app on the site (design D4): one IndexedDB database,
// `viewer:tracks`, with one object store, `entries`. When the browser can't open it or a write
// fails (a blocked private window, a full disk), the library keeps working from memory for the
// rest of the visit and `persistent` turns false.
import type { Stats } from "./stats.ts";

export interface LibraryEntry {
  id: string;
  /** As chosen, for the download. */
  fileName: string;
  /** The original file, unchanged. */
  text: string;
  /** contentHash(text), for spotting duplicates. */
  hash: string;
  name: string;
  notes: string;
  color: string;
  /** ms since the epoch; the list is newest first. */
  addedAt: number;
  stats: Stats;
  statsVersion: number;
}

const DATABASE = "viewer:tracks";
const VERSION = 1;
const STORE = "entries";

export class Library {
  #db: IDBDatabase | undefined;
  #entries = new Map<string, LibraryEntry>();
  #persistent: boolean;

  private constructor(db: IDBDatabase | undefined) {
    this.#db = db;
    this.#persistent = db !== undefined;
  }

  /** Opens the library. Never rejects: without IndexedDB it starts empty, in memory. */
  static async open(): Promise<Library> {
    const db = await openDatabase().catch((error: unknown) => {
      console.warn("[tracks] The track library can't be kept in this browser:", error);
      return undefined;
    });
    const library = new Library(db);
    if (db) {
      try {
        const entries = await request<LibraryEntry[]>(db.transaction(STORE).objectStore(STORE).getAll());
        for (const entry of entries) library.#entries.set(entry.id, entry);
      } catch (error) {
        library.#lose(error);
      }
    }
    return library;
  }

  /** False once the library is only in memory: what's added now is gone when the page closes. */
  get persistent(): boolean {
    return this.#persistent;
  }

  /** Every entry, newest first. */
  list(): LibraryEntry[] {
    return [...this.#entries.values()].sort((a, b) => b.addedAt - a.addedAt);
  }

  get(id: string): LibraryEntry | undefined {
    return this.#entries.get(id);
  }

  /** Adds or replaces an entry. Resolves to whether it was kept in the browser. */
  async put(entry: LibraryEntry): Promise<boolean> {
    this.#entries.set(entry.id, entry);
    return this.#write((store) => store.put(entry));
  }

  /** Removes an entry. Resolves to whether the removal was kept in the browser. */
  async delete(id: string): Promise<boolean> {
    this.#entries.delete(id);
    return this.#write((store) => store.delete(id));
  }

  async #write(change: (store: IDBObjectStore) => IDBRequest): Promise<boolean> {
    const db = this.#db;
    if (!db) return false;
    try {
      const transaction = db.transaction(STORE, "readwrite");
      change(transaction.objectStore(STORE));
      await done(transaction);
      return true;
    } catch (error) {
      this.#lose(error);
      return false;
    }
  }

  #lose(error: unknown): void {
    console.warn("[tracks] The track library can't be kept in this browser:", error);
    this.#db?.close();
    this.#db = undefined;
    this.#persistent = false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = globalThis.indexedDB?.open(DATABASE, VERSION);
    if (!open) return reject(new Error("IndexedDB isn't available."));
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("The track library is open in an older version of this page."));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("The write was aborted."));
  });
}
