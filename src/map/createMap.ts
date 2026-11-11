import "@arcgis/map-components/components/arcgis-map";
// The map creates <arcgis-popup> when popupComponentEnabled is set; with per-component
// imports, the element must be defined here or it never upgrades.
import "@arcgis/map-components/components/arcgis-popup";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type EsriMap from "@arcgis/core/Map.js";
import type { MapViewKind, ViewerConfig } from "../config/types.ts";
import { resolveBasemap } from "./freeBasemaps.ts";
import { viewElementTag, type ViewElement } from "./viewElement.ts";

/** How long the view may take to become ready before it counts as a failure (design D6). */
export const READY_TIMEOUT_MS = 15_000;

export interface CreateViewOptions {
  config: ViewerConfig;
  /** `"2d"` makes `arcgis-map`, `"3d"` makes `arcgis-scene` (add-web-maps-and-scenes D6). */
  view: MapViewKind;
  /** The map to show, such as a WebMap or WebScene from the app's item; absent builds one from config. */
  map?: EsriMap;
  /** Basemap ID chosen by chooseBasemap; undefined keeps the map item's own basemap. */
  basemap: string | undefined;
  /** The basemap shown needs a key, so if it fails, `map.fallbackBasemap` is tried (D9). */
  basemapNeedsKey: boolean;
  /** How the console names the basemap shown: its ID, or the item basemap's title. */
  basemapName?: string;
  /** Where to put the map. */
  container: HTMLElement;
  /** Called once, with a user-facing reason, if the map or basemap fails. */
  onFailure: (reason: string) => void;
}

const BASEMAP_FAILED =
  "The basemap service could not be reached or refused the request. Check your network connection and, if you use an API key, that it has the basemap styles privilege.";

/**
 * Create `<arcgis-map>` or `<arcgis-scene>` from a validated config, and watch for failures: the ready timeout,
 * view content/rendering errors, and basemap load errors. It adds no controls of its own: zoom
 * buttons come from a `zoom` component in the config (design D2).
 *
 * A basemap styles basemap that fails to load (a rejected key, a missing privilege) is
 * replaced once by `map.fallbackBasemap`, with a console warning and no notice; only if the
 * fallback fails too is it reported (design D9).
 */
export async function createView({ config, view, map, basemap, basemapNeedsKey, basemapName, container, onFailure }: CreateViewOptions): Promise<ViewElement> {
  // The 3D engine is loaded only for a scene, so 2D apps don't pay for it.
  const Ground = view === "3d" ? await loadSceneSupport() : undefined;
  const mapEl: ViewElement = document.createElement(viewElementTag(view));
  // Use the Popup component, not the Popup widget (deprecated since 5.2; the component becomes
  // the default at 6.0). Beta in 5.x.
  mapEl.popupComponentEnabled = true;
  // A basemap replacing an item's goes on the item's map itself: the element doesn't pass its
  // `basemap` on to a map it is given (web-maps).
  const setBasemap = (id: string) => {
    if (map) map.basemap = resolveBasemap(id) as EsriMap["basemap"];
    else mapEl.basemap = resolveBasemap(id);
  };
  if (map) mapEl.map = map;
  if (basemap !== undefined) setBasemap(basemap);
  // The ground, in 3D: Esri's world terrain, or a flat one that `elevation` layers can add to
  // (map-scenes, design D5). With a web scene it replaces the item's ground.
  if (Ground && config.map.ground !== undefined) {
    const ground = config.map.ground === "none" ? new Ground() : "world-elevation";
    if (map) map.ground = ground as EsriMap["ground"];
    else (mapEl as HTMLArcgisSceneElement).ground = ground;
  }
  // A map built from config starts at its configured view. An item's map starts at the item's
  // own view, and config overrides are applied once the view is ready (startingView.ts, D4).
  if (!map) {
    if (config.map.center) mapEl.center = [...config.map.center];
    // Exactly one is set (validateConfig). Scale is basemap-independent; zoom is not (D10).
    if (config.map.scale !== undefined) mapEl.scale = config.map.scale;
    else if (config.map.zoom !== undefined) mapEl.zoom = config.map.zoom;
  }

  let failed = false;
  const fail = (reason: string) => {
    if (failed) return;
    failed = true;
    onFailure(reason);
  };

  // The runtime fallback (D9): once, and only from a basemap that needs a key (a styles ID, or
  // an item's basemap on a basemap API host) to a different basemap.
  const fallback = config.map.fallbackBasemap;
  const canFallBack = basemapNeedsKey && fallback !== basemap;
  let fallbackStarted = false;
  // A basemap read from an item's JSON stays "loaded" when its layer fails, so its base layers
  // are checked too.
  const basemapLayerFailed = () => mapEl.map?.basemap?.baseLayers?.some((l) => l.loadStatus === "failed") ?? false;
  const basemapFailed = () => mapEl.map?.basemap?.loadStatus === "failed" || basemapLayerFailed();
  /** True when the failure is the keyed basemap's and the fallback has now been started. */
  const tryFallback = (): boolean => {
    if (!canFallBack || fallbackStarted || !basemapFailed()) return false;
    fallbackStarted = true;
    console.warn(`[viewer] The basemap "${basemap ?? basemapName}" could not be loaded, so "${fallback}" is shown instead. Check that the API key is valid and has the basemap styles privilege.`);
    setBasemap(fallback);
    raceReady(); // the fallback gets its own time to become ready
    return true;
  };
  /** View-level failures that may follow from the keyed basemap's failure wait for the fallback. */
  const viewFailed = (reason: string) => {
    if (tryFallback()) return;
    // While the fallback is loading, the view may still report the first basemap's error.
    if (fallbackStarted && mapEl.map?.basemap?.loadStatus !== "failed" && mapEl.map?.basemap?.loadStatus !== "loaded") return;
    fail(reason);
  };

  mapEl.addEventListener("arcgisViewReadyError", () => {
    viewFailed(`The map could not display its content (${mapEl.view?.readyState ?? "unknown state"}).`);
  });

  container.append(mapEl);

  // Basemap load errors, which may not move the view to an error readyState (D6, unverified).
  reactiveUtils.watch(
    () => mapEl.map?.basemap?.loadStatus,
    (status) => {
      if (status === "failed" && !tryFallback()) fail(BASEMAP_FAILED);
    },
    { initial: true },
  );

  // A failed base layer of a basemap that needs a key falls back the same way (D3, D9).
  reactiveUtils.watch(basemapLayerFailed, (layerFailed) => {
    if (layerFailed) tryFallback();
  });

  // View-level errors.
  reactiveUtils.watch(
    () => mapEl.view?.readyState,
    (state) => {
      if (state === "map-content-error" || state === "rendering-error") {
        viewFailed(`The map could not display its content (${state}).`);
      }
    },
    { initial: true },
  );

  // The ready timeout. Restarted when the fallback starts, so it measures the fallback's load.
  let attempt = 0;
  function raceReady(): void {
    const mine = ++attempt;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), READY_TIMEOUT_MS);
    });
    void Promise.race([mapEl.viewOnReady().then(() => "ready" as const), timeout])
      .then((result) => {
        if (result === "timeout" && mine === attempt) {
          fail(`The map did not become ready within ${READY_TIMEOUT_MS / 1000} seconds.`);
        }
      })
      .catch(() => {
        if (mine === attempt && !tryFallback()) fail("The map could not be created.");
      })
      .finally(() => clearTimeout(timer));
  }
  raceReady();

  return mapEl;
}

/** Define `arcgis-scene` and load the Ground class: the 3D parts, loaded on demand. */
async function loadSceneSupport() {
  const [, { default: Ground }] = await Promise.all([import("@arcgis/map-components/components/arcgis-scene"), import("@arcgis/core/Ground.js")]);
  return Ground;
}
