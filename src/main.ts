import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "./style.css";
import "@esri/calcite-components/components/calcite-shell";

import esriConfig from "@arcgis/core/config.js";
import { AppModel } from "./app/AppModel.ts";
import { ErrorChannel } from "./app/errors.ts";
import { applyRequest } from "./config/applyRequest.ts";
import { loadConfig } from "./config/load.ts";
import { validateConfig } from "./config/validate.ts";
import { applyApiKey, readApiKey } from "./credentials/apiKey.ts";
import { chooseBasemap, leaveOutKeyedToggles } from "./map/chooseBasemap.ts";
import { createMap } from "./map/createMap.ts";
import { addLayers } from "./layers/addLayers.ts";
import { createComponents, type CreateComponentsOptions } from "./components/createComponents.ts";
import { createSidebar } from "./sidebar/createSidebar.ts";
import { trackSidebarInsets } from "./sidebar/insets.ts";
import { showConfigError, showLayerErrors, showLocationError, showMapError } from "./ui/notices.ts";

// Kept for add-location-services-auth (optional OAuth sign-in):
// import { configureOAuth } from "./auth/configureOAuth.ts";

/** Startup: load config → validate → credentials and proxy → map → layers → components → sidebar. */
async function start(): Promise<void> {
  const apiKey = readApiKey(import.meta.env.VITE_ARCGIS_API_KEY);
  // Created first so every later stage can report errors; the key is redacted from reports.
  const app = new AppModel(new ErrorChannel([apiKey]));

  const loaded = await loadConfig();
  if (!loaded.ok) {
    showConfigError("The viewer could not load its configuration", [loaded.message]);
    return;
  }

  const { config, errors, warnings } = validateConfig(loaded.raw, { configUrl: loaded.url });
  for (const w of warnings) console.warn(`Viewer config: ${w.path}: ${w.message}`);
  if (!config) {
    showConfigError(
      "The viewer configuration is invalid",
      errors.map((e) => `${e.path}: ${e.message}`),
      `Fix these settings in ${loaded.url}:`,
    );
    return;
  }

  if (config.debug) enableDebug(app);

  document.title = config.app.title;
  esriConfig.portalUrl = config.portal.url;

  applyApiKey(esriConfig, apiKey);
  // Proxy settings must be in place before the first map request (design D9).
  applyRequest(esriConfig, config.request, new URL(import.meta.env.BASE_URL, location.href).href);

  const hasKey = apiKey !== undefined;
  const choice = chooseBasemap(config, hasKey);
  // Running without a key is supported: no notice, just a hint for whoever deploys the app.
  if (choice.fellBack) {
    console.info(`[viewer] No API key is configured, so "${choice.basemap}" is shown instead of "${config.map.basemap}". Set VITE_ARCGIS_API_KEY to use ArcGIS basemaps.`);
  }
  const { kept: components, leftOut } = leaveOutKeyedToggles(config.components, hasKey);
  for (const c of leftOut) {
    console.warn(`[viewer] components "${c.id}": the basemap toggle is left out because its next basemap "${String(c.options.nextBasemap)}" needs an API key. Set VITE_ARCGIS_API_KEY, or use a basemap that needs no key, such as "hybrid".`);
  }

  const shell = document.querySelector("calcite-shell");
  if (!shell) throw new Error("index.html is missing calcite-shell");

  const mapEl = createMap({
    config,
    basemap: choice.basemap,
    container: shell,
    onFailure: (reason) => {
      app.errors.report({ source: "map", message: reason });
      showMapError(reason);
    },
  });

  // The view becomes ready on its own schedule; layers don't wait for it.
  mapEl.viewOnReady().then(
    () => (app.view = mapEl.view),
    () => undefined, // reported by createMap's failure detection
  );

  // Layers start as soon as the map object exists, so the 15 s settle limit (design D5) is
  // measured from close to page load. Then, once they settle, components (design D1).
  await mapEl.componentOnReady();
  const map = mapEl.map;
  if (!map) {
    app.errors.report({ source: "map", message: "The map component did not create a map." });
    return;
  }
  const { failed } = await addLayers({ entries: config.layers, map, app });
  if (failed.length > 0) showLayerErrors(failed);

  const { panels } = await createComponents({
    entries: components,
    mapElement: mapEl as unknown as CreateComponentsOptions["mapElement"],
    app,
    onLocationError: showLocationError,
  });
  const sidebar = createSidebar({ shell, panels });
  // The sidebar floats over the map: pad the view, and inset corner UI and notices (design D4).
  if (sidebar) trackSidebarInsets(sidebar, mapEl, shell);
}

/**
 * Debug mode (app-model, P-17): expose the model as `window.app` and log every error-channel
 * report. Reports are already redacted, so the API key never reaches the console this way.
 */
function enableDebug(app: AppModel): void {
  window.app = app;
  app.errors.subscribe((r) => console.error("[viewer]", r.source, r.message, ...(r.detail ? [r.detail] : [])));
  console.info("[viewer] debug mode: the app model is available as window.app");
}

declare global {
  interface Window {
    /** The app model, in debug mode only. */
    app?: AppModel;
  }
}

void start();
