# Saving state

A component can keep what the user does, such as notes, choices or drawings, in the browser's
`localStorage`, so it's still there after a reload. Keep it per app: someone who opens
`?app=survey-tools` shouldn't see what they saved in `?app=default`.

## The key

`appStorageKey(name)` from `"viewer"` gives a key for the app that's open:
`viewer:<name>:<app>`. Pass your type name. Type names are unique, so your key can't clash with
another component's.

```ts
import { appStorageKey } from "viewer";

const key = appStorageKey("trail-report");
// "viewer:trail-report:default" with no ?app=, "viewer:trail-report:survey-tools" with ?app=survey-tools
```

For something that should be the same in every app, such as a preferred unit, use a fixed key
that starts with `viewer:<your type name>:` instead.

## Reading and writing safely

Storage can fail. In a private window it may be missing or refuse writes, and it has a size
limit. Wrap every read and write, and make your component work without it:

```ts
import { appStorageKey } from "viewer";

const KEY = appStorageKey("trail-report");

function loadNote(): string {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function saveNote(text: string): void {
  try {
    globalThis.localStorage?.setItem(KEY, text);
  } catch {
    // Full, or blocked: keep working without saving.
  }
}
```

## Storing structured data

Store JSON, and include a version number. Then a later release of your component can tell old
data from new and convert it, instead of failing on it:

```ts
const VERSION = 1;

function saveTrails(trails: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, trails }));
  } catch {
    // Keep working without saving.
  }
}

function loadTrails(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null") as { version?: number; trails?: unknown } | null;
    if (data?.version === VERSION && Array.isArray(data.trails)) return data.trails.filter((t): t is string => typeof t === "string");
  } catch {
    // Unreadable: start empty.
  }
  return [];
}
```

Save when something changes, not on a timer. If changes come quickly, such as while dragging,
wait until they stop for a moment before saving.

The built-in Sketch panel (`src/components/sketch/storage.ts`) and Bookmarks
(`src/components/bookmarks.ts`) keep their data this way.
