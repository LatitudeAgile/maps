# Configuration

The viewer reads its settings at startup from `config/viewer.json`, resolved against the
app's base URL. In the source tree the file is `public/config/viewer.json`; after
`npm run build` it is `dist/config/viewer.json`. Edit the deployed file and reload the page
to change the viewer: no rebuild is needed.

If the file can't be fetched, isn't valid JSON, or fails validation, the viewer shows an
error that names each problem and does not create the map. Warnings (such as unknown
settings) are written to the browser console and startup continues.

## Choosing a config by URL

One deployment can hold several configs. Add `?config=<name>` to the viewer's URL to load
`config/<name>.json` instead of `config/viewer.json`. For example, `?config=county` loads
`config/county.json` from the same folder.

The name must be 1 to 64 letters, digits, hyphens, or underscores. Paths (`../x`,
`configs/x`) and URLs are refused, and the viewer shows an error instead of loading anything,
so a link can't point the viewer at a config on another site.

If a named config doesn't exist, most servers answer 404 and the error says so. Some hosts
(and `vite preview`) instead answer missing files with the app's `index.html`. Then the error
says the config "is not valid JSON" and quotes `<!doctype`. That also means the file isn't
there.

## Example

The shipped default:

```json
{
  "app": { "title": "ArcGIS Sidebar Viewer" },
  "portal": { "url": "https://www.arcgis.com" },
  "map": {
    "basemap": "arcgis/streets",
    "fallbackBasemap": "osm",
    "center": [-98.579404, 39.828127],
    "scale": 18489298
  },
  "services": {},
  "layers": [],
  "components": []
}
```

The smallest valid config sets only `map.basemap`, `map.center`, and one of `map.zoom` or
`map.scale`.

## Settings

| Setting | Type | Default | Rule |
|---|---|---|---|
| `app` | object | `{}` | Optional section. |
| `app.title` | string | `"ArcGIS Sidebar Viewer"` | Non-empty. Becomes the browser tab title. |
| `portal` | object | `{}` | Optional section. |
| `portal.url` | string | `"https://www.arcgis.com"` | Absolute `https` URL of your ArcGIS Online organization, ArcGIS Enterprise portal (for example `https://gis.example.org/portal`), or Location Platform portal. A trailing `/` is removed. |
| `map` | object | none | **Required.** |
| `map.basemap` | string | none | **Required**, non-empty. A basemap styles ID in `provider/style` form (for example `arcgis/streets`, `arcgis/topographic`, `arcgis/imagery`), which needs an API key, or a basemap that needs none, such as `osm`. Legacy IDs such as `streets-vector` are accepted with a warning that suggests the `provider/style` equivalent. |
| `map.fallbackBasemap` | string | `"osm"` | Non-empty, and must not be a `provider/style` ID. Used instead of `map.basemap` when that basemap needs an API key and none is configured. |
| `map.center` | `[number, number]` | none | **Required.** `[longitude, latitude]` in degrees. `map.center[0]` (longitude) must be between -180 and 180; `map.center[1]` (latitude) must be between -90 and 90. |
| `map.zoom` | number | none | 0 or greater. A zoom level of the basemap's tiling scheme. Set exactly one of `map.zoom` or `map.scale`. |
| `map.scale` | number | none | Greater than 0. The map scale denominator, for example `18489298` for 1:18,489,298. Set exactly one of `map.zoom` or `map.scale`. |
| `services` | object | `{}` | Named service URLs, for example `{ "routing": "https://..." }`. Each `services.<name>` value must be an absolute `https` URL. Later versions read specific names. |
| `layers` | array | `[]` | Operational layers, one entry each. The first entry draws on top. See [Layers](#layers). |
| `layers[].id` | string | none | **Required.** 1 to 64 letters, digits, hyphens, or underscores, unique among layers. Components and the app model refer to the layer by it. |
| `layers[].type` | string | none | **Required.** One of `feature`, `map-image`, `vector-tile`, `tile`, `geojson`, `imagery`. |
| `layers[].url` | string | none | The service or file URL. Absolute `https`; a `geojson` URL may also be a path relative to the config file. Set exactly one of `url` or `portalItem`. |
| `layers[].portalItem.id` | string | none | A 32-character portal item ID, loaded from `portal.url`. Set exactly one of `url` or `portalItem`. |
| `layers[].title` | string | from the service | Non-empty. The layer's display name. |
| `layers[].visible` | boolean | `true` | Whether the layer starts visible. |
| `layers[].opacity` | number | `1` | Between 0 and 1. |
| `layers[].popupEnabled` | boolean | `true` | For `feature`, `geojson`, and `imagery` layers: `false` turns off the click popup. |
| `layers[].options` | object | `{}` | Extra layer properties passed to the SDK as they are, such as `definitionExpression` or `minScale`. **Not checked:** a misspelled property is silently ignored. |
| `layers[].hooks.preLoad` | string | none | Name of a built-in hook to run after the layer is created, before it is added to the map. See [docs/extensions.md](extensions.md). |
| `layers[].hooks.onLoad` | string | none | Name of a built-in hook to run once the layer has loaded. |
| `components` | array | `[]` | Components, one entry each, created after the layers have loaded. See [Components](#components). |
| `components[].id` | string | none | **Required.** 1 to 64 letters, digits, hyphens, or underscores, unique among components. |
| `components[].type` | string | none | **Required.** A registered component type. This version has `home`. |
| `components[].placement` | string | none | **Required.** A map corner (`top-left`, `top-right`, `bottom-left`, `bottom-right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`), `panel`, or `none`. |
| `components[].options` | object | `{}` | Settings for that component type. Unsupported settings are ignored with a console warning. |
| `debug` | boolean | `false` | `true` or `false`. When `true`, the app model is available as `window.app` in the browser console, and every runtime error report is logged to the console. Turn it off for production. |
| `request` | object | `{}` | Optional section. Routes ArcGIS requests through a proxy. |
| `request.proxyUrl` | string | none | Proxy used when a request can't be made directly, for example to a server without CORS support. An absolute `https` URL, or a path on the viewer's own site such as `proxy/forward` (resolved against the app's base URL). |
| `request.proxyRules` | array | `[]` | Requests whose URL starts with a rule's prefix always go through that rule's proxy. Each entry is `{ "urlPrefix": ..., "proxyUrl": ... }`. |
| `request.proxyRules[].urlPrefix` | string | none | **Required** in each rule. An absolute `http` or `https` URL prefix, such as `https://services.example.com/`. It only matches requests, so `http` is allowed. |
| `request.proxyRules[].proxyUrl` | string | none | **Required** in each rule. Same rule as `request.proxyUrl`. The proxy receives requests as `<proxyUrl>?<original URL>`. |

### Layers

```json
"layers": [
  {
    "id": "incidents",
    "type": "feature",
    "url": "https://services.example.com/arcgis/rest/services/Incidents/FeatureServer/0",
    "title": "311 incidents",
    "options": { "definitionExpression": "STATUS = 'Open'" }
  },
  { "id": "parcels", "type": "vector-tile", "portalItem": { "id": "0123456789abcdef0123456789abcdef" } },
  { "id": "sites", "type": "geojson", "url": "data/sites.geojson", "popupEnabled": false }
]
```

- **Draw order:** the first entry draws on top, and each later entry draws below the one
  before it. Here `incidents` is on top of `parcels`, which is on top of `sites`.
- **Sources:** each layer comes from a service or file `url`, or from a portal item. Portal
  items are read from `portal.url`, so the same config works against ArcGIS Online or an
  ArcGIS Enterprise portal. Private items need sign-in, which a later version adds; until
  then they fail to load and are reported.
- **Failures:** a layer that fails to load doesn't stop the viewer. A closable warning lists
  the IDs of the layers that couldn't load, and the rest of the map keeps working. The viewer
  waits up to 15 seconds for layers before carrying on without the slow ones.
- **Popups:** clicking a feature of a `feature`, `geojson`, or `imagery` layer opens a popup
  listing its attributes. Set `popupEnabled: false` to turn that off, or set a
  `popupTemplate` in `options` to customize it.
- **Hooks:** `hooks` names code built into the viewer that runs at a layer's `preLoad` or
  `onLoad` point. Config can't hold code, so hooks are added to the viewer's source and
  referred to by name. See [docs/extensions.md](extensions.md).

### Components

```json
"components": [
  { "id": "home", "type": "home", "placement": "top-left" },
  { "id": "home-globe", "type": "home", "placement": "bottom-right", "options": { "icon": "globe" } }
]
```

**Types**

| Type | What it is | Options |
|---|---|---|
| `home` | A button that returns the map to its configured initial view. | `icon` (string): a [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name. |

Later versions add more types, such as locate, basemap toggle, and legend.

**Placements**

- **A corner:** for example `top-left`. The component appears in that corner of the map. Several
  components in one corner stack in config order. The `-start` and `-end` corners follow the
  page's reading direction (left and right in left-to-right languages). The zoom buttons
  are always first in `top-left`.
- **`panel`:** the component belongs in the sidebar. This version has no sidebar yet, so panel
  components are accepted but not shown, and the console warns once, naming them.
- **`none`:** the component is created without any visible UI and connected to the map. It is
  useful for components that only act behind the scenes. Debug mode can find it through the app
  model.

**Layer references:** some component types (none in this version) take layers as options, for
example a legend's list of layers. Those options take layer `id`s from `layers`, such as
`"layers": ["parcels", "roads"]`, and the component receives the layers themselves. An `id` that
isn't in `layers` fails validation, and the error names the option and the id.

**Order:** components are created after every layer has loaded or failed, or after 15 seconds,
whichever comes first.

### Zoom or scale

Zoom levels come from the basemap's tiling scheme, so the same `map.zoom` can show different
areas on different basemaps. For example, `zoom: 5` is about 1:18.5M on `osm` (256 px tiles)
but about 1:9.2M on `arcgis/streets` (512 px vector tiles). If the viewer falls back to
another basemap when no API key is configured, the two can open at different scales.

`map.scale` gives the same view on every basemap, which is why the shipped config uses it.
`18489298` matches dojo-sidebar's zoom-5 view of the continental US. Scales that match a
basemap zoom level display exactly; other scales snap to the nearest level.

Setting both, or neither, is an error.

### Unknown settings

Any other top-level setting is ignored, and the viewer logs one console warning that names
it.

### No credentials in the config

The config is served to every visitor, so it must never hold a credential. A key named
`apiKey`, `token`, or `clientSecret` (any letter case), at any depth, fails validation. The
error names the setting but never shows its value. Supply the API key through the build
environment instead; see "API key" in the [README](../README.md).

## Error messages

Each problem is reported with the path of the setting and what was expected, for example:

```
map.center[1]: Expected a latitude between -90 and 90.
map.zoom: Expected a number 0 or greater.
```

All problems are listed together, so one reload shows everything to fix.
