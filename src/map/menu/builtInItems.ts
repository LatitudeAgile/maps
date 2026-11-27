// The built-in items and link items (map-menu; add-map-menu D7, D10): What's here?, Copy
// coordinates and Center here, and the link items from `mapMenu`. The locator, the coordinate
// formatter and the projection code load the first time an item needs them.
import { DEFAULT_GEOCODER_URL } from "../../components/geocoder.ts";
import type { MapMenuEntry, MenuCoordinateFormat } from "../../config/mapMenu.ts";
import { showCoordinatesCopied, showCoordinatesNotCopied, showWhatsHereError } from "../../ui/notices.ts";
import { formatCoordinates } from "./coordinates.ts";
import { linkItem } from "./linkItems.ts";
import type { MapMenuContext, MapMenuItem } from "./registry.ts";

/** The item for a built-in or link entry of `mapMenu`. */
export function menuItemFor(entry: Exclude<MapMenuEntry, { kind: "component" }>): MapMenuItem {
  switch (entry.kind) {
    case "whats-here":
      return { id: entry.id, label: "What's here?", icon: "pin-tear", run: (context) => whatsHere(context, entry.url ?? DEFAULT_GEOCODER_URL) };
    case "copy-coordinates":
      return { id: entry.id, label: "Copy coordinates", icon: "copy-to-clipboard", run: (context) => copyCoordinates(context, entry.format) };
    case "center-here":
      return { id: entry.id, label: "Center here", icon: "zoom-to-object", run: centerHere };
    case "link":
      return linkItem(entry);
  }
}

/** Copy the spot in `format`, and say what was copied; when the clipboard refuses, show the text. */
async function copyCoordinates(context: MapMenuContext, format: MenuCoordinateFormat): Promise<void> {
  let text: string;
  try {
    text = await formatCoordinates(context, format);
  } catch (error) {
    // The formatter's WebAssembly couldn't load: offer decimal degrees rather than nothing.
    console.error(`[viewer] Copy coordinates couldn't format the spot as ${format}.`, error);
    showCoordinatesNotCopied(await formatCoordinates(context, "dd"));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showCoordinatesCopied(text);
  } catch {
    showCoordinatesNotCopied(text);
  }
}

/** Move the map so the spot is at its center, keeping the scale, and a scene's tilt and heading. */
async function centerHere({ view, mapPoint }: MapMenuContext): Promise<void> {
  if (view.type === "2d") {
    await view.goTo({ center: mapPoint });
    return;
  }
  // `goTo({ target })` keeps tilt and heading but reframes the spot at another distance, changing
  // the scale; moving the camera by the offset from the view's center to the spot keeps all three.
  const camera = view.camera.clone();
  const center = view.center;
  camera.position.x += mapPoint.x - center.x;
  camera.position.y += mapPoint.y - center.y;
  camera.position.z = (camera.position.z ?? 0) + (mapPoint.z ?? 0) - (center.z ?? 0);
  await view.goTo(camera);
}

/** Show the address nearest the spot in a popup there, from the configured or default geocoder. */
async function whatsHere(context: MapMenuContext, url: string): Promise<void> {
  const { locationToAddress } = await import("@arcgis/core/rest/locator.js");
  let title: string;
  let content: string;
  try {
    const candidate = await locationToAddress(url, { location: context.mapPoint });
    const attributes = (candidate.attributes ?? {}) as Record<string, unknown>;
    title = String(attributes.ShortLabel || candidate.address || "Address");
    content = String(attributes.LongLabel || candidate.address || "");
  } catch (error) {
    if (!isNoMatch(error)) {
      console.error("[viewer] What's here? couldn't reach the geocoding service.", error);
      showWhatsHereError();
      return;
    }
    title = "No address found";
    content = "No address or place was found here.";
  }
  await (context.element as unknown as { openPopup(options: object): Promise<void> }).openPopup({ location: context.mapPoint, title, content });
}

/** The geocoder's answer when there's no address near the spot (HTTP 400, code 500 "Unable to find address"). */
function isNoMatch(error: unknown): boolean {
  const e = error as { details?: { httpStatus?: number; messages?: string[]; raw?: { error?: { code?: number; message?: string } } }; message?: string };
  const raw = e?.details?.raw?.error;
  const text = [e?.message, raw?.message, ...(e?.details?.messages ?? [])].join(" ");
  return /unable to find address/i.test(text) || (raw?.code === 400 && /find/i.test(text));
}
