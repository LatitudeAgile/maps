# The viewer API

Code in an extension folder imports viewer features from one module, `"viewer"`:

```ts
import { API_VERSION, appStorageKey, defineComponentType, findViewElement, PANEL_CLOSE, PANEL_OPEN } from "viewer";
```

`"viewer"` is an alias for [`src/components/api.ts`](../../src/components/api.ts), set up in
`vite.config.ts` and `tsconfig.json`. Import from it instead of from other files under `src/`:
those are the viewer's internals, and they can move or change in any release.

An extension imports only from these:

- `"viewer"`;
- `@arcgis/` and `@esri/` packages;
- files in its own folder.

Then the folder works when it's copied into another copy of the viewer. A package from anywhere
else has to be added to the viewer's `package.json` (`npm install <package>`). The folder then
works only in a viewer that has that package too, so its README must say so. See
[What goes in a folder](sharing.md#what-goes-in-a-folder).

## What stays stable

Each export below keeps its name and meaning for as long as `API_VERSION` stays the same. A
release that removes or changes one raises `API_VERSION`, and the viewer then skips extensions
written for the old version, with a message that says so (see [sharing.md](sharing.md)). New
exports can be added without a new version.

`ComponentContext.app` is the viewer's whole app model. The version covers only
`app.errors.report`. Other members of `app` may change without a new version, so use them at
your own risk.

## `API_VERSION`

The viewer API version, a whole number. Your manifest states the version it was written for:

```ts
export default defineComponentType({
  apiVersion: API_VERSION,
  // ...
});
```

Using the constant means your folder always claims the version of the viewer it was last
typechecked against. If you'd rather notice a version change when you update the viewer, write
the number (`apiVersion: 1`): a viewer with a different version then skips your folder and tells
you why.

## `defineComponentType(manifest)`

Gives your manifest its type, `ExtensionManifest`, and returns it unchanged. Default-export its
result from `component.ts`:

```ts
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "viewer-trail-report",
  load: () => import("./index.ts"),
  options: { minLength: "number" },
  defaults: { minLength: 5 },
  panel: { heading: "Trail report", icon: "walking" },
});
```

Every field is described in [manifest.md](manifest.md).

## `findViewElement(element)` and `ViewElement`

`findViewElement(element)` returns the map element that `element` sits inside, or `null`.
`ViewElement` is its type: `arcgis-map` in a 2D app, `arcgis-scene` in a 3D one.

A component in a map corner sits inside the map element, so `findViewElement(this)` finds it. A
component in a sidebar panel sits outside it, and the viewer sets its `referenceElement` property
to the map element instead. Check both:

```ts
import { findViewElement, type ViewElement } from "viewer";

class TrailReport extends HTMLElement {
  referenceElement: ViewElement | string | undefined;

  findMap(): ViewElement | null {
    const ref = this.referenceElement;
    if (typeof ref === "string") return document.getElementById(ref) as ViewElement | null;
    return ref ?? findViewElement(this);
  }
}
```

See [Finding the map](guides/finding-the-map.md).

## `PANEL_OPEN` and `PANEL_CLOSE`

The names of the events your element gets when its container opens and closes:
`"viewer-panel-open"` and `"viewer-panel-close"`. The container is a sidebar panel, or an expand
button in a map corner. The events are sent to your element and don't bubble.

```ts
import { PANEL_CLOSE, PANEL_OPEN } from "viewer";

class TrailReport extends HTMLElement {
  connectedCallback(): void {
    this.addEventListener(PANEL_OPEN, () => this.start());
    this.addEventListener(PANEL_CLOSE, () => this.stop());
  }
  start(): void {}
  stop(): void {}
}
```

See [Container events](guides/container-events.md).

## `PANEL_REQUEST_OPEN` and `requestPanelOpen(element)`

`requestPanelOpen(element)` asks for the container holding `element` to open, as if the user
pressed its icon or button. If it's already open, nothing happens. Where nothing holds the
component (a map corner without an expand, or placement `none`), the request is ignored.

It dispatches the event named by `PANEL_REQUEST_OPEN` (`"viewer-panel-request-open"`) from
`element`, bubbling and composed. Use the constant only if you dispatch the event yourself.

```ts
import { requestPanelOpen } from "viewer";

class TrailReport extends HTMLElement {
  showMe(): void {
    requestPanelOpen(this);
  }
}
```

## `appStorageKey(name)`

A browser-storage key for `name` in the app that's open: `viewer:<name>:<app>`, where `<app>`
is the `?app=` name, or `default`. Use it with `localStorage` so each app keeps its own data.
Pass your type name, which no other component can have.

```ts
import { appStorageKey } from "viewer";

const key = appStorageKey("trail-report"); // "viewer:trail-report:survey-tools" in ?app=survey-tools
```

See [Saving state](guides/saving-state.md).

## Types

| Type | What it is |
|---|---|
| `ExtensionManifest` | The manifest: what `defineComponentType` takes. See [manifest.md](manifest.md). |
| `OptionKind` | An option's kind, such as `"string"` or `{ oneOf: ["a", "b"] }`. See [option-kinds.md](option-kinds.md). |
| `CornerStyle` | `"button"` or `"panel"`: how the component looks in a map corner. |
| `ComponentContext` | What a `configure` hook gets: `map`, `mapElement`, `app`, `apiKey` and `geocoding`. See [manifest.md](manifest.md#configure). |
| `ConfigurableElement` | Your element as a `configure` hook sees it: an `HTMLElement` whose properties can be set by name. |
| `KeylessResult` | What a `keyless` hook returns: `{ keep: options }` or `{ leaveOut: reason }`. |
| `ComponentPlacement` | A placement: the eight corners, `panel` or `none`. |
| `MapViewKind` | `"2d"` or `"3d"`. |
| `ExpandMode` | `"auto"`, `"floating"` or `"drawer"`. |
| `ViewElement` | The map element: `arcgis-map` or `arcgis-scene`. |
