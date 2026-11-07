import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "./style.css";
import "@esri/calcite-components/components/calcite-shell";

import esriConfig from "@arcgis/core/config.js";
import { loadConfig } from "./config/load.ts";
import { validateConfig } from "./config/validate.ts";
import { applyApiKey, readApiKey } from "./credentials/apiKey.ts";
import { chooseBasemap } from "./map/chooseBasemap.ts";
import { createMap } from "./map/createMap.ts";
import { showConfigError, showFallbackNotice, showMapError } from "./ui/notices.ts";

// Kept for add-location-services-auth (optional OAuth sign-in):
// import { configureOAuth } from "./auth/configureOAuth.ts";

/** Startup: load config → validate → credentials → create map. */
async function start(): Promise<void> {
  const loaded = await loadConfig();
  if (!loaded.ok) {
    showConfigError("The viewer could not load its configuration", [loaded.message]);
    return;
  }

  const { config, errors, warnings } = validateConfig(loaded.raw);
  for (const w of warnings) console.warn(`Viewer config: ${w.path}: ${w.message}`);
  if (!config) {
    showConfigError(
      "The viewer configuration is invalid",
      errors.map((e) => `${e.path}: ${e.message}`),
      `Fix these settings in ${loaded.url}:`,
    );
    return;
  }

  document.title = config.app.title;
  esriConfig.portalUrl = config.portal.url;

  const apiKey = readApiKey(import.meta.env.VITE_ARCGIS_API_KEY);
  applyApiKey(esriConfig, apiKey);

  const choice = chooseBasemap(config, apiKey !== undefined);
  if (choice.fellBack) showFallbackNotice(config.map.basemap, choice.basemap);

  const shell = document.querySelector("calcite-shell");
  if (!shell) throw new Error("index.html is missing calcite-shell");

  createMap({
    config,
    basemap: choice.basemap,
    container: shell,
    onFailure: (reason) => showMapError(reason),
  });
}

void start();
