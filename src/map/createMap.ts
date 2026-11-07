import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ViewerConfig } from "../config/types.ts";

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

/**
 * Create `<arcgis-map>` with a zoom control from a validated config, and watch for
 * failures: the ready timeout, view content/rendering errors, and basemap load errors.
 */
export function createMap({ config, basemap, container, onFailure }: CreateMapOptions): HTMLArcgisMapElement {
  const mapEl = document.createElement("arcgis-map");
  mapEl.basemap = basemap;
  mapEl.center = [...config.map.center];
  // Exactly one is set (validateConfig). Scale is basemap-independent; zoom is not (D10).
  if (config.map.scale !== undefined) mapEl.scale = config.map.scale;
  else if (config.map.zoom !== undefined) mapEl.zoom = config.map.zoom;

  const zoom = document.createElement("arcgis-zoom");
  zoom.slot = "top-left";
  mapEl.append(zoom);

  let failed = false;
  const fail = (reason: string) => {
    if (failed) return;
    failed = true;
    onFailure(reason);
  };

  mapEl.addEventListener("arcgisViewReadyError", () => {
    fail(`The map could not display its content (${mapEl.view?.readyState ?? "unknown state"}).`);
  });

  container.append(mapEl);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), READY_TIMEOUT_MS);
  });

  // Basemap load errors, which may not move the view to an error readyState (D6, unverified).
  reactiveUtils.watch(
    () => mapEl.map?.basemap?.loadStatus,
    (status) => {
      if (status === "failed") {
        fail(
          "The basemap service could not be reached or refused the request. Check your network connection and, if you use an API key, that it has the basemap styles privilege.",
        );
      }
    },
    { initial: true },
  );

  // View-level errors.
  reactiveUtils.watch(
    () => mapEl.view?.readyState,
    (state) => {
      if (state === "map-content-error" || state === "rendering-error") {
        fail(`The map could not display its content (${state}).`);
      }
    },
    { initial: true },
  );

  void Promise.race([mapEl.viewOnReady().then(() => "ready" as const), timeout])
    .then((result) => {
      if (result === "timeout") {
        fail(`The map did not become ready within ${READY_TIMEOUT_MS / 1000} seconds.`);
      }
    })
    .catch(() => fail("The map could not be created."))
    .finally(() => clearTimeout(timer));

  return mapEl;
}
