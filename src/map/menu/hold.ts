// The drawing-tool hold (map-menu; add-map-menu D9): while Sketch or Measure draws, a right-click
// or long press is the tool's, so the menu doesn't open. The browser's menu stays suppressed.
const owners = new Set<object>();

/** Keep the menu from opening while `owner` draws. */
export function holdMapMenu(owner: object): void {
  owners.add(owner);
}

/** Let the menu open again, once no other owner holds it. */
export function releaseMapMenu(owner: object): void {
  owners.delete(owner);
}

export function isMapMenuHeld(): boolean {
  return owners.size > 0;
}
