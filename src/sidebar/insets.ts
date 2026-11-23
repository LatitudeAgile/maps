import type { ViewElement } from "../map/viewElement.ts";
import type { Sidebar } from "./createSidebar.ts";

/** Viewport width from which the sidebar sits at the start side; below it, a bottom bar. */
export const WIDE_QUERY = "(min-width: 768px)";

export interface SidebarInsets {
  /** Pixels covered from the map's start (left) edge. */
  start: number;
  /** Pixels covered from the map's bottom edge. */
  bottom: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The area the sidebar covers, from the boxes of its visible parts (the icon bar and the open
 * panel). Wide: everything left of their right edge. Narrow: everything below their top edge.
 */
export function computeInsets(boxes: Box[], map: Box, wide: boolean): SidebarInsets {
  const visible = boxes.filter((b) => b.right > b.left && b.bottom > b.top);
  if (visible.length === 0) return { start: 0, bottom: 0 };
  if (wide) {
    const right = Math.max(...visible.map((b) => b.right));
    return { start: Math.max(0, Math.round(right - map.left)), bottom: 0 };
  }
  const top = Math.min(...visible.map((b) => b.top));
  return { start: 0, bottom: Math.max(0, Math.round(map.bottom - top)) };
}

/**
 * Keep three things equal to the area the sidebar covers (design D4), re-measuring on any size
 * change (open, close, collapse animation, window resize, layout switch):
 * - the map's view `padding`, so center and goTo target the visible area;
 * - arcgis-map's documented `--arcgis-layout-overlay-space-*` properties, so its corner slots,
 *   attribution and popup stay clear (see the SDK "Building your UI" guide and "Map padding"
 *   sample);
 * - `--sidebar-inset-*` on the shell, for the viewer's own notices.
 */
export function trackSidebarInsets(sidebar: Sidebar, mapElement: ViewElement, root: HTMLElement): () => void {
  const wideQuery = window.matchMedia(WIDE_QUERY);
  let frame = 0;
  let last = "";

  const parts = (): Element[] => {
    const shellPanel = sidebar.element;
    const bar = shellPanel.querySelector("calcite-action-bar");
    const open = [...shellPanel.querySelectorAll<HTMLElement>("calcite-panel")].filter((p) => !p.hidden);
    return [...(bar ? [bar] : []), ...(shellPanel.collapsed ? [] : open)];
  };

  const measure = () => {
    frame = 0;
    const insets = computeInsets(
      parts().map((el) => el.getBoundingClientRect()),
      mapElement.getBoundingClientRect(),
      wideQuery.matches,
    );
    const key = `${insets.start},${insets.bottom}`;
    if (key === last) return;
    last = key;
    mapElement.padding = { left: insets.start, right: 0, top: 0, bottom: insets.bottom };
    mapElement.style.setProperty("--arcgis-layout-overlay-space-left", `${insets.start}px`);
    mapElement.style.setProperty("--arcgis-layout-overlay-space-bottom", `${insets.bottom}px`);
    root.style.setProperty("--sidebar-inset-start", `${insets.start}px`);
    root.style.setProperty("--sidebar-inset-bottom", `${insets.bottom}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  // Size changes are measured in the observer's callback, which runs after layout and before
  // paint, so the insets land in the same frame as the change: the title box and corner UI are
  // never drawn under a bar that has just appeared (add-settings D8). Other triggers wait for
  // the next frame, when the change has been laid out.
  const observer = new ResizeObserver(() => {
    if (frame) cancelAnimationFrame(frame);
    measure();
  });
  const observeAll = () => {
    observer.disconnect();
    observer.observe(sidebar.element);
    for (const el of sidebar.element.querySelectorAll("calcite-action-bar, calcite-panel")) observer.observe(el);
  };
  observeAll();

  const stopState = sidebar.state.onChange(() => {
    schedule();
    // Calcite animates collapse; measure again once it settles.
    setTimeout(schedule, 350);
  });
  const onTransitionEnd = () => schedule();
  sidebar.element.addEventListener("transitionend", onTransitionEnd);
  window.addEventListener("resize", schedule);
  wideQuery.addEventListener("change", schedule);
  schedule();

  return () => {
    observer.disconnect();
    stopState();
    sidebar.element.removeEventListener("transitionend", onTransitionEnd);
    window.removeEventListener("resize", schedule);
    wideQuery.removeEventListener("change", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
