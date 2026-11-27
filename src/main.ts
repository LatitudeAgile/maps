import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "./style.css";
import "@esri/calcite-components/components/calcite-shell";

import esriConfig from "@arcgis/core/config.js";
import { AppModel } from "./app/AppModel.ts";
import { ErrorChannel } from "./app/errors.ts";
import { loadCatalog } from "./apps/catalog.ts";
import { AppDirectory } from "./apps/AppDirectory.ts";
import { createAppsPanel } from "./apps/AppsPanel.ts";
import { currentListing } from "./apps/listing.ts";
import { endButton, endButtonLook } from "./apps/endButton.ts";
import { applyRequest } from "./config/applyRequest.ts";
import { configName, DEFAULT_CONFIG_NAME, loadConfig } from "./config/load.ts";
import { validateConfig } from "./config/validate.ts";
import { applyApiKey, readApiKey } from "./credentials/apiKey.ts";
import { chooseBasemap } from "./map/chooseBasemap.ts";
import { applyKeyless, leftOutWarning } from "./components/keyless.ts";
import { applyViewLimits } from "./components/viewLimits.ts";
import { createView } from "./map/createMap.ts";
import { itemErrorText, readMapItem, type MapItemResult } from "./map/portalItem.ts";
import { readItemBasemap, withoutBasemap, type ItemBasemap } from "./map/itemBasemap.ts";
import { createItemMap, neverPromptForSignIn, operationalLayers } from "./map/itemMap.ts";
import { applyStartingView, ignoredForWebMap } from "./map/startingView.ts";
import { followPopupDocking } from "./map/popupDock.ts";
import { addLayers } from "./layers/addLayers.ts";
import { createComponents, panelSlot, type CreateComponentsOptions } from "./components/createComponents.ts";
import { COMPONENT_TYPES, SKIPPED_EXTENSIONS } from "./components/registry.ts";
import { startMapMenu } from "./map/menu/openMenu.ts";
import { menuItemFor } from "./map/menu/builtInItems.ts";
import { skippedMessage } from "./components/extensions.ts";
import { createSidebar } from "./sidebar/createSidebar.ts";
import { trackAttribution } from "./map/attribution.ts";
import { trackSidebarInsets } from "./sidebar/insets.ts";
import { showConfigError, showItemError, showLayerErrors, showLocationError, showMapError } from "./ui/notices.ts";
import { createTitleBox, trackTitleInset } from "./ui/titleBox.ts";
import { applyMode, applyTheme } from "./ui/theme.ts";
import { readChoice } from "./settings/modeChoice.ts";
import { createSettingsSection } from "./settings/SettingsSection.ts";

// Kept for add-location-services-auth (optional OAuth sign-in):
// import { configureOAuth } from "./auth/configureOAuth.ts";

/**
 * Startup: load config → validate → credentials and proxy → sidebar (empty panels) → map →
 * layers → components → fill the sidebar's panels.
 */
async function start(): Promise<void> {
  const apiKey = readApiKey(import.meta.env.VITE_ARCGIS_API_KEY);
  // Created first so every later stage can report errors; the key is redacted from reports.
  const app = new AppModel(new ErrorChannel([apiKey]));
  // On every start, not only with debug: a developer needs to see why a folder isn't available.
  for (const [folder, reason] of SKIPPED_EXTENSIONS) console.warn(`Viewer extensions: ${skippedMessage(folder, reason)}`);

  // The catalog is fetched alongside the config and awaited before the sidebar is built, so the
  // bar never changes after first paint (add-app-selector D2).
  const catalogLoad = loadCatalog();
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
  const shell = document.querySelector("calcite-shell");
  if (!shell) throw new Error("index.html is missing calcite-shell");
  // Before anything themed is created, so the title box and icon bar never flash unthemed, or
  // in the wrong mode (add-color-mode D2). The user's stored choice beats `app.mode`
  // (add-settings D3).
  applyMode(readChoice() ?? config.app.mode);
  if (config.app.theme) applyTheme(shell, config.app.theme);
  esriConfig.portalUrl = config.portal.url;

  applyApiKey(esriConfig, apiKey);
  // Proxy settings must be in place before the first map request (design D9).
  applyRequest(esriConfig, config.request, new URL(import.meta.env.BASE_URL, location.href).href);
  // The app's web map or web scene, read without signing in, alongside the catalog and before
  // the sidebar, so the sidebar is built knowing the view (add-web-maps-and-scenes D1, D9).
  // Its basemap is checked too, unless the config replaces it, so the choice below can keep a
  // basemap that needs a key from ever being requested without one (D3).
  const itemRead = config.map.item ? openItem(config.portal.url, config.map.item.id, config.map.basemap === undefined) : undefined;

  const hasKey = apiKey !== undefined;
  // Places needs a key with the Places privilege; without one it's left out of every search (D16).
  const geocoding = config.geocoding.places && !hasKey ? { ...config.geocoding, places: undefined } : config.geocoding;
  if (config.geocoding.places && !hasKey) {
    console.warn("[viewer] geocoding.places is set, but no API key is configured, so Places search is left out. Set VITE_ARCGIS_API_KEY to a key with the Places privilege.");
  }
  // Without a key, leave out or trim components that would need one (design D2).
  const { kept: keylessComponents, leftOut } = applyKeyless(config.components, hasKey);
  for (const c of leftOut) console.warn(leftOutWarning(c));

  const catalogResult = await catalogLoad;
  const { read: itemResult, basemap: itemBasemap } = (await itemRead) ?? {};
  const choice = chooseBasemap(config, hasKey, itemBasemap);
  // Running without a key is supported: no notice, just a hint for whoever deploys the app.
  if (choice.fellBack) {
    console.info(`[viewer] No API key is configured, so "${choice.basemap}" is shown instead of "${choice.intended}". Set VITE_ARCGIS_API_KEY to use ArcGIS basemaps.`);
  }
  // An item that can't be opened stops startup before the map, but the sidebar still gets its
  // Apps button so the user can switch apps (add-web-maps-and-scenes D9).
  const itemFailed = itemResult !== undefined && !itemResult.ok;
  // Components that don't work in the item's view are left out before the sidebar is built (D8).
  let components = keylessComponents;
  if (itemResult?.ok) {
    const limited = applyViewLimits(keylessComponents, itemResult.view);
    components = limited.kept;
    for (const w of limited.warnings) console.warn(w);
  }

  // The sidebar comes first, from config alone, so the map, title box, corner controls and
  // notices are laid out for it from the start and don't move later (show-sidebar-at-startup
  // D1, D6). Its panels show a loader until the component stage fills them.
  const slots = itemFailed ? [] : components.filter((c) => c.placement === "panel").map((c) => panelSlot(c));
  for (const w of catalogResult.warnings) console.warn(`[viewer] ${w}`);
  // The Apps and settings button (add-app-selector D3, D4; add-settings D4). The current name is
  // the one loadConfig used.
  const currentName = configName(location.search) ?? DEFAULT_CONFIG_NAME;
  let end: Parameters<typeof createSidebar>[0]["end"];
  let apps: AppDirectory | undefined;
  const button = endButton(catalogResult.catalog, currentName, config.app);
  if (button) {
    // Listings are read only when the apps list is shown.
    if (button.apps) apps = new AppDirectory({ names: catalogResult.catalog!.names, currentName, current: currentListing(config) });
    const settings = button.settings ? createSettingsSection({ appMode: config.app.mode, heading: button.apps }) : undefined;
    end = { id: ":apps", ...endButtonLook(button), element: createAppsPanel({ directory: apps, settings }) };
  }
  const sidebar = createSidebar({ shell, slots, end });
  if (itemResult && !itemResult.ok) {
    const { title, message } = itemErrorText(itemResult);
    app.errors.report({ source: "map", message });
    showItemError(title, message);
    apps?.load();
    return;
  }

  // An item's layers may need a sign-in the viewer can't offer: fail them instead of prompting.
  if (itemResult?.ok) neverPromptForSignIn();
  // The view comes from the item's type, or from map.view (add-web-maps-and-scenes D8).
  const view = itemResult?.ok ? itemResult.view : (config.map.view ?? "2d");
  const mapEl = await createView({
    config,
    view,
    // A replaced basemap is emptied in the item's data, so the item's own is never requested (D2, D3).
    map: itemResult?.ok ? await createItemMap(itemResult, choice.basemap !== undefined ? withoutBasemap(itemResult.data) : itemResult.data) : undefined,
    basemap: choice.basemap,
    basemapNeedsKey: choice.needsKey,
    basemapName: choice.intended,
    container: shell,
    onFailure: (reason) => {
      app.errors.report({ source: "map", message: reason });
      showMapError(reason);
    },
  });
  // The sidebar floats over the map: pad the view, and inset corner UI and notices (design D4).
  // Started before the title box, so the box is placed beside the sidebar from its first paint.
  if (sidebar) trackSidebarInsets(sidebar, mapEl, shell);
  // Shown at once, not after layers settle, and first in the top-left corner (design D3).
  if (config.app.titleVisible) {
    const titleBox = createTitleBox(mapEl, config.app.title);
    // Notices start below it (design D6).
    trackTitleInset(titleBox, mapEl, shell);
  }

  // A web map is 2D: the 3D settings are ignored, with a warning each (map-scenes).
  if (itemResult?.ok && itemResult.view === "2d") {
    for (const setting of ignoredForWebMap(config.map)) {
      console.warn(`[viewer] ${setting} is set, but this app's item is a web map, which opens in 2D, so ${setting} is ignored.`);
    }
  }
  // Overrides of an item's view, and a scene's tilt and heading, once the view is ready (D4).
  const startingView = applyStartingView(mapEl, config.map, view, itemResult?.ok === true);

  // The view becomes ready on its own schedule; layers don't wait for it.
  mapEl.viewOnReady().then(
    () => {
      app.view = mapEl.view;
      // Full-width attribution, with the sidebar stopping above it (src/map/attribution.ts).
      trackAttribution(mapEl, shell);
      // The map menu, unless `"mapMenu": false` (map-menu). Components' items join it as they
      // register; a component's group is headed with its panel heading.
      if (config.mapMenu !== false && mapEl.view) {
        startMapMenu({
          element: mapEl,
          view: mapEl.view,
          entries: config.mapMenu,
          itemFor: menuItemFor,
          headingFor: (id) => {
            const entry = components.find((c) => c.id === id);
            return entry?.panel?.heading ?? (entry ? COMPONENT_TYPES[entry.type]?.panel.heading : undefined) ?? id;
          },
        });
      }
    },
    () => undefined, // reported by createView's failure detection
  );

  // Layers start as soon as the map object exists, so the 15 s settle limit (design D5) is
  // measured from close to page load. Then, once they settle, components (design D1).
  await mapEl.componentOnReady();
  const map = mapEl.map;
  if (!map) {
    app.errors.report({ source: "map", message: "The map component did not create a map." });
    // No component stage: every panel says it couldn't be loaded, rather than loading forever.
    sidebar?.fill([]);
    // Startup stops here, but the Apps panel still works, so the user can switch apps.
    apps?.load();
    return;
  }
  // The item's layers are on the map already (createItemMap loaded it), so config layers are
  // added above them, and the settle wait covers both (add-web-maps-and-scenes D7).
  const itemLayers = itemResult?.ok ? operationalLayers(map.layers) : [];
  const { failed, failedItemLayers } = await addLayers({ entries: config.layers, map, app, itemLayers, view });
  if (failed.length + failedItemLayers.length > 0) showLayerErrors([...failed, ...failedItemLayers]);

  // Components start from the settled starting view, so Home returns to it (D4).
  const homeViewpoint = await startingView;
  const { panels } = await createComponents({
    entries: components,
    mapElement: mapEl as unknown as CreateComponentsOptions["mapElement"],
    app,
    onLocationError: showLocationError,
    map,
    apiKey,
    geocoding,
    homeViewpoint,
  });
  // Panels whose component failed are missing from `panels`; their panels say so (D5).
  sidebar?.fill(panels);
  // Startup is done: read the other apps' listings now, if the Apps panel hasn't already (D5).
  apps?.load();
  // Popups open undocked everywhere; docked by the user on a phone, they go to the top, clear
  // of the bottom bar (add-print-and-sketch-panels D14).
  mapEl.viewOnReady().then(
    () => followPopupDocking(mapEl as unknown as Parameters<typeof followPopupDocking>[0]),
    () => undefined,
  );
}

/** Read the app's item and, when asked, what its basemap needs (add-web-maps-and-scenes D1, D3). */
async function openItem(portalUrl: string, id: string, checkBasemap: boolean): Promise<{ read: MapItemResult; basemap?: ItemBasemap }> {
  const read = await readMapItem(portalUrl, id);
  if (!read.ok || !checkBasemap) return { read };
  return { read, basemap: await readItemBasemap(read.data.baseMap, portalUrl) };
}

/**
 * Debug mode (app-model): expose the model as `window.app` and log every error-channel
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
