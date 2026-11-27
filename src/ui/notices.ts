import "@esri/calcite-components/components/calcite-notice";

/** How long a success notice stays, like a Calcite alert's medium auto-close. */
const SUCCESS_CLOSE_MS = 10_000;

/** All text goes in through textContent, so config values can't inject markup. */
function region(): HTMLElement {
  const el = document.getElementById("notices");
  if (!el) throw new Error("index.html is missing the #notices region");
  return el;
}

interface NoticeOptions {
  kind: "danger" | "warning" | "success";
  title: string;
  message?: string;
  items?: string[];
  /** Stable hook for replacing an existing notice. */
  id: string;
}

/**
 * Every notice can be closed, errors included (notices spec). Closing removes it; it comes
 * back only if its cause happens again, or on reload.
 */
function showNotice({ kind, title, message, items, id }: NoticeOptions): HTMLElement {
  document.getElementById(id)?.remove();

  const notice = document.createElement("calcite-notice");
  notice.id = id;
  notice.kind = kind;
  notice.icon = true;
  notice.open = true;
  notice.closable = true;
  notice.width = "full";
  // Danger notices interrupt; warnings are announced politely.
  notice.setAttribute("role", kind === "danger" ? "alert" : "status");

  const titleEl = document.createElement("div");
  titleEl.slot = "title";
  titleEl.textContent = title;
  notice.append(titleEl);

  const body = document.createElement("div");
  body.slot = "message";
  if (message) {
    const p = document.createElement("div");
    p.textContent = message;
    body.append(p);
  }
  if (items?.length) {
    const ul = document.createElement("ul");
    ul.className = "notice-list";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.append(li);
    }
    body.append(ul);
  }
  notice.append(body);

  notice.addEventListener("calciteNoticeClose", () => notice.remove());
  // A success only confirms what the user did: it closes itself, as an alert's medium auto-close
  // would (calcite-notice has no auto-close of its own).
  if (kind === "success") setTimeout(() => notice.remove(), SUCCESS_CLOSE_MS);

  region().append(notice);
  return notice;
}

/** Startup could not complete: the config is unreadable or invalid. No map is created. */
export function showConfigError(title: string, items: string[], message?: string): HTMLElement {
  return showNotice({ id: "config-error", kind: "danger", title, items, message });
}

/** The app's web map or web scene item couldn't be opened, so no map is created (web-maps). */
export function showItemError(title: string, message: string): HTMLElement {
  return showNotice({ id: "item-error", kind: "danger", title, message });
}

/** The map or its basemap failed after creation. */
export function showMapError(message: string): HTMLElement {
  return showNotice({
    id: "map-error",
    kind: "danger",
    title: "The basemap could not be loaded",
    message,
  });
}

/**
 * Some layers failed to load: config layers by `id`, the map item's layers by title. The rest
 * of the viewer keeps working.
 */
export function showLayerErrors(names: string[]): HTMLElement {
  return showNotice({
    id: "layer-errors",
    kind: "warning",
    title: names.length === 1 ? "A layer could not be loaded" : "Some layers could not be loaded",
    message:
      names.length === 1
        ? "The map works without it. Check the layer's URL or portal item in the config."
        : "The map works without them. Check each layer's URL or portal item in the config.",
    items: names,
  });
}

/** What each GeolocationPositionError code means for the user (design D3). */
const LOCATION_MESSAGES: Readonly<Record<number, string>> = {
  1: "Location access was denied. Allow location access for this site in your browser's settings, then try again.",
  2: "Your device couldn't determine its location.",
  3: "Finding your location took too long. Try again.",
};

/** A locate or track component couldn't get the device's position. Replaces itself. */
export function showLocationError(code: number): HTMLElement {
  return showNotice({
    id: "location-error",
    kind: "warning",
    title: "Your location isn't available",
    message: LOCATION_MESSAGES[code] ?? LOCATION_MESSAGES[2],
  });
}

/** A map menu item's action failed (map-menu). The map and the menu keep working. */
export function showMapMenuItemError(label: string): HTMLElement {
  return showNotice({
    id: "map-menu-error",
    kind: "danger",
    title: `"${label}" didn't work`,
    message: "Something went wrong running this map menu item. The map keeps working; try again, or pick another item.",
  });
}

/** Copy coordinates wrote `text` to the clipboard (map-menu). */
export function showCoordinatesCopied(text: string): HTMLElement {
  return showNotice({ id: "map-menu-copy", kind: "success", title: "Coordinates copied", message: text });
}

/** The clipboard refused Copy coordinates: the text is shown to copy by hand (map-menu). */
export function showCoordinatesNotCopied(text: string): HTMLElement {
  return showNotice({
    id: "map-menu-copy",
    kind: "warning",
    title: "The coordinates couldn't be copied",
    message: `The browser didn't allow copying. Here they are to copy by hand: ${text}`,
  });
}

/** What's here? couldn't get an answer from the geocoding service (map-menu). */
export function showWhatsHereError(): HTMLElement {
  return showNotice({
    id: "map-menu-whats-here",
    kind: "danger",
    title: "The address couldn't be found",
    message: "The geocoding service didn't answer. Check your connection and try again; the map keeps working.",
  });
}
