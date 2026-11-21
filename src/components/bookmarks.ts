// The bookmarks type (map-components, P-70): the web map's or web scene's bookmarks, then the
// config's, then the ones the user added, which are kept in the browser per app (`?app=`), as
// sketches are. Bookmarks from the item or the config can be edited or removed for the session;
// they come back as configured on the next load. In a scene, one the user adds or edits keeps
// the camera, which the SDK leaves out.
import Collection from "@arcgis/core/core/Collection.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import Point from "@arcgis/core/geometry/Point.js";
import Viewpoint from "@arcgis/core/Viewpoint.js";
import Bookmark from "@arcgis/core/webmap/Bookmark.js";
import { appStorageKey } from "viewer";
import type { StorageLike } from "./sketch/storage.ts";
import type { ComponentContext, ConfigurableElement } from "./registry.ts";

/** A bookmark from the config, as validated. */
export interface BookmarkConfig {
  name: string;
  center: [number, number];
  zoom?: number;
  scale?: number;
  tilt?: number;
  heading?: number;
}

const VERSION = 1;

/** Scale at zoom 0 in the web tiling scheme, to give a zoom-only bookmark a scale. */
const ZOOM_0_SCALE = 591657527.591555;

interface SavedBookmark {
  name: string;
  viewpoint: unknown;
  thumbnail?: string;
}

/** The bookmarks saved under `key`, read one at a time so a bad one doesn't lose the rest. */
export function loadBookmarks(store: StorageLike, key: string): Bookmark[] {
  let saved: unknown;
  try {
    saved = JSON.parse(store.getItem(key) ?? "null");
  } catch {
    return [];
  }
  const list = (saved as { v?: unknown; bookmarks?: unknown } | null)?.bookmarks;
  if ((saved as { v?: unknown } | null)?.v !== VERSION || !Array.isArray(list)) return [];
  return list.flatMap((item: SavedBookmark) => {
    try {
      const viewpoint = Viewpoint.fromJSON(item.viewpoint);
      if (typeof item.name !== "string" || (!viewpoint?.targetGeometry && !viewpoint?.camera)) return [];
      return [new Bookmark({ name: item.name, viewpoint, ...(item.thumbnail ? { thumbnail: { url: item.thumbnail } } : {}) })];
    } catch {
      return [];
    }
  });
}

/**
 * Save `bookmarks` under `key`, or remove the key when there are none. Thumbnails are images, so
 * when the browser refuses for lack of room, it tries again without them. False when it failed.
 */
export function saveBookmarks(store: StorageLike, key: string, bookmarks: readonly Bookmark[]): boolean {
  const toJSON = (withThumbnails: boolean): string =>
    JSON.stringify({
      v: VERSION,
      bookmarks: bookmarks.flatMap((b): SavedBookmark[] =>
        b.viewpoint
          ? [{ name: b.name ?? "", viewpoint: b.viewpoint.toJSON(), ...(withThumbnails && b.thumbnail?.url ? { thumbnail: b.thumbnail.url } : {}) }]
          : [],
      ),
    });
  try {
    if (bookmarks.length === 0) store.removeItem(key);
    else store.setItem(key, toJSON(true));
    return true;
  } catch {
    try {
      store.setItem(key, toJSON(false));
      return true;
    } catch {
      return false;
    }
  }
}

/** A config bookmark as an SDK bookmark, and the target to go to for it. */
function fromConfig(c: BookmarkConfig): { bookmark: Bookmark; target: Record<string, unknown> } {
  const [longitude, latitude] = c.center;
  const scale = c.scale ?? ZOOM_0_SCALE / 2 ** (c.zoom ?? 0);
  const viewpoint = new Viewpoint({ targetGeometry: new Point({ longitude, latitude }), scale });
  const target: Record<string, unknown> = { center: [longitude, latitude], ...(c.scale !== undefined ? { scale: c.scale } : { zoom: c.zoom }) };
  if (c.tilt !== undefined) target.tilt = c.tilt;
  if (c.heading !== undefined) target.heading = c.heading;
  return { bookmark: new Bookmark({ name: c.name, viewpoint }), target };
}

type BookmarksElement = ConfigurableElement & {
  goToOverride: (view: { type: string; goTo(target: unknown, options?: unknown): Promise<unknown> }, params: { target: unknown; options?: unknown }) => Promise<unknown>;
};

/** Apply the options, fill the list, and keep the user's own bookmarks in the browser. */
export function configureBookmarks(element: ConfigurableElement, options: Readonly<Record<string, unknown>>, { map }: ComponentContext): void {
  // A user who can add bookmarks can also rename and delete them.
  element.showAddBookmarkButton = options.showAddBookmarkButton;
  element.showEditBookmarkButton = options.showAddBookmarkButton;
  if (options.showFilter !== undefined) element.showFilter = options.showFilter;

  const fromItem = (map as { bookmarks?: Collection<Bookmark> }).bookmarks?.toArray() ?? [];
  const configured = ((options.bookmarks as BookmarkConfig[] | undefined) ?? []).map(fromConfig);
  const store = storage();
  const key = appStorageKey("bookmarks");
  const own = store ? loadBookmarks(store, key) : [];

  const fixed = new WeakSet<Bookmark>([...fromItem, ...configured.map((c) => c.bookmark)]);
  const list = new Collection<Bookmark>([...fromItem, ...configured.map((c) => c.bookmark), ...own]);
  element.bookmarks = list;

  // A config bookmark's tilt and heading need a camera, which its viewpoint can't hold before
  // there is a view: go to it the way the starting view is applied (center, scale or zoom, tilt
  // and heading). In a 2D map, tilt and heading don't apply. Others go to their viewpoint.
  const targets = new Map(configured.map((c) => [c.bookmark.viewpoint as unknown, c.target]));
  (element as BookmarksElement).goToOverride = (view, params) => {
    const target = targets.get(params.target);
    if (!target) return view.goTo(params.target, params.options);
    const { tilt: _tilt, heading: _heading, ...flat } = target;
    return view.goTo(view.type === "3d" ? target : flat, params.options);
  };

  keepSceneCamera(element, list);

  if (!store) return;
  let warned = false;
  reactiveUtils.watch(
    () => list.filter((b) => !fixed.has(b)).map((b) => [b.name, b.viewpoint, b.thumbnail?.url]),
    () => {
      const saved = saveBookmarks(store, key, list.filter((b) => !fixed.has(b)).toArray());
      if (!saved && !warned) {
        warned = true;
        console.warn("[viewer] Bookmarks couldn't be saved in this browser; they last until the page is closed.");
      }
    },
  );
}

interface CameraView {
  type: string;
  viewpoint?: Viewpoint | null;
}

/**
 * In a scene, give a bookmark the view's camera when the user adds it, or edits it to the current
 * view. The SDK captures only the extent, rotation and scale, so going back to it would lose the
 * tilt and heading. A viewpoint the list hasn't seen before is one just captured.
 */
function keepSceneCamera(element: ConfigurableElement, list: Collection<Bookmark>): void {
  const seen = new WeakSet<Viewpoint>(list.toArray().flatMap((b) => (b.viewpoint ? [b.viewpoint] : [])));
  reactiveUtils.watch(
    () => list.map((b) => b.viewpoint).toArray(),
    () => {
      const view = element.view as CameraView | null | undefined;
      for (const bookmark of list) {
        const viewpoint = bookmark.viewpoint;
        if (!viewpoint || seen.has(viewpoint)) continue;
        seen.add(viewpoint);
        if (view?.type !== "3d" || viewpoint.camera || !view.viewpoint?.camera) continue;
        const withCamera = view.viewpoint.clone();
        seen.add(withCamera);
        bookmark.viewpoint = withCamera;
      }
    },
  );
}

/** `localStorage`, or undefined where the browser blocks it. */
function storage(): StorageLike | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}
