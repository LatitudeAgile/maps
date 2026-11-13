# Container events

A component in a sidebar panel, or behind an expand button in a map corner, stays on the page
while its container is closed. When your component needs to know whether it's showing, for
example to pause work or to end an edit, it listens for two events on its own element. Both
kinds of container send the same ones.

| Event | Constant | When |
|---|---|---|
| `viewer-panel-open` | `PANEL_OPEN` | Its panel or expand has opened. |
| `viewer-panel-close` | `PANEL_CLOSE` | Its panel or expand has closed. |

The events are sent to your element and don't bubble.

```ts
import { PANEL_CLOSE, PANEL_OPEN } from "viewer";

export class TrailReport extends HTMLElement {
  connectedCallback(): void {
    this.addEventListener(PANEL_OPEN, this.#start);
    this.addEventListener(PANEL_CLOSE, this.#stop);
  }

  disconnectedCallback(): void {
    this.removeEventListener(PANEL_OPEN, this.#start);
    this.removeEventListener(PANEL_CLOSE, this.#stop);
  }

  #start = (): void => {
    // Start drawing, polling, or whatever only makes sense while the user can see it.
  };

  #stop = (): void => {
    // Pause it, and end anything half done.
  };
}
```

## How containers close

- **A sidebar panel** closes by its icon, its close button, Escape, or a switch to another panel.
  On a switch, the panel being left gets its close before the next panel's component gets its
  open.
- **An expand** closes by its button, Escape, or another expand in its group opening. The order
  of the two expands' events is the SDK's.

Escape inside a `calcite-dialog` or `calcite-popover` that your component opens closes only that
dialog or popover. The panel stays open until the next Escape.

## Opening at startup

The sidebar is shown, and its panels can be opened, before components are created. That happens
once the map's layers have settled. A panel opened before then shows a loader. If your component
is put into a panel that's already open, it gets `viewer-panel-open` right after it's attached,
so it can start as it would on a normal open. An expand configured with `"expanded": true` does
the same once it's on the page.

Straight in a map corner, or placed `none`, nothing sends these events. A component that relies
on them should do its work from `connectedCallback` when it's in neither container, or limit its
placements in the manifest to `panel` (see [manifest.md](../manifest.md#placements)).

## Asking to be opened

A component can ask for its container to be opened, for example from a popup action on the map:

```ts
import { requestPanelOpen } from "viewer";

export class TrailReport extends HTMLElement {
  #showMe(): void {
    requestPanelOpen(this);
  }
}
```

It opens the panel or expand as if the user pressed its icon or button. If it's already open,
nothing happens. In a map corner without an expand, or placed `none`, nothing listens, so the
request is safely ignored.

The built-in Sketch panel (`src/components/sketch/`) uses all of this.
