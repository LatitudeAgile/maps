# Finding the map

Most components work on the map: they read its center, add graphics, or react as it moves. Your
component has to find the map element first, and where it is depends on where the config places
the component.

The map element is `arcgis-map` in a 2D app and `arcgis-scene` in a 3D one (see
[3D scenes](../../configuration.md#3d-scenes)). Write your component for both, unless it only
makes sense in one. Then limit it with the manifest's `views` (see [manifest.md](../manifest.md#views)),
as the built-in `print` and `scale-bar` types do.

## In a corner or in a panel

- **In a map corner,** your element is inside the map element, so `findViewElement(this)` finds
  it.
- **In a sidebar panel,** your element sits outside the map. The viewer sets your element's
  `referenceElement` property to the map element, as it does for the SDK's own components.
- **Behind an expand button in a corner,** your element is inside the map element and the
  viewer also sets `referenceElement`.

So check `referenceElement` first, then look around the element:

```ts
import { findViewElement, type ViewElement } from "viewer";

export class TrailReport extends HTMLElement {
  /** Set by the viewer in a sidebar panel or an expand; unset straight in a corner. */
  referenceElement: ViewElement | string | undefined;

  #findMap(): ViewElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as ViewElement | null;
    return ref ?? findViewElement(this);
  }
}
```

## Waiting for the view

The viewer creates components once the map's layers have settled, but don't rely on the view
being ready when your element is connected. Wait for it:

```ts
const mapElement = this.#findMap();
if (!mapElement) return;
await mapElement.viewOnReady();
const view = mapElement.view; // a MapView in 2D, a SceneView in 3D
```

`MapView` and `SceneView` both have `center`, `scale`, `zoom`, `extent` and `map`. Check
`view.type` (`"2d"` or `"3d"`) before using anything only one of them has.

## Following the view, and cleaning up

Watch the view with `reactiveUtils.watch`, and keep the handle. Remove it in
`disconnectedCallback`, so a removed component stops reacting to the map:

```ts
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { findViewElement, type ViewElement } from "viewer";

export class TrailReport extends HTMLElement {
  referenceElement: ViewElement | string | undefined;
  #watch: ResourceHandle | undefined;
  /** Bumped on every connect and disconnect, so a stale start can tell it's stale. */
  #generation = 0;

  connectedCallback(): void {
    void this.#follow(++this.#generation);
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#watch?.remove();
    this.#watch = undefined;
  }

  async #follow(generation: number): Promise<void> {
    const ref = this.referenceElement;
    const mapElement = typeof ref === "string" ? (document.getElementById(ref) as ViewElement | null) : (ref ?? findViewElement(this));
    if (!mapElement) return;
    await mapElement.viewOnReady();
    // Removed, or removed and added again, while waiting: let the newer start do the work.
    if (generation !== this.#generation) return;
    const view = mapElement.view;
    this.#watch = reactiveUtils.watch(
      () => view.scale,
      (scale) => {
        this.textContent = `1:${Math.round(scale)}`;
      },
      { initial: true },
    );
  }
}
```

The `#generation` counter covers a component that is removed while it is still waiting for the
view. Without it, the late start would add a watch that's never removed.

`extensions/hello-world/` does all of this. Read its `HelloWorld.ts` for a complete example.
