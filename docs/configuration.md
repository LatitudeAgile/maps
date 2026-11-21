# Configuration

Each app is a config file in the `apps/` folder. With no URL parameter, the viewer reads the
default app, `apps/default.json`, resolved against the app's base URL. In the source tree the
folder is `public/apps/`; after `npm run build` it is `dist/apps/`. Edit a deployed file and
reload the page to change that app: no rebuild is needed.

If the file can't be fetched, isn't valid JSON, or fails validation, the viewer shows an
error that names each problem and does not create the map. Warnings (such as unknown
settings) are written to the browser console and startup continues.

## Choosing an app by URL

One deployment can hold several apps. Add `?app=<name>` to the viewer's URL to load
`apps/<name>.json` instead of `apps/default.json`. For example, `?app=county` loads
`apps/county.json` from the same folder. `?app=default` opens the default app, the same as no
parameter.

The name must be 1 to 64 letters, digits, hyphens, or underscores. Paths (`../x`,
`configs/x`) and URLs are refused, and the viewer shows an error instead of loading anything,
so a link can't point the viewer at a config on another site.

If a named app doesn't exist, most servers answer 404 and the error says so. The viewer asks
for config files as JSON, which keeps the Vite dev and preview servers from answering with the
app's page instead. Some hosts still answer every missing file with the app's `index.html`.
Then the error says the config "is not valid JSON" and quotes `<!doctype`. That also means the
file isn't there. On such a host, a missing `apps/index.json` gives a console warning instead
of none.

**Moving from `config/`:** earlier versions read `config/viewer.json` and chose another config
with `?config=<name>`. Move the files to `apps/`, rename `viewer.json` to `default.json`, and
change links to `?app=<name>`. The viewer ignores `?config=`, so an old link opens the default
app. Sketches saved in the default app before the move were kept under the name `viewer`, and
no longer show.

## Apps

To let users browse a deployment's apps and switch between them, list them in
`apps/index.json`, next to the apps (`public/apps/index.json` in the source tree):

```json
{ "apps": ["default", "county", "parks"] }
```

- **What users see:** the button at the end of the sidebar's icon bar (the bottom of the bar on
  wide screens, the left end of the phone bottom bar) becomes **Apps and settings**. It opens a
  panel listing the apps in the order of `apps`, followed by the
  [Settings section](#the-settings-section). Opening an app loads the page with `?app=<name>`
  (no parameter for `default`), so the browser's Back button returns to the previous app.
- **When the list shows:** when `apps` lists at least one app other than the one open. An app
  that isn't in the list still shows the list, so a hidden app can offer the listed ones.
  Without the list, the button is a gear labelled **Settings**, holding only the Settings
  section.
- **Names** follow the `?app=` rule above. A name that doesn't, or a repeat, is skipped with a
  console warning; the rest are kept.
- **No catalog:** without `apps/index.json` there is no apps list, and nothing is logged: the
  button is the **Settings** gear. If the file can't be read, isn't valid JSON, or has no `apps`
  list, there is no apps list either, and the console says why. The open app starts normally in
  every case.
- **Not an app:** `?app=index` loads the catalog as an app's config, which fails validation.
  Don't name an app `index`.

Each app describes itself in its own config's `app` section. The Apps panel reads only that
section from the other apps' configs, after the open app has finished starting:

```json
"app": {
  "title": "Parks & Trails",
  "summary": "Trailheads and routes",
  "description": "Find a trailhead near you and plan a route.\n\nTrail data is updated weekly.",
  "icon": "tree",
  "theme": { "color": "#2e7d32" }
}
```

- **The list:** each app shows its icon, `title` and `summary`, with an **Open** button. The open
  app is marked **Current**.
- **The icon:** `icon` (default `map`) drawn on a rounded tile in `theme.color`, in
  `theme.textColor` or the higher-contrast of white and black. Without a theme, the tile is
  neutral.
- **The app's page:** selecting an app shows a larger icon, the summary, an **Open app** button,
  `description`, and **Copy link**, which copies the app's address. The description is plain
  text: a blank line (`\n\n` in JSON) starts a new paragraph, and HTML shows as typed.
- **An app that can't be read:** if its config is missing, isn't valid JSON, or has no
  `app.title`, it is listed as **Unavailable**, its page says why, and the console names its
  URL. Other mistakes in that config don't hide it; they show when it is opened.
- **Hide the apps list or the settings in an app:** set `"selectorVisible": false` in that
  app's `app` section to hide the apps list, or `"settingsVisible": false` to hide the Settings
  section. The button then holds only the other one, as **Settings** (gear) or **Apps**. With
  both `false`, there is no button.

## Example

The shipped default app (`public/apps/default.json`):

```json
{
  "app": {
    "title": "ArcGIS Sidebar Viewer",
    "summary": "Every panel: search, directions, layers, print and more",
    "description": "The full viewer, with every built-in panel: ...",
    "icon": "map",
    "theme": { "color": "#1f6f8b", "opacity": 0.85 }
  },
  "portal": { "url": "https://www.arcgis.com" },
  "map": {
    "basemap": "arcgis/streets",
    "fallbackBasemap": "osm",
    "center": [-98.579404, 39.828127],
    "scale": 18489298
  },
  "services": {},
  "layers": [
    {
      "id": "usa",
      "type": "map-image",
      "url": "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer",
      "title": "USA (sample layer: replace with your own)",
      "visible": false,
      "opacity": 0.8
    }
  ],
  "components": [
    { "id": "home", "type": "home", "placement": "bottom-right" },
    { "id": "locate", "type": "locate", "placement": "bottom-right" },
    { "id": "zoom", "type": "zoom", "placement": "bottom-right" },
    { "id": "search", "type": "search", "placement": "panel" },
    { "id": "directions", "type": "directions", "placement": "panel" },
    { "id": "layers", "type": "layer-list", "placement": "panel" },
    { "id": "legend", "type": "legend", "placement": "panel" },
    { "id": "basemaps", "type": "basemap-gallery", "placement": "panel" },
    { "id": "sketch", "type": "sketch", "placement": "panel" },
    { "id": "print", "type": "print", "placement": "panel" }
  ]
}
```

The map controls sit in the bottom-right corner, within reach of a thumb on a phone: Home,
then Locate, then the zoom buttons lowest. The seven panels form the sidebar, in the order listed
(see [Display order](#components)). There is no basemap toggle: the Basemaps panel switches
basemaps. To add one, see the `basemap-toggle` type.

**Upgrading an older config:** the map no longer adds zoom buttons by itself. To keep them, add
a `zoom` entry, for example `{ "id": "zoom", "type": "zoom", "placement": "bottom-right" }`.

The `usa` layer is a **sample**: a public Esri demo service that gives the Layers and Legend
panels something to show. It starts off (`"visible": false`); turn it on in the Layers panel.
Replace it with your own layers. If the sample service is unavailable, the viewer keeps
working and lists the layer in a "could not be loaded" notice.

The smallest valid config sets only `map.basemap`, `map.center`, and one of `map.zoom` or
`map.scale`. An app can instead open a web map or web scene from the portal with only
`map.item`: see [Web maps and web scenes](#web-maps-and-web-scenes).

## Settings

| Setting | Type | Default | Rule |
|---|---|---|---|
| `app` | object | `{}` | Optional section. |
| `app.title` | string | `"ArcGIS Sidebar Viewer"` | Non-empty. Becomes the browser tab title, and shows in the title box on the map. See [Title box](#title-box). |
| `app.titleVisible` | boolean | `true` | `true` or `false`. `false` hides the title box; `app.title` still sets the tab title. |
| `app.theme` | object | none | Colors for the sidebar's icon bar and the title box. Without it, they use Calcite's default colors. See [Theme](#theme). |
| `app.theme.color` | string | none | **Required** in `app.theme`. A hex color, `#rgb` or `#rrggbb`, such as `#1f6f8b`: the background of the icon bar and the title box. |
| `app.theme.opacity` | number | `1` | From 0 to 1. Applies to the background only: icons and the title stay fully opaque. |
| `app.theme.textColor` | string | white or black | A hex color for the icons and the title. Without it, the viewer picks white or black, whichever contrasts more with `color`. |
| `app.summary` | string | none | Non-empty. One line under the app's title in the Apps panel. See [Apps](#apps). |
| `app.description` | string | none | Plain text for the app's page in the Apps panel. A blank line starts a new paragraph. HTML is shown as text. |
| `app.icon` | string | `"map"` | Non-empty. A [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name for the app's icon in the Apps panel, drawn on a tile in `app.theme.color`. An unknown name shows an empty tile. |
| `app.selectorVisible` | boolean | `true` | `true` or `false`. `false` hides the apps list in this app, for example in a kiosk. See [Apps](#apps). |
| `app.settingsVisible` | boolean | `true` | `true` or `false`. `false` hides the Settings section in this app. See [The Settings section](#the-settings-section). |
| `app.mode` | string | `"auto"` | `"auto"`, `"light"` or `"dark"`: the mode the app starts in. `"auto"` follows the user's system light or dark mode. The user's own choice in the Settings section beats it. See [Light and dark mode](#light-and-dark-mode). |
| `portal` | object | `{}` | Optional section. |
| `portal.url` | string | `"https://www.arcgis.com"` | Absolute `https` URL of your ArcGIS Online organization, ArcGIS Enterprise portal (for example `https://gis.example.org/portal`), or Location Platform portal. A trailing `/` is removed. |
| `map` | object | none | **Required.** |
| `map.item` | object | none | A public web map or web scene on `portal.url` to open, such as `{ "id": "41281c51f9de45edaf1c8ed44bb10e30" }`. A web map opens in 2D and a web scene in 3D. With it, `map.basemap`, `map.center` and `map.zoom` or `map.scale` are optional, and each one you set overrides the item. See [Web maps and web scenes](#web-maps-and-web-scenes). |
| `map.item.id` | string | none | **Required** in `map.item`. A 32-character portal item ID. |
| `map.view` | string | `"2d"` | `"2d"` or `"3d"`. `"3d"` shows the map as a 3D scene. Not allowed with `map.item`, whose type decides. See [3D scenes](#3d-scenes). |
| `map.basemap` | string | none | **Required** unless `map.item` is set, non-empty. A basemap styles ID in `provider/style` form (for example `arcgis/streets`, `arcgis/topographic`, `arcgis/imagery`), which needs an API key, or a basemap that needs none: `osm` (OpenStreetMap), or one of Esri's public tile services: `hybrid` (imagery with roads and place names), `satellite` (imagery), `light` (light gray), or `dark` (dark gray). Legacy IDs such as `streets-vector` are accepted with a warning that suggests the `provider/style` equivalent. |
| `map.fallbackBasemap` | string | `"osm"` | Non-empty, and must not be a `provider/style` ID: `osm`, `hybrid`, `satellite`, `light`, or `dark`. Used instead of `map.basemap` when that basemap needs an API key and none is configured, or when the basemap styles service refuses the configured key (for example, an invalid key or one without the basemap styles privilege). In the second case the browser console says which basemap failed. |
| `map.center` | `[number, number]` | none | **Required** unless `map.item` is set. `[longitude, latitude]` in degrees. `map.center[0]` (longitude) must be between -180 and 180; `map.center[1]` (latitude) must be between -90 and 90. |
| `map.zoom` | number | none | 0 or greater. A zoom level of the basemap's tiling scheme. Set exactly one of `map.zoom` or `map.scale`, or at most one with `map.item`. |
| `map.scale` | number | none | Greater than 0. The map scale denominator, for example `18489298` for 1:18,489,298. Set exactly one of `map.zoom` or `map.scale`, or at most one with `map.item`. |
| `map.ground` | string | `"world-elevation"` in 3D | 3D only. `"world-elevation"` (Esri's world terrain, no API key needed) or `"none"` (a flat ground). With a web scene item, replaces its ground. |
| `map.tilt` | number | `0` | 3D only. From 0 (looking straight down) to 90 (looking at the horizon): the starting tilt in degrees. |
| `map.heading` | number | `0` | 3D only. From 0 up to, but not including, 360: the starting compass direction in degrees, 0 being north up and 90 east. |
| `services` | object | `{}` | Named service URLs, for example `{ "routing": "https://..." }`. Each `services.<name>` value must be an absolute `https` URL. Later versions read specific names. |
| `layers` | array | `[]` | Operational layers, one entry each. The first entry draws on top. See [Layers](#layers). |
| `layers[].id` | string | none | **Required.** 1 to 64 letters, digits, hyphens, or underscores, unique among layers. Components and the app model refer to the layer by it. |
| `layers[].type` | string | none | **Required.** One of `feature`, `map-image`, `vector-tile`, `tile`, `geojson`, `imagery`, or, in 3D only, `scene`, `building-scene`, `point-cloud`, `integrated-mesh`, `elevation`. See [3D layers](#layers). |
| `layers[].url` | string | none | The service or file URL. Absolute `https`; a `geojson` URL may also be a path relative to the config file. Set exactly one of `url` or `portalItem`. |
| `layers[].portalItem.id` | string | none | A 32-character portal item ID, loaded from `portal.url`. Set exactly one of `url` or `portalItem`. |
| `layers[].title` | string | from the service | Non-empty. The layer's display name. |
| `layers[].visible` | boolean | `true` | Whether the layer starts visible. |
| `layers[].opacity` | number | `1` | Between 0 and 1. |
| `layers[].popupEnabled` | boolean | `true` | For `feature`, `geojson`, `imagery` and `scene` layers: `false` turns off the click popup. |
| `layers[].showSublayers` | array | none | `map-image` layers only. Sublayer ids (whole numbers 0 or greater) to turn on once the layer loads, including ones the service has off by default. A sublayer inside a group also turns its groups on. See [Sublayers](#layers). |
| `layers[].hideSublayers` | array | none | `map-image` layers only. Sublayer ids to turn off once the layer loads. An id can't be in both lists. |
| `layers[].options` | object | `{}` | Extra layer properties passed to the SDK as they are, such as `definitionExpression` or `minScale`. **Not checked:** a misspelled property is silently ignored. |
| `layers[].hooks.preLoad` | string | none | Name of a built-in hook to run after the layer is created, before it is added to the map. See [docs/layer-hooks.md](layer-hooks.md). |
| `layers[].hooks.onLoad` | string | none | Name of a built-in hook to run once the layer has loaded. |
| `components` | array | `[]` | Components, one entry each, created after the layers have loaded. See [Components](#components). |
| `components[].id` | string | none | **Required.** 1 to 64 letters, digits, hyphens, or underscores, unique among components. |
| `components[].type` | string | none | **Required.** A registered component type. See the types under [Components](#components). |
| `components[].placement` | string | `"panel"` | A map corner (`top-left`, `top-right`, `bottom-left`, `bottom-right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`), `panel` (the sidebar), or `none`. |
| `components[].panel` | object | none | For `panel` components: how the sidebar shows them. Ignored, with a console warning, on other placements. |
| `components[].panel.heading` | string | the type's default | Non-empty. The panel's heading and its icon's accessible name, such as `"Map key"`. |
| `components[].panel.icon` | string | the type's default | A [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name for the sidebar icon, such as `"list"`. An unknown name shows no icon. |
| `components[].options` | object | `{}` | Settings for that component type. Unsupported settings are ignored with a console warning. |
| `debug` | boolean | `false` | `true` or `false`. When `true`, the app model is available as `window.app` in the browser console, and every runtime error report is logged to the console. Turn it off for production. |
| `geocoding` | object | `{}` | Optional section. Extra search sources shared by the Search panel and the Directions stop search. See [Geocoding](#geocoding). |
| `geocoding.geocoders` | array | `[]` | Additional geocoders, searched after Esri's world geocoder. Each entry is `{ "url", "name", "placeholder" }`. |
| `geocoding.geocoders[].url` | string | none | **Required** in each entry. Absolute `https` URL of a geocoding service (`.../GeocodeServer`). It must allow anonymous use: the API key is never sent to it. |
| `geocoding.geocoders[].name` | string | none | **Required** in each entry. Non-empty. Its name in the search source menu. |
| `geocoding.geocoders[].placeholder` | string | `"Find address or place"` | Non-empty. The hint in the search box while this source is selected. |
| `geocoding.places` | object | none | Turns on ArcGIS Places search: places near the map's center. Needs an API key with the Places privilege; without a key, Places is left out with a console warning. |
| `geocoding.places.radius` | number | `5000` | Whole meters, 1 to 10000. How far from the map's center to look. |
| `geocoding.places.categories` | array | `[]` | Up to 10 Places category ids to limit results to, such as `"4bf58dd8d48988d1e0931735"` (coffee shops). Empty means any category. |
| `geocoding.places.name` | string | `"Places"` | Non-empty. Its name in the search source menu. |
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
  before it. Here `incidents` is on top of `parcels`, which is on top of `sites`. In an app
  opened from a web map or web scene, all of these draw above the item's own layers.
- **Sources:** each layer comes from a service or file `url`, or from a portal item. Portal
  items are read from `portal.url`, so the same config works against ArcGIS Online or an
  ArcGIS Enterprise portal. Private items need sign-in, which a later version adds; until
  then they fail to load and are reported.
- **Failures:** a layer that fails to load doesn't stop the viewer. A closable warning lists
  the IDs of the layers that couldn't load (and the titles of an item's layers), and the rest of
  the map keeps working. The viewer waits up to 15 seconds for layers before carrying on without
  the slow ones.
- **Popups:** clicking a feature of a `feature`, `geojson`, `imagery` or `scene` layer opens a
  popup listing its attributes. Set `popupEnabled: false` to turn that off, or set a
  `popupTemplate` in `options` to customize it.
- **Sublayers:** a `map-image` service has numbered sublayers, each on or off by default.
  `showSublayers` and `hideSublayers` change only the ids they list; every other sublayer
  keeps the service's default, and users can still switch any of them in the Layers panel.

  ```json
  { "id": "usa", "type": "map-image", "url": "https://.../USA/MapServer",
    "showSublayers": [1], "hideSublayers": [3] }
  ```

  Turning on a sublayer inside a group also turns the group on, since a sublayer in a hidden
  group draws nothing. An id the service doesn't have is skipped, and the browser console names
  the layer and the id. On other layer types these settings are ignored with a warning. They
  are applied before the layer's `onLoad` hook runs, so a hook sees them. Don't use
  `options.sublayers` for this: the SDK then drops every sublayer you don't list.
- **3D layers:** `scene` (3D objects or points, such as buildings), `building-scene`,
  `point-cloud` and `integrated-mesh` work only in a 3D scene: with `"view": "3d"`, or in an app
  opened from a web scene. In a 2D app they are a config error; in an app opened from a web map
  they fail like a layer that can't load. In a global scene, use 3D data in WGS84 or Web
  Mercator: a point cloud in another coordinate system loads but isn't drawn.

  ```json
  { "id": "buildings", "type": "scene",
    "url": "https://tiles.arcgis.com/.../SanFrancisco_Bldgs/SceneServer/layers/0" }
  ```
- **Elevation layers:** an `elevation` layer (an elevation image service) shapes the scene's
  ground instead of appearing in the Layers panel. Where it has data, it wins over Esri's world
  terrain. With `"ground": "none"`, the ground uses only your elevation layers.
- **Hooks:** `hooks` names code built into the viewer that runs at a layer's `preLoad` or
  `onLoad` point. Config can't hold code, so hooks are added to the viewer's source and
  referred to by name. See [docs/layer-hooks.md](layer-hooks.md).

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
| `home` | A button that returns the map to its configured initial view. Panel default: "Home", `home` icon. | `icon` (string): a [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name. |
| `zoom` | Zoom-in and zoom-out buttons; each press changes the zoom level by one. The map adds no zoom buttons of its own: without a `zoom` entry there are none, though the mouse wheel, pinch and the keyboard still zoom. Panel default: "Zoom", `magnifying-glass-plus` icon. | None. |
| `legend` | The symbols of the map's operational layers. Panel default: "Legend", `legend` icon. | `layerInfos`: which layers to show and their titles, as `[{ "layer": "<layer id>", "title": "<text>" }]` (`title` optional); all layers when omitted. `basemapLegendVisible` (boolean, default `false`): include the basemap. `hideLayersNotInCurrentView` (boolean): hide layers with nothing in view. |
| `locate` | A button that finds the device's location, marks it on the map, and zooms to it. Panel default: "Locate", `gps-off` icon. | `scale` (number greater than 0): the scale to zoom to; the SDK chooses one when omitted. The map snaps to the basemap's nearest zoom level outward, so `10000` shows at about 1:18,056 on ArcGIS and OpenStreetMap basemaps. `icon` (string): a Calcite icon name. `popupDisabled` (boolean, default `false`): don't open a popup on the location. |
| `track` | A toggle button that keeps the map centered on the device as it moves. Press it again to stop. Panel default: "Track", `compass-north-circle` icon. | `scale` (number greater than 0): the scale to zoom to. `icon` (string): a Calcite icon name. `rotationDisabled` (boolean, default `false`): don't rotate the map to the direction of travel. |
| `basemap-toggle` | A button that switches between the map's basemap and a second one; pressing it again switches back. Panel default: "Basemap", `layer-basemap` icon. | `nextBasemap` (basemap ID, default `hybrid`): the basemap to switch to, in the same forms as `map.basemap`. A legacy ID such as `satellite` works, with a warning suggesting its basemap styles ID. `showTitle` (boolean, default `false`): show the next basemap's name. |
| `search` | Finds addresses and places as you type and zooms to the chosen result. Works without an API key: it uses Esri's public geocoder, and the key is never sent to it. Panel default: "Search", `search` icon. | `geocoderUrl` (https URL, default `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer`): the geocoding service. `maxSuggestions` (whole number 1 to 10): how many suggestions to show. `popupDisabled` (boolean, default `false`): don't open a popup on the result. |
| `directions` | Routes between stops and lists turn-by-turn directions, with a button that clears the route. Esri's world route service needs an API key with the Routing privilege; without a key, a Directions panel that uses it is left out and the browser console says why. A public route service on another host works without a key. Panel default: "Directions", `car` icon. | `routeServiceUrl` (https URL, default `https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World`): the route service. The API key is sent only to `route-api.arcgis.com` or `route.arcgis.com`. `unit` (default `miles`): one of `miles`, `kilometers`, `meters`, `feet`, `yards`, `nautical-miles`, `us-feet`, `inches`, `millimeters`, `centimeters`, `decimeters`, `metric`, `imperial`. |
| `layer-list` | Lists the map's operational layers by title, each with a checkbox that turns it on and off. Panel default: "Layers", `layers` icon. | `visibilityAppearance` (`checkbox` or `default`, default `checkbox`): `default` shows the SDK's eye icon instead. `showFilter` (boolean, default `false`): show a box that filters the list by title. `openGroups` (boolean, default `false`): show group layers opened, with their layers listed, including groups a component adds after the app starts. |
| `basemap-gallery` | Thumbnails of basemaps to choose from; the current one is marked. Without an API key, basemaps that need one are left out of the gallery (and the gallery is left out if none is left). Panel default: "Basemaps", `basemap` icon. | `basemaps` (list of basemap IDs, at least one): the basemaps to offer, in the same forms as `map.basemap`. Default: `osm`, `hybrid`, `satellite`, `light`, `dark`, `arcgis/streets`, `arcgis/topographic`, `arcgis/imagery`, `arcgis/light-gray`, `arcgis/dark-gray`. |
| `print` | **2D only.** Esri's print component as it ships: choose a layout (with a title, legend and scale bar) or the map only, a format such as PDF or JPG, and export the map to a file listed for download. Works without an API key. Panel default: "Print", `print` icon. | `printServiceUrl` (https URL): the print service's Export Web Map task, such as your ArcGIS Enterprise `.../PrintingTools/GPServer/Export%20Web%20Map%20Task`. When omitted, the viewer sets nothing and the component uses its own default, the ArcGIS Online print service. |
| `sketch` | **2D only.** Draw and write on the map: points, lines, polygons, rectangles, circles and notes, with freehand and curved segments, undo and redo, and measurements while drawing. Opening the panel turns drawing on; closing it, or switching panels, ends drawing and any selection. With the panel closed, clicking a sketch opens a popup with **Edit sketch**. Sketches are saved in the browser, separately for each app (`?app=`), and come back on reload; the Layers panel lists them as **Sketches** with a checkbox. **Panel only:** any other placement fails validation. Panel default: "Sketch", `pencil` icon. | `colors` (list of 1 to 12 `{ "name": <text>, "color": "#rrggbb" }`, unique colors): the color strip, first one chosen at first. Default: Red `#d7263d`, Blue `#1f5fd1`, Green `#1a9e3f`, Orange `#f28c00`, Black `#1a1a1a`. Users can add up to six colors of their own. `fillPercent` (whole number 0 to 100, default `0`): how filled new areas are until the user changes it; 0 draws outlines only. `unit` (`imperial` or `metric`, default `imperial`): feet and miles, or meters and kilometers, in the drawing tooltips. |
| `compass` | Shows which way north is; pressing it turns the map back to north up. Most useful in a 3D scene, or in a 2D map the user can rotate. Panel default: "Compass", `compass` icon. | None. |
| `navigation-toggle` | **3D only.** Two buttons that switch what dragging the scene does: pan (the default) or rotate around the center. Either way, dragging with the right mouse button does the other. Panel default: "Navigation", `move-and-rotate` icon. | `layout` (`vertical` or `horizontal`, default `vertical`): how the two buttons are arranged. |
| `measure` | Measures distances and areas on the map, in 2D maps and 3D scenes. With two tools, a switch at the top chooses Distance or Area. **New measurement** starts one: click points on the map, and double-click to finish. A distance shows its length (in a scene, the direct, horizontal and vertical distances between two points); an area shows its area and perimeter. **Clear** removes every measurement of both tools, and is disabled when there is nothing to clear. The unit list in the component changes units for the current tool. Panel or corner only. In an expand it opens next to its button, also on phones (see [Expand buttons](#components)). Panel default: "Measure", `measure` icon. | `tools` (list of `distance` and `area`, each at most once, default both): the tools offered, in the order shown; with one, there is no switch. `unit` (`imperial` or `metric`, default `imperial`): the unit system the tools start in; within it, the unit suits the size, such as meters for a short line and kilometers for a long one. |
| `fullscreen` | A button that shows the viewer fullscreen; pressing it again, or Escape, returns to the page. Browsers without the Fullscreen API (such as Safari on iPhone) can't: there the button does nothing. **Corner or `none` only:** `panel` fails validation. | `target` (`app` or `map`, default `app`): `app` shows the whole viewer, sidebar included; `map` shows the map alone. |
| `scale-bar` | A bar showing the map's scale, updated as it zooms. **2D only. Corner only:** with no placement, or `panel` or `none`, it fails validation. | `unit` (`imperial`, `metric` or `dual`, default `imperial`): `dual` shows both. `barStyle` (`line` or `ruler`, default `line`). |
| `bookmarks` | Places to go to: the bookmarks saved in the app's web map or web scene (`map.item`), then those in the config, then the ones the user added. Choosing one goes there. The user can add the current view as a bookmark and edit bookmarks; their own are kept in the browser (see below). With none, it says there are none. Panel default: "Bookmarks", `bookmark` icon. | `bookmarks` (list): places to add, each `{ "name": <text>, "center": [longitude, latitude], "zoom" or "scale": <number> }`, with `"tilt"` (0 to 90) and `"heading"` (0 up to 360) in a 3D scene, checked as in `map`. `showAddBookmarkButton` (boolean, default `true`): the add button, and the edit buttons with it. `showFilter` (boolean, default `false`): a box that filters the list by name. |
| `coordinate-conversion` | Shows the coordinates of the pointer, or of a clicked point, in formats the user chooses, and goes to coordinates typed in (for decimal degrees, as `39.74N 104.99W`). Converts in the browser: no service and no API key. Panel default: "Coordinates", `coordinate-system` icon. | `formats` (list of `xy`, `dd`, `ddm`, `dms`, `mgrs`, `usng`, `utm` and `basemap`, each at most once, default all): the formats offered. `xy` is longitude and latitude in degrees; `basemap` is the basemap's own coordinates. `mode` (`live` or `capture`, default `live`): follow the pointer, or show the point the user clicks. |
| `hello-world` | A template for your own component types: shows its greeting and the map's center and scale, updating as the map moves. Not in the default config. Its folder is `extensions/hello-world/`; see [Writing your own components](components/README.md). Panel default: "Hello", `code` icon. | `greeting` (string, default `"Hello, world"`): the heading it shows. |

**The location marker:** clicking the marker that `locate` or `track` puts on the map opens a
popup with the position's details and a **Remove** action that takes the marker off the map.
Pressing Locate again puts it back.

**Location components need HTTPS.** Browsers only share the device's location with pages
served over HTTPS (or from `localhost` during development). If the user denies access, or
the location times out or can't be found, a closable notice explains why. Use either
`locate` or `track`, not both: the SDK advises one location component per map.

**Basemap toggle without an API key.** The shipped config has no toggle. A toggle switches to
`hybrid` by default, which needs no key, so it works in every deployment: OpenStreetMap and hybrid without a key, ArcGIS Streets
and hybrid with one. If `nextBasemap` is a `provider/style` ID and no key is configured, the
toggle is left out and the browser console says why; otherwise the SDK would ask visitors to
sign in.

**Where sketches are kept.** Sketches stay in the visitor's browser (`localStorage`): nothing is
sent anywhere while drawing, saving or clearing. They are kept per app name, so
`?app=county` has its own. Another browser, a private window, or clearing site data starts
empty. Two tabs on the same app each save their own copy, and the last save wins. If the
browser refuses to save (storage full or blocked), the panel says so and the sketches stay on
the map until the page is closed. The chosen color, added colors and fill are remembered per
browser for every app.

**Where bookmarks come from.** `bookmarks` lists, in this order:
- the bookmarks saved in the app's web map or web scene, set up in Map Viewer or Scene Viewer.
  For example, the public web map `aa1d3f80270146208328cf66d022e09c` (City of Redlands Parks)
  has ten;
- the bookmarks in its `bookmarks` option, for any app, config-built or not;
- the bookmarks the user added.

```json
{ "id": "bookmarks", "type": "bookmarks", "options": { "bookmarks": [
  { "name": "Downtown Denver", "center": [-104.9903, 39.7392], "zoom": 15 },
  { "name": "Red Rocks", "center": [-105.2053, 39.6654], "zoom": 16 }
] } }
```

In a 3D scene, a bookmark can also set `tilt` and `heading`, as `map` does; in a 2D app they are
a config error. With `map.item`, they apply only if the item turns out to be a web scene.

**Where the user's bookmarks are kept.** Bookmarks the user adds stay in the visitor's browser
(`localStorage`), per app name like sketches, and come back after the app's other bookmarks the
next time it is opened. Renaming or deleting one is kept too. In a 3D scene, one added or
edited keeps the camera, so it returns with the same tilt and heading. Bookmarks from the web map, web
scene or config can be renamed or removed for the visit, but come back as configured on reload.
Another browser or a private window starts with none of the user's own. If the browser refuses
to save, they last until the page is closed, and the console says so.

**What coordinate conversion remembers.** The component keeps the user's chosen formats in the
browser for the session (`sessionStorage`) and restores them on reload. One in a format that
`formats` no longer offers is dropped.

**What closing Measure does.** Closing the Measure panel or expand, or switching tools, stops a
measurement in progress and removes it; clicks on the map then go to popups as usual. A finished
measurement stays on the map, and is still shown when the component opens again, until the user
presses Clear. Measurements aren't saved: a reload starts with none.

**What printing sends.** The print service draws the map on its own server, so Print sends it
the map as a web map: the basemap, the operational layers that are shown, the map's extent, the
title, and any graphics on the map, including sketches and their note text. Nothing is sent
until the user presses Export. To keep that within your organization, set `printServiceUrl` to
your own ArcGIS Enterprise print service.

**2D and 3D.** Every type works in 2D maps and 3D scenes except `print`, `sketch` and `scale-bar`
(2D only) and `navigation-toggle` (3D only). In an app whose view the config decides (`map.view`, or its
default `"2d"`), a type that doesn't support it is a config error, such as `The "print"
component works only in 2D maps.` In an app opened from an item, the view is known only once the
item is read, so such a component is left out instead: it gets no sidebar icon, and the browser
console says why. In 3D, the zoom buttons move the camera closer or farther, and Home returns to
the starting view, tilt and heading included.

**Placements**

- **A corner:** for example `bottom-right`. The component appears in that corner of the map.
  Several components in one corner form a column, one above the other, lined up on the
  corner's side. This is true in the bottom corners too: the viewer stacks them itself, where
  the SDK on its own would lay them side by side. The `-start` and `-end` corners follow the
  page's reading direction (left and right in left-to-right languages). They are separate from
  `-left` and `-right`, so mixing `bottom-right` and `bottom-end` gives two columns.
- **`panel`** (the default): the component gets an icon in the sidebar and a panel that opens
  from it. See [Sidebar](#sidebar).
- **`none`:** the component is created without any visible UI and connected to the map. It is
  useful for components that only act behind the scenes. Debug mode can find it through the app
  model.

**Expand buttons:** a component in a corner can sit behind a button that opens it over the map,
next to the button. Pressing the button again, or Escape, closes it.

```json
{ "id": "print", "type": "print", "placement": "top-right", "expand": true }
```

`"expand": true` uses the defaults. `"expand": false`, or no `expand`, shows the component
itself. An object sets any of these:

| Key | Value | Default |
|---|---|---|
| `icon` | A [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name for the button. | The type's panel icon, such as `print`. |
| `tooltip` | The button's tooltip and its name for screen readers. | The type's panel heading, such as "Print". |
| `expanded` | `true` opens it when the app starts. | `false` |
| `group` | A name. Expands with the same group close each other, in any corner. `false` puts it in no group, so it stays open when another opens. | The corner, so that opening one expand closes the others in its corner. |
| `mode` | `floating` opens it next to its button; `drawer` opens it in a sheet along an edge of the map (the bottom, for a bottom corner); `auto` lets the SDK choose by screen size (a sheet on small screens). | `auto`; `floating` for `measure` and `coordinate-conversion`, which are used on the map while open. |

- **Which types:** `legend`, `layer-list`, `basemap-gallery`, `print`, `search`, `bookmarks`,
  `coordinate-conversion`, `measure` and `hello-world`. Buttons such as `home` and `zoom` don't
  need one. Turning expand on for any other type in a corner fails validation, for example
  `components[0].expand: The "home" component can't open from an expand. These can: legend, …`.
  A custom type accepts it when its manifest has `expandable: true` (see
  [manifest.md](components/manifest.md#expandable)).
- **Corners only:** `expand` on an entry placed `panel` or `none`, or with no placement, is
  ignored, and the browser console says `Only used with a corner placement; it is ignored.`
- **Order:** the button takes the component's place in its corner, in config order.
- **Phones:** with `auto`, on a map 544 px wide or less the component opens in a sheet that rises
  from the bottom of the screen, over the sidebar's bar, until it is closed. To keep the bar in
  view, use `"mode": "floating"`: the component opens next to its button and scrolls when it is
  taller than the space there. The sheet is modal: a tap on the map closes it. That is why
  `measure` and `coordinate-conversion`, which need taps on the map, float by default.
- **Checked like other settings:** an unknown key is ignored with a warning, and a wrong value
  fails validation, such as `components[0].expand.mode: Expected one of: auto, floating, drawer.`

**Layer references:** some options take layer `id`s from `layers`, such as the legend's
`layerInfos`. The component receives the layers themselves. An `id` that isn't in `layers`
fails validation, and the error names the option and the id, for example
`components[1].options.layerInfos[0].layer: "nope" is not a configured layer`.

**Display order:** the order of the `components` list is the order on screen. There is no
separate order setting, so to move a component, move its entry.
- **Sidebar:** icons appear in the order of their entries, from top to bottom, or from right to
  left in the phone bottom bar.
- **Corners:** each corner's components appear from top to bottom in the order of their
  entries, in every corner. To put a control lowest in `bottom-right`, list it last among the
  `bottom-right` entries.
- Entries for different corners and the sidebar can be mixed in any order. Only the order
  among entries with the same placement matters.

```json
"components": [
  { "id": "search", "type": "search", "placement": "panel" },
  { "id": "home", "type": "home", "placement": "bottom-right" },
  { "id": "legend", "type": "legend", "placement": "panel" },
  { "id": "zoom", "type": "zoom", "placement": "bottom-right" }
]
```

This shows two sidebar icons, Search above Legend, and Home above the zoom buttons in the
bottom-right corner.

**When they're created:** components are created after every layer has loaded or failed, or
after 15 seconds, whichever comes first.

### Sidebar

When at least one component is placed in `panel`, the viewer shows a sidebar:

```json
"components": [
  { "id": "legend", "type": "legend", "panel": { "heading": "Map key", "icon": "list" } },
  { "id": "start", "type": "home", "panel": { "heading": "Start over" } }
]
```

- **Icons:** one per panel component, in config order. The sidebar starts collapsed.
  - Clicking an icon opens its panel. Clicking another icon switches panels.
  - Clicking the open panel's icon again, the panel's close button, or Escape collapses it.
- **Over the map:** the sidebar floats over the map, which keeps filling the window. The map
  centers and zooms within the uncovered part, and its controls, attribution, popups and the
  viewer's notices move out from under the sidebar.
- **Width:** from 768 px wide, the sidebar sits on the left. With a panel open, it is 305 px
  wide, 390 px from 992 px, and 460 px from 1200 px.
- **Height:** from 768 px wide, the icon bar and an open panel both run from the top of the map
  to just above the map's attribution line, however few icons or however little content there
  is. The attribution runs the full width of the map, under the sidebar. A panel whose content is taller
  scrolls inside the panel.
- **Phones:** below 768 px, the icons form a bar along the bottom, starting from the right: the
  first panel's icon is at the right edge, nearest your thumb, and the rest follow leftward. An
  open panel rises above the bar, covering at most 60% of the screen.
- **Popups:** a feature's popup opens beside it, undocked, on every screen. Its dock button
  docks it: on a phone at the top of the map, clear of the bottom bar and any open panel (it
  covers the title box while docked); on wider screens where the SDK puts it.
- **Keyboard:** the icon bar is one Tab stop. Tab moves into it, the arrow keys move from icon
  to icon, and Enter or Space opens the focused icon's panel. Tab again leaves the bar. Screen
  readers announce each icon by its heading and whether its panel is open. Escape closes the
  panel and returns focus to its icon.
- **Apps and settings:** an **Apps and settings** button follows the panel icons, at the end of
  the bar, or a **Settings** gear when the deployment lists no other apps (see [Apps](#apps)
  and [The Settings section](#the-settings-section)).
- **No sidebar:** with no panel components, the bar holds that button alone. There is no
  sidebar at all only when there is no button either: `app.settingsVisible` is `false` and no
  apps list is shown.

### Geocoding

```json
"geocoding": {
  "geocoders": [
    { "url": "https://gis.example.org/arcgis/rest/services/Addresses/GeocodeServer", "name": "County addresses" }
  ],
  "places": { "radius": 5000, "categories": ["4bf58dd8d48988d1e0931735"] }
}
```

- **Shared:** the Search panel and the Directions stop boxes use the same sources, in this
  order: Esri's keyless world geocoder (or Search's `geocoderUrl`), each of `geocoders`, then
  Places.
- **Source menu:** with more than one source, the search box shows a menu of sources. It
  starts on **All**, so a search covers every source. Users can pick one source to narrow it.
- **Additional geocoders** must allow anonymous use. The API key is never sent to them.
  Geocoders that need a sign-in will work once organization sign-in is added.
- **Places** finds businesses and landmarks within `radius` meters of the map's center, up to
  10 km, optionally limited to `categories`. A place far from the current view isn't found;
  the world geocoder still finds well-known places anywhere. Choosing a suggestion goes to the
  place. Pressing Enter goes to the best match.
  - It needs an API key with the **Places** privilege. Without a key, Places is left out and the
    browser console says why.
  - Places requests are billed when they return results, so the viewer sends as few as it can:
    nothing under 3 characters, only once typing pauses, and never twice for the same term at
    the same spot. Search adds its own short pause too.
  - Category ids come from the Places service's `places/categories` request, described in
    Esri's [Places REST API reference](https://developers.arcgis.com/rest/places/near-point-get/)
    under `categoryIds`.

### Title box

```json
"app": { "title": "Corporate Maps" }
```

- **Where:** `app.title` shows in a box at the top of the map's top-left corner, at every
  screen width. On wide screens it sits beside the sidebar and moves over when a panel opens.
  Components placed `top-left` appear below it.
- **When:** it appears as soon as the map does. It doesn't wait for layers to load.
- **Long titles:** the title stays on one line. If it doesn't fit, for example on a phone, it
  is cut off with "…". Screen readers still read the whole title, and hovering shows it.
- **Hide it:** set `"titleVisible": false`. The browser tab still shows `app.title`.

### Theme

```json
"app": {
  "title": "Corporate Maps",
  "theme": { "color": "#1f6f8b", "opacity": 0.85 }
}
```

- **What it colors:** the sidebar's icon bar, on wide screens and in the phone bottom bar, and
  the title box. Open panels, notices and map controls keep Calcite's colors, which follow
  the [light or dark mode](#light-and-dark-mode).
- **Opacity:** `opacity` makes the background see-through, so the map shows behind the bar.
  The icons and the title stay fully opaque. It applies to the icon bar only while the sidebar
  is closed: with a panel open, the bar is `color`, solid, beside the panel. The title box keeps
  the opacity either way. Use 0.8 or more: the lower it is, the more the map
  beneath decides how readable the text is.
- **Text color:** without `textColor`, the viewer uses white or black, whichever has the higher
  contrast with `color`. For `#1f6f8b`, that is white.
- **Contrast warning:** if the text and background colors have a contrast ratio below 4.5:1,
  the level WCAG asks for in normal text, the viewer still starts but writes a warning to the
  console with the ratio, for example
  `Viewer config: app.theme.textColor: The text and background colors have a contrast of 3.0:1, ...` for white
  on `#3a9fc0`. The ratio is measured against the opaque `color`.
- **The open panel's icon** is drawn in a darker shade of `color`, so you can see which panel
  is open.

### Light and dark mode

```json
"app": {
  "title": "Corporate Maps",
  "mode": "dark",
  "theme": { "color": "#1f6f8b", "opacity": 0.85 }
}
```

- **Default:** with no `mode`, or `"auto"`, the viewer follows the user's system light or dark
  setting: the page, the title box, the icon bar, panels, notices and map controls. If the
  user changes the system setting while the viewer is open, it switches at once, without a
  reload. The loading page and any configuration error already match the system.
- **Starting mode:** `"light"` or `"dark"` starts the app in that mode whatever the system is
  set to. `"light"` brings back the always-light look of earlier versions. Each app has its
  own mode, so opening another app from the Apps panel shows it in that app's mode.
- **The user's choice wins:** once a user picks an appearance in the
  [Settings section](#the-settings-section), every app opens in it, whatever its `mode`.
- **The basemap doesn't change:** the viewer shows `map.basemap` in both modes. A dark sidebar
  over a bright basemap is the author's choice; a neutral basemap such as `arcgis/light-gray`
  or `arcgis/dark-gray` suits both modes.
- **Theme colors are the same in both modes:** `app.theme` colors the icon bar and the title
  box the same way in light and dark mode, and its contrast warning is unchanged. Open panels
  use the current mode's colors.
- **A grid behind the map:** wherever the map draws nothing (before tiles load, past the poles,
  in an app with no basemap) the page shows a faint grid, dark lines in light mode and light
  lines in dark mode.

### The Settings section

The **Apps and settings** panel ends with a Settings section, and the **Settings** gear opens it
on its own.

- **Appearance:** System, Light or Dark. The pick applies at once, without a reload. System
  follows the system's light or dark setting, live. With nothing picked, the control shows the
  app's `app.mode`.
- **The user's choice beats `app.mode`:** the order is the user's choice, then `app.mode`, then
  the system. A stored System beats an app's forced `"light"` or `"dark"`.
- **Remembered for the whole site:** the choice is stored in the browser for this viewer
  deployment, so every app it serves opens in it, after reloads and in new tabs. Two
  deployments at different paths on one host keep separate choices. It is applied before the
  page is first drawn, so a user who picked Dark never sees a light page while the config loads.
- **Use each app's default:** shown once a choice is stored. It forgets the choice, so each app
  opens in its own `app.mode` again.
- **No storage:** in a private window or with site data blocked, the control still changes the
  mode for the open page; nothing is remembered and no notice is shown.
- **Hide it:** set `"settingsVisible": false` in an app's `app` section.

### Web maps and web scenes

An app can open a map made in Map Viewer or Scene Viewer instead of describing it piece by
piece. Name the item in `map.item`:

```json
"map": { "item": { "id": "41281c51f9de45edaf1c8ed44bb10e30" } }
```

The item is read from `portal.url`. A web map opens in 2D and a web scene in 3D, with its
basemap, layers, starting view and popups (and, for a web scene, its ground).

- **Overrides:** `map.basemap`, `map.center`, and `map.zoom` or `map.scale` are optional. Each
  one you set replaces the item's own value. `center` and `zoom` or `scale` work on their own:
  setting only `scale` keeps the item's center. With a web scene, `map.tilt`, `map.heading` and
  `map.ground` override it too. With a web map they're ignored, with a console warning.
- **Extra layers:** entries in `layers` draw above all of the item's layers, the first on top.
  The item's own layers keep the styling, visibility and popups the item gives them. `hooks`,
  `options`, `popupEnabled` and the sublayer settings apply only to your `layers` entries.
- **Component options** that name layers, such as the legend's `layerInfos`, take only `id`s
  from `layers`, not the item's layers. Without `layerInfos`, the legend and the layer list show
  every layer, the item's included.
- **Public items only:** the viewer reads the item without signing in. If the item doesn't
  exist or isn't shared with everyone, the page says `The web map or web scene "<id>" could not
  be read from <portal>. The item must exist and be shared publicly (with everyone).` If the
  item is another type, it says `Item "<id>" is a "<type>", not a web map or web scene.` In both
  cases no map is shown, but the Apps panel still works. Signing in to open private items is
  planned for a later version.
- **Basemaps that need a key:** some Map Viewer basemaps, such as the "(for Developers)" ones,
  need an API key. Without one, the viewer shows `map.fallbackBasemap` instead and writes the
  item basemap's name to the console, so no sign-in dialog appears. With a key that the
  basemap's service refuses, the viewer also falls back, with a console warning.
- **Requests:** before the map appears, the viewer requests the item and its data from the
  portal, plus the style of a vector basemap to see whether it needs a key. A layer failure in
  the item is listed by the layer's title in the "could not be loaded" notice.

### 3D scenes

Set `"view": "3d"` to show an app's map as a 3D scene: a globe with the basemap draped over
Esri's world terrain.

```json
"map": {
  "view": "3d",
  "basemap": "satellite",
  "center": [-122.40, 37.79],
  "scale": 20000,
  "tilt": 65,
  "heading": 30
}
```

- **Ground:** `map.ground` defaults to `"world-elevation"`. `"none"` gives a flat ground and
  makes no elevation requests.
- **Starting view:** `center` and `zoom` or `scale` set what the camera looks at, as in 2D.
  `tilt` and `heading` turn the camera. Home returns to this view.
- **Only in 3D:** `ground`, `tilt` and `heading` are errors in a 2D app, as are the 3D layer
  types (see [Layers](#layers)) and components that work only in 3D.
- **One view per app:** an app is 2D or 3D for its whole session. To offer both, make two apps
  and list them in the [catalog](#apps).

### Zoom or scale

Zoom levels come from the basemap's tiling scheme, so the same `map.zoom` can show different
areas on different basemaps. For example, `zoom: 5` is about 1:18.5M on `osm` (256 px tiles)
but about 1:9.2M on `arcgis/streets` (512 px vector tiles). If the viewer falls back to
another basemap when no API key is configured, the two can open at different scales.

`map.scale` gives the same view on every basemap, which is why the shipped config uses it.
`18489298` matches dojo-sidebar's zoom-5 view of the continental US. Scales that match a
basemap zoom level display exactly; other scales snap to the nearest level.

Setting both is an error, and so is setting neither unless `map.item` is set. With an item,
setting neither keeps the item's own starting view.

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

Every message on the page, errors and warnings alike, has a close button. Closing one doesn't
fix its cause: a config error shows again on the next reload until the config is fixed, and
the browser console keeps the details. Messages appear at the top of the map, below the title
box.
