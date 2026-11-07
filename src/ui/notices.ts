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
  closable?: boolean;
  /** Stable hook for tests and for replacing an existing notice. */
  id: string;
}

function showNotice({ kind, title, message, items, closable = false, id }: NoticeOptions): HTMLElement {
  document.getElementById(id)?.remove();

  const notice = document.createElement("calcite-notice");
  notice.id = id;
  notice.kind = kind;
  notice.icon = true;
  notice.open = true;
  notice.closable = closable;
  notice.width = "full";
  // Danger notices interrupt; the fallback notice is informational.
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

  if (closable) notice.addEventListener("calciteNoticeClose", () => notice.remove());

  region().append(notice);
  return notice;
}

/** Startup could not complete: the config is unreadable or invalid. Not closable. */
export function showConfigError(title: string, items: string[], message?: string): HTMLElement {
  return showNotice({ id: "config-error", kind: "danger", title, items, message });
}

/** The map or its basemap failed after creation. Not closable. */
export function showMapError(message: string): HTMLElement {
  return showNotice({
    id: "map-error",
    kind: "danger",
    title: "The basemap could not be loaded",
    message,
  });
}

/** The configured basemap needs a key that isn't configured. Closable. */
export function showFallbackNotice(configured: string, fallback: string): HTMLElement {
  return showNotice({
    id: "fallback-notice",
    kind: "warning",
    closable: true,
    title: "Fallback basemap in use",
    message: `No API key is configured, so the "${fallback}" basemap is shown instead of "${configured}". Set VITE_ARCGIS_API_KEY to use ArcGIS basemaps (see the README).`,
  });
}
