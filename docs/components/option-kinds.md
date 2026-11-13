# Option kinds

Each option in a manifest's `options` has a kind. The kind decides what a config may set it to.
The viewer checks every configured value against its kind before creating anything. A wrong
value fails validation with an error at its path, such as `components[2].options.minLength`, so
your element never sees a value of the wrong type.

```ts
options: {
  title: "string",
  minLength: "number",
  trails: "layer[]",
  unit: { oneOf: ["miles", "kilometers"] },
  maxResults: { integer: [1, 50] },
},
```

The "Your element gets" column is what the viewer sets as the property when your type has no
[`configure`](manifest.md#configure) hook. A `configure` hook gets the validated config values
instead, unconverted: layer ids and basemap IDs stay strings.

| Kind | A config may set | Your element gets |
|---|---|---|
| `"string"` | any string | the string |
| `"number"` | any finite number | the number |
| `"boolean"` | `true` or `false` | the boolean |
| `"scale"` | a number greater than 0, such as `24000` | the number |
| `"url"` | an absolute `https:` URL | the URL as a string |
| `"basemap"` | a basemap ID, such as `"osm"`, `"hybrid"` or `"arcgis/topographic"` | a `Basemap` for the free built-in basemaps, else the ID string |
| `"basemap[]"` | a non-empty list of basemap IDs | the list of ID strings |
| `"layer"` | the `id` of a layer in the app's `layers` | the `Layer` object |
| `"layer[]"` | a list of layer ids | a list of `Layer` objects |
| `"layer-info[]"` | `[{ "layer": <id>, "title": <text> }]`, `title` optional | `[{ layer: Layer, title? }]`, the SDK's LayerInfo shape |
| `"color[]"` | 1 to 12 `{ "name": <text>, "color": "#rrggbb" }` entries with unique colors | the list, with colors in lowercase |
| `"bookmark[]"` | places: `{ "name", "center": [lon, lat], "zoom" or "scale", "tilt"?, "heading"? }` | the list as configured |
| `{ oneOf: ["a", "b"] }` | one of the listed strings | the string |
| `{ integer: [1, 10] }` | a whole number in the range, ends included | the number |
| `{ listOf: ["a", "b", "c"] }` | a non-empty list of unique strings from the list | the list |

## Notes on some kinds

- **`basemap`, `basemap[]`:** legacy 3.x IDs such as `"streets"` are accepted with a warning that
  names the basemap styles ID to use instead. Basemap styles IDs such as `"arcgis/topographic"`
  need an API key; see [API keys](guides/api-keys.md) for leaving a component out, or trimming
  its options, when the build has none.
- **`layer`, `layer[]`, `layer-info[]`:** an id that isn't in the app's `layers` fails
  validation. A layer that's configured but failed to load is left out of the list, so a
  `layer` option can be `undefined`. Handle that.
- **`bookmark[]`:** `tilt` and `heading` fail validation in an app whose config sets
  `"view": "2d"`. In an app opened from an item, they are accepted and used only if it's a
  scene. Each place is checked like the app's own `map` settings.
- **Defaults:** give a default for any option your component can't work without, in the
  manifest's [`defaults`](manifest.md#defaults). Defaults aren't checked against the kind, so
  make sure each one is a valid value. Layer ids differ from app to app, so leave `layer`
  options without defaults.

## Errors a config gets

These are the messages a wrong value produces, at the option's path:

| Kind | Message |
|---|---|
| `"string"` | Expected a string. |
| `"number"` | Expected a number. |
| `"boolean"` | Expected true or false. |
| `"scale"` | Expected a number greater than 0. |
| `"url"` | Expected an https URL, such as https://geocode.arcgis.com/... |
| `"layer"` | "x" is not a configured layer. Use an id from layers. |
| `{ oneOf }` | Expected one of: a, b. |
| `{ integer }` | Expected a whole number from 1 to 10. |

An option the type doesn't list gets the warning `Not supported by the "<type>" component; it
is ignored.`, and is dropped.

## Adding a kind

The kinds are part of the viewer, in `src/components/componentType.ts` and
`src/config/components.ts`. If you need one that isn't here, take the closest one, such as
`"string"`, and check the value further in your element or your `configure` hook.
