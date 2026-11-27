# The manifest

Every extension folder has a `component.ts` that default-exports its manifest. The manifest
tells the viewer what the type is called on the page, how to load it, which options it takes,
and where it can go:

```ts
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "viewer-trail-report",
  load: () => import("./index.ts"),
  options: { minLength: "number", unit: { oneOf: ["miles", "kilometers"] } },
  defaults: { minLength: 5, unit: "miles" },
  panel: { heading: "Trail report", icon: "walking" },
  placements: ["panel", "top-right", "top-left"],
  expandable: true,
  cornerStyle: "panel",
});
```

The type's name isn't in the manifest: it's the folder's name. `extensions/trail-report/` is
used in a config as `"type": "trail-report"`.

The manifest is loaded when the viewer starts, for every app. Keep it small, and don't import
your element from it. `load` imports the element when an app first uses the type.
Import only `"viewer"` in the manifest: the manifest is built into the viewer's own code, so
anything it imports statically, such as your element or a library, is downloaded by every app,
including apps that never use your type.

The viewer checks the manifest at startup. If something is wrong, it skips the folder and logs
why. See [sharing.md](sharing.md#troubleshooting) for each reason and its fix.

| Field | Required | Default |
|---|---|---|
| [`apiVersion`](#apiversion) | yes | |
| [`tag`](#tag) | yes | |
| [`load`](#load) | yes | |
| [`panel`](#panel) | yes | |
| [`options`](#options) | yes | |
| [`defaults`](#defaults) | no | none |
| [`placements`](#placements) | no | every placement |
| [`views`](#views) | no | 2D and 3D |
| [`expandable`](#expandable) | no | not expandable |
| [`expandMode`](#expandmode) | no | `auto` |
| [`cornerStyle`](#cornerstyle) | no | none |
| [`configure`](#configure) | no | each option set as a property |
| [`keyless`](#keyless) | no | kept as is without a key |

## `apiVersion`

The viewer API version the folder was written for. The viewer skips a folder whose version it
doesn't support. Use the `API_VERSION` constant from `"viewer"`, or write the number:

```ts
apiVersion: 1,
```

See [The viewer API](viewer-api.md#api_version) for which to choose.

## `tag`

The custom element's name, the one your `index.ts` defines. It must contain a hyphen, use
lowercase letters, and not start with `arcgis-` or `calcite-`. Start it with `viewer-`, as the
scaffolder does: `viewer-trail-report`. No other type, built-in or extension, can use the same
tag.

```ts
tag: "viewer-trail-report",
```

## `load`

A function that imports the module that defines the element. It runs once, the first time an
app uses the type, so a type no app uses costs nothing:

```ts
load: () => import("./index.ts"),
```

`index.ts` defines the element if it isn't defined yet:

```ts
import { TrailReport } from "./TrailReport.ts";

if (!customElements.get("viewer-trail-report")) customElements.define("viewer-trail-report", TrailReport);
```

## `panel`

The heading and [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) the
sidebar uses when the component is placed in `panel`. An expand button in a map corner uses the
same icon, and the heading as its tooltip. A config entry can override both with its own
`panel` or `expand` settings.

```ts
panel: { heading: "Trail report", icon: "walking" },
```

## `options`

The options the type accepts, each with its kind. The viewer checks each option a config gives
against its kind, and fails validation with an error at its path, such as
`components[2].options.minLength`, before anything is created. An option the type doesn't list
gets a warning and is dropped. A type with no options has `options: {}`.

```ts
options: {
  minLength: "number",
  trails: "layer[]",
  unit: { oneOf: ["miles", "kilometers"] },
},
```

The kinds, what each accepts in a config, and what your element receives are in
[option-kinds.md](option-kinds.md).

By default the viewer sets each option as a property of the same name on your element, so your
element needs a property or setter for each:

```ts
export class TrailReport extends HTMLElement {
  #minLength = 5;
  get minLength(): number {
    return this.#minLength;
  }
  set minLength(value: number) {
    this.#minLength = value;
    this.#render();
  }
  #render(): void {}
}
```

Options are set after the element is created and before it's added to the page.

## `defaults`

Values for options the config leaves out. Validation fills them in, so your element gets them
the same way as configured values:

```ts
defaults: { minLength: 5, unit: "miles" },
```

An option without a default is left unset when the config leaves it out.

## `placements`

The only placements the type supports. A config entry with any other placement fails validation,
and the error lists the supported ones. Without `placements`, every placement is allowed:
the eight map corners (`top-left`, `top-right`, `bottom-left`, `bottom-right`, `top-start`,
`top-end`, `bottom-start`, `bottom-end`), `panel` (the default) and `none` (no UI).

```ts
placements: ["panel"],
```

Limit placements when your component only works in some places: for example, `["panel"]` for
one that needs the room of a panel or relies on its panel opening and closing.

## `views`

The views the type works in: `"2d"` (an `arcgis-map`) and `"3d"` (an `arcgis-scene`). Without
`views`, both. In an app whose config sets the view, an entry of the type in another view fails
validation. In an app opened from a web map or web scene, it's left out, with a warning.

```ts
views: ["2d"],
```

## `expandable`

`true` lets a config put the component behind an expand button in a map corner, with
`"expand": true` (see [Expand buttons](../configuration.md#components)). Without it, `expand` on
a corner entry fails validation.

```ts
expandable: true,
```

Set it once you've seen your component work in one. The popover is about 300 px wide, and on a
small map it becomes a sheet.

## `expandMode`

How the expand opens when a config entry doesn't set `expand.mode`: `"auto"` (the default),
`"floating"` or `"drawer"`. Use `"floating"` for a component the user works with on the map
while it's open, such as one that takes clicks on the map. On a small map, `"auto"` opens a
modal sheet, and a tap on the map closes it.

```ts
expandMode: "floating",
```

## `cornerStyle`

How the component looks when it's placed straight into a map corner:

- `"button"`: the shadow the SDK gives its own buttons, such as Home.
- `"panel"`: that shadow, plus a panel's width (about 300 px), a minimum size and scrolling,
  like a Legend in a corner.

Without `cornerStyle`, the viewer adds neither, and your component looks only as its own styles
make it. In an expand, the expand button always gets the button look, and a `"panel"` component
gets the panel's width in the popover. See [Look and feel](guides/look-and-feel.md).

```ts
cornerStyle: "panel",
```

## `configure`

A hook that applies the options to your element, instead of the viewer setting each one as a
property. Use it when your options need converting first, for example building an SDK object
from a URL, or when they don't map one-to-one to properties.

```ts
import { defineComponentType, type ComponentContext, type ConfigurableElement } from "viewer";

export default defineComponentType({
  // ...
  options: { trails: "layer", serviceUrl: "url" },
  configure: (element: ConfigurableElement, options: Readonly<Record<string, unknown>>, context: ComponentContext) => {
    element.trailLayer = context.map.findLayerById(options.trails as string);
    element.serviceUrl = options.serviceUrl;
  },
});
```

- `element` is your element, with its properties settable by name.
- `options` are the validated config values, with defaults filled in. Unlike options set as
  properties, they aren't converted: a `layer` option is the layer's id, which is also the
  layer's `id` on the map, so use `context.map.findLayerById(id)`.
- `context` has `map`, `mapElement` (the `arcgis-map` or `arcgis-scene`), `apiKey`,
  `geocoding` and `app`. Of `app`, only `app.errors.report` is covered by the API version.

The hook may be `async`. If it throws or its promise rejects, the component isn't shown, and the
error is reported (logged when the config sets `debug: true`). Read `context.apiKey` only if
your component calls a service that needs it; see [API keys](guides/api-keys.md).

## `keyless`

A hook for builds without an API key. It gets the validated options and returns either
`{ keep: options }`, possibly with options changed so the component works without a key, or
`{ leaveOut: reason }`, which leaves the component out of the app with a warning. It runs before
anything is created, so a left-out component sends no request.

```ts
keyless: (options) =>
  options.source === "premium"
    ? { leaveOut: "the premium trail source needs an API key" }
    : { keep: { ...options } },
```

Without `keyless`, the component is kept as configured. See [API keys](guides/api-keys.md).
