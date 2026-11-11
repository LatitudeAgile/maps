# Writing your own component

The viewer creates its components from the `components` config. Built-in types wrap ArcGIS map
components; your own types work the same way. You add the source to the repository, register
it under a type name, and configure it like any built-in type. Validation, placement (map
corners, `none`, or a sidebar panel) and panel headings and icons come for free.

The `hello-world` type in [`src/components/custom/hello-world/`](../src/components/custom/hello-world/)
is a working template. It shows a greeting from config and the map's center and scale, updating
as the map moves. Copy it to start your own.

## 1. Copy the template

Copy `src/components/custom/hello-world/` to `src/components/custom/my-component/`, then in the
copy:

- **`HelloWorld.ts`:** rename the file to `MyComponent.ts` and the class to `MyComponent`.
  Change the `HTMLElementTagNameMap` entry at the bottom to `"viewer-my-component": MyComponent`.
- **`index.ts`:** import `MyComponent` from `./MyComponent.ts`, and define it as
  `viewer-my-component`.
- **`format.ts`:** keep it for your own logic, or delete it.

Tag names start with `viewer-`, so they can't clash with `arcgis-` or `calcite-` elements. A
custom element name must contain a hyphen.

## 2. Register the type

Add an entry to `COMPONENT_TYPES` in [`src/components/registry.ts`](../src/components/registry.ts):

```ts
"my-component": {
  tag: "viewer-my-component",
  load: () => import("./custom/my-component/index.ts"),
  options: { greeting: "string" },
  defaults: { greeting: "Hello, world" },
  panel: { heading: "My component", icon: "code" },
},
```

- **`tag`** is the element to create.
- **`load`** imports the module that defines it. It runs once, the first time a config uses the
  type, so unused types cost nothing.
- **`options`** lists the options the type accepts and their kinds. See below.
- **`defaults`** fills options the config leaves out.
- **`panel`** sets the sidebar heading and [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/)
  used when the component is placed in `panel` without its own `panel` settings.

Then use it in an app's config, such as `public/apps/default.json`:

```json
{ "id": "mine", "type": "my-component", "options": { "greeting": "Hi" } }
```

## 3. Options

Each option has a kind. Validation checks the value and reports a clear error at its path,
such as `components[2].options.greeting`, before anything is created.

| Kind | Accepts |
|---|---|
| `"string"`, `"number"`, `"boolean"` | A value of that type |
| `"scale"` | A number greater than 0 |
| `"url"` | An absolute `https:` URL |
| `"basemap"`, `"basemap[]"` | A basemap ID, or a non-empty list of them. Legacy IDs get a warning. |
| `"layer"`, `"layer[]"` | A layer `id` from `layers`, or a list. The component gets the layer objects. |
| `"layer-info[]"` | `[{ "layer": <id>, "title": <text> }]` |
| `{ oneOf: ["a", "b"] }` | One of the listed strings |
| `{ integer: [1, 10] }` | A whole number in the range |
| `"color[]"` | 1 to 12 `{ "name": <text>, "color": "#rrggbb" }` entries with unique colors, given to the component in lowercase |

A type can also limit where it may be placed, with `placements: ["panel"]` for example. Any
other placement fails validation, and the error lists the ones the type supports.

By default, each option is set as a property of the same name on your element. In the template,
`greeting` arrives through the `greeting` setter.

If your options need converting first, for example building an SDK object from a URL, give
the type a `configure(element, options, context)` hook instead. `context` has the `map`, the
app model, and the API key. Only pass the key on to ArcGIS services that need it. See the
`search`, `directions` and `basemap-gallery` entries for examples.

## 4. Finding the map

The map element is `arcgis-map` in a 2D app and `arcgis-scene` in a 3D one (see
[3D scenes](configuration.md#3d-scenes)). Write your component for both unless it only makes
sense in one, and then limit its type's `views` in the registry, as `print` does.

- **In a map corner,** the element is a child of the map element, so `findViewElement(this)`
  from [`src/map/viewElement.ts`](../src/map/viewElement.ts) finds it. It looks for
  `arcgis-map` or `arcgis-scene`.
- **In a sidebar panel,** the element sits outside the map. The viewer sets its
  `referenceElement` property to the map element, as it does for SDK components.

The template's `#findMap()` handles both. Then `await mapElement.viewOnReady()` before using
`mapElement.view`, which is a `MapView` in 2D and a `SceneView` in 3D. Both have `center`,
`scale`, `zoom` and `extent`.

## 5. Clean up

Watch the view with `reactiveUtils.watch` and keep the handle. Remove the handle in
`disconnectedCallback`, so a removed component stops reacting to the map. The template's
`#generation` counter covers a component that is removed while it is still waiting for the view.

## 6. Following your panel

A component in a sidebar panel stays on the page while its panel is closed. When it needs to
know whether its panel is showing, for example to pause work or end an edit, it listens for
two events on its own element:

- `viewer-panel-open`: its panel has opened.
- `viewer-panel-close`: its panel has closed, by its icon, its close button, Escape, or a switch
  to another panel. On a switch, the panel being left gets its close before the next panel's
  component gets its open.

The sidebar is shown, and its panels can be opened, before components are created, which
happens once the map's layers have settled. A panel opened before then shows a loader. If your
component is put into a panel that is already open, it gets `viewer-panel-open` right after it
is attached, so it can start as it would on a normal open.

A component can also ask for its panel to be opened, for example from a popup action on the
map. It dispatches `viewer-panel-request-open` from its element. The event must bubble and be
composed, so it reaches the sidebar. If the panel is already open, nothing happens. Outside the
sidebar, in a map corner, nothing listens, so the request is safely ignored.

```ts
import { PANEL_CLOSE, PANEL_OPEN, requestPanelOpen } from "../../../sidebar/panelEvents.ts";

connectedCallback(): void {
  this.addEventListener(PANEL_OPEN, () => this.#start());
  this.addEventListener(PANEL_CLOSE, () => this.#stop());
}

#showMe(): void {
  requestPanelOpen(this); // dispatches viewer-panel-request-open
}
```

Escape inside a `calcite-dialog` or `calcite-popover` that your component opens closes only
that dialog or popover; the panel stays open until the next Escape. The Sketch panel
(`src/components/sketch/`) uses all of this.

## 7. Look and feel

Use Calcite components and Calcite design tokens (`var(--calcite-color-text-1)`,
`var(--calcite-spacing-sm)`, and so on) only, so your component matches the viewer in light and
dark mode. Import each Calcite component you use, as the template does with `calcite-block`.

## 8. Try it

Run `npm run check` to type-check, then `npm run dev`. Add your type to a config, in a map
corner and in a panel, and check what the user sees in both places.
