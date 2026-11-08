/**
 * The viewer's stack for one map corner (design D1): a single element slotted into
 * `arcgis-map` that holds everything placed in that corner, top to bottom, in the order it was
 * appended. The SDK lays out several items in a `bottom-*` slot side by side; one stack per
 * corner makes every corner read top to bottom. Created on first use; later calls for the same
 * slot return the same element.
 */
export function cornerStack(mapElement: HTMLElement, slot: string): HTMLElement {
  for (const child of mapElement.children) {
    if (child instanceof HTMLElement && child.classList.contains("corner-stack") && child.slot === slot) return child;
  }
  const stack = document.createElement("div");
  stack.className = "corner-stack";
  stack.slot = slot;
  mapElement.append(stack);
  return stack;
}
