# Configuration

The viewer reads its settings at startup from `config/viewer.json`, resolved against the
app's base URL. In the source tree the file is `public/config/viewer.json`; after
`npm run build` it is `dist/config/viewer.json`. Edit the deployed file and reload the page
to change the viewer: no rebuild is needed.

If the file can't be fetched, isn't valid JSON, or fails validation, the viewer shows an
error that names each problem and does not create the map. Warnings (such as unknown
settings) are written to the browser console and startup continues.

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
  "widgets": []
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
| `layers` | array | `[]` | Reserved for a later version: accepted, not yet used. Must be an array. |
| `widgets` | array | `[]` | Reserved for a later version: accepted, not yet used. Must be an array. |

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
