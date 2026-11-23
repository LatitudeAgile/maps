import { cornerStack } from "../map/cornerStack.ts";

/**
 * Show the app title in a floating box at the top of the map's top-left corner stack (design
 * D3). Created right after the map, before layers settle, so it is first in the stack:
 * top-left components created later sit below it. Being in a map slot, it moves with the
 * sidebar through the map's overlay space, like any corner control.
 *
 * The title goes in as text, so config can't inject markup; the full text stays in the DOM
 * when CSS cuts it off with an ellipsis, so its accessible name is always the full title.
 */
export function createTitleBox(mapElement: HTMLElement, title: string): HTMLElement {
  const box = document.createElement("h1");
  box.className = "title-box";
  box.textContent = title;
  box.title = title; // full title on hover when cut off
  cornerStack(mapElement, "top-left").prepend(box);
  return box;
}

/**
 * Keep `--title-inset-top` on `root` equal to the title box's bottom edge, measured from the
 * top of `root`, so in-page notices start below the box at every width (notices spec, design
 * D6). Re-measured whenever the box or the map changes size, which covers its first layout,
 * font loading, and switching between the phone and wide layouts.
 */
export function trackTitleInset(box: HTMLElement, mapElement: HTMLElement, root: HTMLElement): () => void {
  let last = "";
  const measure = () => {
    const b = box.getBoundingClientRect();
    if (b.height === 0) return; // not laid out yet
    const value = `${Math.round(b.bottom - root.getBoundingClientRect().top)}px`;
    if (value === last) return;
    last = value;
    root.style.setProperty("--title-inset-top", value);
  };
  const observer = new ResizeObserver(() => requestAnimationFrame(measure));
  observer.observe(box);
  observer.observe(mapElement);
  return () => observer.disconnect();
}
