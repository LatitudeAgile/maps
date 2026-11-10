import "@esri/calcite-components/components/calcite-notice";

/** All text goes in through textContent, so config values can't inject markup. */
function region(): HTMLElement {
  const el = document.getElementById("notices");
  if (!el) throw new Error("index.html is missing the #notices region");
  return el;
}

interface NoticeOptions {
  kind: "danger" | "warning";
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

  region().append(notice);
  return notice;
}

/** Startup could not complete: the config is unreadable or invalid. No map is created. */
export function showConfigError(title: string, items: string[], message?: string): HTMLElement {
  return showNotice({ id: "config-error", kind: "danger", title, items, message });
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

/** Some configured layers failed to load. The rest of the viewer keeps working. */
export function showLayerErrors(ids: string[]): HTMLElement {
  return showNotice({
    id: "layer-errors",
    kind: "warning",
    title: ids.length === 1 ? "A layer could not be loaded" : "Some layers could not be loaded",
    message:
      ids.length === 1
        ? "The map works without it. Check the layer's URL or portal item in the config."
        : "The map works without them. Check each layer's URL or portal item in the config.",
    items: ids,
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
