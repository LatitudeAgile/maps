# web-maps Specification

## Purpose

Lets an app take its map from a web map or web scene item on the portal, so deployers can reuse
maps built in Map Viewer or Scene Viewer, with the config overriding or adding to the item.

## Requirements

### Requirement: An app's map can come from a web map or web scene item
When `map.item.id` is set, the viewer SHALL open the map from that portal item on `portal.url`
(P-64). A web map SHALL open as a 2D map and a web scene as a 3D scene, with the item's
basemap, layers, starting view and popups, plus the item's ground for a web scene.

#### Scenario: Public web map
- **GIVEN** a public web map whose starting view is centered on Los Angeles and which has two layers
- **WHEN** an app has `"map": { "item": { "id": "<that item's id>" } }` and no `layers`
- **THEN** a 2D map opens at the web map's starting view, its layer list shows the web map's two layers by their titles, and clicking a feature opens the popup the web map defines

#### Scenario: Public web scene
- **GIVEN** a public web scene
- **WHEN** an app's `map.item.id` is that item's id
- **THEN** a 3D scene opens at the web scene's starting camera, tilted as the web scene saves it, with the web scene's layers and ground

#### Scenario: Items come from the configured portal
- **GIVEN** `portal.url` is an ArcGIS Enterprise portal
- **WHEN** an app's `map.item.id` names a public web map on that portal
- **THEN** every request for the item and its data goes to that portal's URL, and none goes to `www.arcgis.com`

### Requirement: The item setting is validated
`map.item` SHALL be an object whose `id` is a 32-character portal item ID. `map.view` SHALL NOT
be set together with `map.item`, because the item's type decides the view. Each problem SHALL
be reported by its path, and the viewer SHALL NOT start.

#### Scenario: Malformed id
- **WHEN** `map.item` is `{ "id": "parks" }`
- **THEN** validation fails with an error at `map.item.id` saying a 32-character portal item ID is expected

#### Scenario: View set with an item
- **WHEN** the config sets both `map.item` and `"view": "3d"`
- **THEN** validation fails with an error at `map.view` saying the view comes from the item's type and can't be set with `map.item`

#### Scenario: Item alone is enough
- **WHEN** the `map` section is only `{ "item": { "id": "<a valid id>" } }`
- **THEN** validation passes with no error about `map.basemap`, `map.center`, `map.zoom` or `map.scale`

### Requirement: Config settings override the item
With `map.item` set, each of `map.basemap`, `map.center`, and `map.zoom` or `map.scale` SHALL be
optional. One that is set SHALL replace the item's own value. `center` and `zoom` or `scale`
SHALL each be usable without the other, and SHALL keep the item's value for the part not set.

#### Scenario: No overrides
- **WHEN** an app has a web map item and no `basemap`, `center`, `zoom` or `scale`
- **THEN** the map opens at the web map's own starting view with the web map's basemap

#### Scenario: Scale only
- **GIVEN** a web map whose starting view is centered on longitude -118.80, latitude 34.03
- **WHEN** the app sets `map.scale` to 144448 (a zoom-level scale, so it isn't snapped to another) and no `map.center`
- **THEN** the map opens within 0.01° of that center, at a scale within 1% of 1:144,448

#### Scenario: Basemap override
- **WHEN** an app with a web map item sets `map.basemap` to `light`
- **THEN** the map shows the `light` basemap, not the web map's, along with the web map's layers

#### Scenario: Home returns to the starting view
- **GIVEN** an app with a web map item that sets `map.scale` to 144448, and a `home` component
- **WHEN** the user pans and zooms, and then presses the Home button
- **THEN** the map returns to within 0.01° of the web map's center and within 1% of 1:144,448

### Requirement: Item layers keep their own settings
The viewer SHALL show an item's layers as the item defines them, including their titles,
styling, visibility and popups. A layer entry's `hooks`, `options`, `popupEnabled`,
`showSublayers` and `hideSublayers` SHALL apply only to the config layer they belong to.

#### Scenario: Item popups
- **GIVEN** a web map whose layer has a popup that shows a single field with a custom title
- **WHEN** the user clicks a feature of that layer
- **THEN** the popup shows that title and field, not a list of every attribute

#### Scenario: Item layer hidden in the item
- **GIVEN** a web map with a layer saved as hidden
- **WHEN** the app opens and the user opens the layer list
- **THEN** that layer is listed unchecked and is not drawn

### Requirement: Component options refer only to config layers
A layer-reference option, such as the legend's `layerInfos`, SHALL accept only `id`s from the
`layers` config, as in an app without an item. Item layers SHALL still show in the legend and
the layer list whenever those components show all layers.

#### Scenario: Legend lists item layers by default
- **GIVEN** an app with a web map item with two layers, one config layer, and a `legend` panel with no `layerInfos`
- **WHEN** the user opens the Legend panel
- **THEN** it shows entries for all three layers

#### Scenario: Item layer referenced by title
- **WHEN** an app with a web map item has a `legend` whose `layerInfos` names `Parks`, the title of one of the item's layers, and no config layer has the `id` `Parks`
- **THEN** validation fails with an error at `components[0].options.layerInfos[0].layer` saying `Parks` is not a configured layer

### Requirement: Only public items open
The viewer SHALL read the item without signing in. When the item doesn't exist or isn't shared
publicly, it SHALL show an error message in the page that names the item's id and says it must
exist and be shared publicly. It SHALL NOT show a sign-in dialog or create the map.

#### Scenario: Item shared only with an organization
- **GIVEN** a web map shared only with its organization
- **WHEN** an app's `map.item.id` is that item's id
- **THEN** the page shows an error naming the id and saying the item must exist and be shared publicly, no sign-in dialog appears, and no map is shown

#### Scenario: No such item
- **WHEN** an app's `map.item.id` is a well-formed id that no item on the portal has
- **THEN** the page shows the same error naming that id, and no map is shown

#### Scenario: Other apps are still reachable
- **GIVEN** the deployment's app catalog lists other apps
- **WHEN** an app's item can't be opened
- **THEN** the Apps panel still opens and switching to another app works

### Requirement: The item must be a web map or web scene
When the item exists and is public but is neither a web map nor a web scene, the viewer SHALL
show an error message in the page that names the item's id and its type. It SHALL NOT create
the map.

#### Scenario: Feature service item
- **WHEN** an app's `map.item.id` names a public Feature Service item
- **THEN** the page shows an error naming the id and saying it is a "Feature Service", not a web map or web scene, and no map is shown

### Requirement: The portal's failure to answer is reported
When the portal can't be reached, or doesn't answer the item request within 15 seconds, the
viewer SHALL show an error message in the page that names the item's id and says the portal
could not be reached. It SHALL NOT create the map.

#### Scenario: Portal unreachable
- **WHEN** every request to the portal for the item fails with a network error
- **THEN** within 20 seconds the page shows an error naming the item's id and saying the portal could not be reached

### Requirement: An item basemap that needs a key is replaced without one
When no API key is configured and the item's basemap uses the basemap styles service, the
viewer SHALL show `map.fallbackBasemap` instead, with no notice and one console message naming
the item's basemap. No request SHALL go to the basemap styles service, and no sign-in dialog
SHALL appear.

#### Scenario: Web map on a styles basemap without a key
- **GIVEN** the app was built without an API key, and a public web map whose basemap comes from the basemap styles service
- **WHEN** an app opens that web map
- **THEN** the OpenStreetMap basemap is shown with the web map's layers, no notice and no sign-in dialog appear, the console names the web map's basemap, and no request goes to the basemap styles service

#### Scenario: Item basemap that needs no key
- **GIVEN** the app was built without an API key, and a public web map whose basemap is a public tile service
- **WHEN** an app opens that web map
- **THEN** the web map's own basemap is shown

### Requirement: An item basemap that refuses the key falls back
When an API key is configured, the item's basemap uses the basemap styles service, and that
basemap fails to load, the viewer SHALL switch to `map.fallbackBasemap` without an error
notice, and SHALL write one console warning naming the item's basemap.

#### Scenario: Key rejected for the item's basemap
- **GIVEN** the app was built with an API key, and the basemap styles service answers every request with HTTP 401
- **WHEN** an app opens a web map whose basemap comes from the basemap styles service
- **THEN** the OpenStreetMap basemap is shown with the web map's layers, no error notice appears, and one console warning names the web map's basemap

### Requirement: 3D layers in a web map app are reported as failed
When an app with a web map item lists a 3D-only layer type in `layers`, the viewer SHALL leave
that layer off the map and SHALL treat it as a failed layer: the warning notice SHALL name its
`id`, and the error channel SHALL say it needs a 3D scene.

#### Scenario: Scene layer over a web map
- **WHEN** an app with a web map item has a `scene` layer with `id` `buildings` in `layers`
- **THEN** the map opens with the web map's layers, and a warning notice names `buildings`
