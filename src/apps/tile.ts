import "@esri/calcite-components/components/calcite-icon";
import "@esri/calcite-components/components/calcite-loader";

import { APP_PARAM, DEFAULT_CONFIG_NAME } from "../config/load.ts";
import type { AppListing } from "./listing.ts";

/** Default glyph for an app with no `app.icon`. */
export const DEFAULT_APP_ICON = "map";

/**
 * An app's icon: its glyph on a rounded tile in its theme color, or a neutral tile without a
 * theme (add-app-selector D7). Without a listing (still loading), a neutral tile with a loader.
 * Sizes: `row` (40 px) in the list, `detail` (72 px) on the app's page.
 */
export function createAppTile(listing: AppListing | undefined, size: "row" | "detail"): HTMLSpanElement {
  const tile = document.createElement("span");
  tile.classList.add("app-tile", `app-tile--${size}`);
  tile.setAttribute("aria-hidden", "true");
  if (!listing) {
    const loader = document.createElement("calcite-loader");
    loader.inline = true;
    loader.label = "Loading";
    tile.append(loader);
    return tile;
  }
  if (listing.theme) {
    tile.style.setProperty("--app-tile-color", listing.theme.color);
    tile.style.setProperty("--app-tile-glyph", listing.theme.textColor);
  }
  const icon = document.createElement("calcite-icon");
  // Not checked against Calcite's icon set, as panel icons aren't: an unknown name shows nothing.
  icon.icon = (listing.icon ?? DEFAULT_APP_ICON) as HTMLCalciteIconElement["icon"];
  icon.scale = size === "row" ? "m" : "l";
  tile.append(icon);
  return tile;
}

/**
 * The address that opens an app (D9, D12): the viewer's base URL with `?app=<name>`, or with no
 * query for the default app. Other parameters and the hash are dropped.
 */
export function appUrl(name: string, documentUrl = location.href, baseUrl = import.meta.env.BASE_URL): string {
  const url = new URL(baseUrl, documentUrl);
  url.search = name === DEFAULT_CONFIG_NAME ? "" : `?${APP_PARAM}=${encodeURIComponent(name)}`;
  url.hash = "";
  return url.href;
}
