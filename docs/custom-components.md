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
- **`format.ts` and `format.test.ts`:** keep them for your own logic, or delete them.

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

Then use it in `public/config/viewer.json`:

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

By default, each option is set as a property of the same name on your element. In the template,
`greeting` arrives through the `greeting` setter.

If your options need converting first, for example building an SDK object from a URL, give
the type a `configure(element, options, context)` hook instead. `context` has the `map`, the
app model, and the API key. Only pass the key on to ArcGIS services that need it. See the
`search`, `directions` and `basemap-gallery` entries for examples.

## 4. Finding the map

- **In a map corner,** the element is a child of `arcgis-map`, so `this.closest("arcgis-map")`
  finds it.
- **In a sidebar panel,** the element sits outside the map. The viewer sets its
  `referenceElement` property to the map, as it does for SDK components.

The template's `#findMap()` handles both. Then `await mapElement.viewOnReady()` before using
`mapElement.view`.

## 5. Clean up

Watch the view with `reactiveUtils.watch` and keep the handle. Remove the handle in
`disconnectedCallback`, so a removed component stops reacting to the map. The template's
`#generation` counter covers a component that is removed while it is still waiting for the view.

## 6. Look and feel

Use Calcite components and Calcite design tokens (`var(--calcite-color-text-1)`,
`var(--calcite-spacing-sm)`, and so on) only, so your component matches the viewer in light and
dark mode. Import each Calcite component you use, as the template does with `calcite-block`.

## 7. Test it

- **Vitest:** unit-test pure logic, as `format.test.ts` does. Unit tests run in Node, without a
  browser.
- **Playwright:** serve a config that uses your type and check what the user sees. Copy
  [`e2e/hello-world.spec.ts`](../e2e/hello-world.spec.ts). Its helpers serve a modified config,
  wait for the map, and open sidebar panels.

Run `npm run check` (typecheck and unit tests) and `npm run test:e2e`.
