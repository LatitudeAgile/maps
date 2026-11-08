import "@arcgis/map-components/components/arcgis-map";
// The map creates <arcgis-popup> when popupComponentEnabled is set; with per-component
// imports, the element must be defined here or it never upgrades.
import "@arcgis/map-components/components/arcgis-popup";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ViewerConfig } from "../config/types.ts";
import { isBasemapStyleId } from "./basemapIds.ts";
import { resolveBasemap } from "./freeBasemaps.ts";

/** How long the view may take to become ready before it counts as a failure (design D6). */
export const READY_TIMEOUT_MS = 15_000;

export interface CreateMapOptions {
  config: ViewerConfig;
  /** Basemap ID chosen by chooseBasemap. */
  basemap: string;
  /** Where to put the map. */
  container: HTMLElement;
  /** Called once, with a user-facing reason, if the map or basemap fails. */
  onFailure: (reason: string) => void;
}

const BASEMAP_FAILED =
  "The basemap service could not be reached or refused the request. Check your network connection and, if you use an API key, that it has the basemap styles privilege.";

/**
 * Create `<arcgis-map>` from a validated config, and watch for failures: the ready timeout,
 * view content/rendering errors, and basemap load errors. It adds no controls of its own: zoom
 * buttons come from a `zoom` component in the config (design D2).
 *
 * A basemap styles basemap that fails to load (a rejected key, a missing privilege) is
 * replaced once by `map.fallbackBasemap`, with a console warning and no notice; only if the
 * fallback fails too is it reported (design D9).
 */
export function createMap({ config, basemap, container, onFailure }: CreateMapOptions): HTMLArcgisMapElement {
  const mapEl = document.createElement("arcgis-map");
  // Use the Popup component, not the Popup widget (deprecated since 5.2; the component becomes
  // the default at 6.0). Beta in 5.x.
  mapEl.popupComponentEnabled = true;
  mapEl.basemap = resolveBasemap(basemap);
  mapEl.center = [...config.map.center];
  // Exactly one is set (validateConfig). Scale is basemap-independent; zoom is not (D10).
  if (config.map.scale !== undefined) mapEl.scale = config.map.scale;
  else if (config.map.zoom !== undefined) mapEl.zoom = config.map.zoom;

  let failed = false;
  const fail = (reason: string) => {
    if (failed) return;
    failed = true;
    onFailure(reason);
  };

  // The runtime fallback (D9): once, and only from a keyed style to a different basemap.
  const fallback = config.map.fallbackBasemap;
  const canFallBack = isBasemapStyleId(basemap) && fallback !== basemap;
  let fallbackStarted = false;
  const basemapFailed = () => mapEl.map?.basemap?.loadStatus === "failed";
  /** True when the failure is the keyed basemap's and the fallback has now been started. */
  const tryFallback = (): boolean => {
    if (!canFallBack || fallbackStarted || !basemapFailed()) return false;
    fallbackStarted = true;
    console.warn(`[viewer] The basemap "${basemap}" could not be loaded, so "${fallback}" is shown instead. Check that the API key is valid and has the basemap styles privilege.`);
    mapEl.basemap = resolveBasemap(fallback);
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
