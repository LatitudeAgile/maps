// Link items (map-menu; add-map-menu D10): a page opened in a new tab for the spot, with `{lat}`
// and `{lon}` filled in with six decimal places, URL-encoded. Only when the user picks one.
import { fillLinkUrl, type MapMenuEntry } from "../../config/mapMenu.ts";
import type { MapMenuItem } from "./registry.ts";

export function linkItem(entry: Extract<MapMenuEntry, { kind: "link" }>): MapMenuItem {
  return {
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    run: ({ latitude, longitude }) => {
      window.open(fillLinkUrl(entry.url, latitude, longitude), "_blank", "noopener");
    },
  };
}
