# map-layers Specification

## Purpose

Defines how the viewer adds operational layers from its config: which layer types and sources
are supported, their draw order, per-layer load hooks, what happens when a layer fails, and
popups on click.

## Requirements

### Requirement: Layers are created from config
The viewer SHALL add each entry of the `layers` config array to the map as a layer of the
entry's `type`: `feature`, `map-image`, `vector-tile`, `tile`, `geojson`, or `imagery`. The
layer's source SHALL be its `url`, or else its `portalItem.id`. It SHALL apply the entry's
`title`, `visible`, and `opacity` when given.

#### Scenario: GeoJSON layer from config is shown
- **WHEN** the config has a `geojson` layer whose `url` points to a GeoJSON file with three points
- **THEN** the map contains a layer with that entry's `id`, and three features are drawn

#### Scenario: Every type is created from its source
- **WHEN** the config has one layer of each supported type, some by `url` and some by `portalItem.id`
- **THEN** each created layer is of the matching kind and carries the configured source, title, visibility, and opacity

#### Scenario: Live services
- **WHEN** the config has one layer of each type pointing to a public Esri sample service
- **THEN** every layer loads and draws without an error notice

### Requirement: Extra layer properties pass through
The viewer SHALL apply each property in a layer entry's `options` object to the created layer.
This lets deployers set type-specific properties, such as `definitionExpression` or
`minScale`, without a config change for each one.

#### Scenario: Definition expression applied
- **WHEN** a `feature` layer entry has `"options": { "definitionExpression": "STATUS = 'Open'" }`
- **THEN** the created layer's definition expression is `STATUS = 'Open'`

### Requirement: Layer entries are validated
The viewer SHALL validate each layer entry before creating the map. It SHALL report every
problem by its path, such as `layers[2].url`. When a layer entry is invalid, the viewer SHALL
NOT start, as for any other invalid config.

#### Scenario: Duplicate ID
- **WHEN** two layer entries have the `id` `parcels`
- **THEN** validation fails with an error at `layers[1].id` saying IDs must be unique

#### Scenario: Unknown type
- **WHEN** a layer entry has `"type": "kml"`
- **THEN** validation fails with an error at `layers[0].type` that lists the supported types

#### Scenario: Source missing or doubled
- **WHEN** a layer entry has both `url` and `portalItem`, or neither
- **THEN** validation fails with an error at that entry saying to set exactly one of `url` or `portalItem`

#### Scenario: Insecure URL
- **WHEN** a `feature` layer `url` starts with `http://`
- **THEN** validation fails with an error at `layers[0].url` saying an absolute https URL is required

#### Scenario: Relative GeoJSON URL
- **WHEN** a `geojson` layer `url` is `data/sites.geojson`
- **THEN** validation passes, and the URL is resolved against the config file's location

#### Scenario: Out-of-range opacity
- **WHEN** a layer entry has `"opacity": 2`
- **THEN** validation fails with an error at `layers[0].opacity` saying it must be between 0 and 1

### Requirement: First layer listed draws on top
The viewer SHALL add layers so that the first entry in `layers` draws above all the others,
and each later entry draws below the one before it (P-11).

#### Scenario: Two overlapping layers
- **WHEN** `layers` lists `roads` and then `parcels`
- **THEN** the map's layer order puts `roads` above `parcels`

### Requirement: A failed layer does not stop the viewer
When a layer fails to load, the viewer SHALL keep the map and the other layers working. It
SHALL show a closable warning notice that names the failed layer's `id`, and SHALL report the
failure on the error channel (P-13).

#### Scenario: Layer service returns 404
- **WHEN** one of two configured layers points to a URL that returns HTTP 404
- **THEN** the other layer is drawn, configured components appear, and a warning notice names the failed layer's `id`

### Requirement: Layers settle before components are created
The viewer SHALL create configured components only after every configured layer has loaded or
failed (P-13). It SHALL stop waiting after 15 seconds, so that a layer that never responds
does not keep components from appearing.

#### Scenario: Slow layer
- **WHEN** a layer's service responds after 2 seconds
- **THEN** no configured component exists until that response arrives, and the components appear after it

#### Scenario: Layer never responds
- **WHEN** a layer's service never responds
- **THEN** configured components appear within 20 seconds of page load, and the layer is reported as not loaded

### Requirement: Layer hooks run from named extensions
A layer entry MAY name a `preLoad` and an `onLoad` hook under `hooks`. Each name SHALL refer to
a hook built into the viewer. `preLoad` SHALL run after the layer is created and before it is
added to the map. `onLoad` SHALL run once, after the layer loads. A name that matches no hook
SHALL fail validation (P-12).

#### Scenario: Hooks run in order
- **WHEN** a layer entry names a `preLoad` hook and an `onLoad` hook
- **THEN** `preLoad` receives the layer before it is on the map, and `onLoad` receives it once, after it has loaded

#### Scenario: Unknown hook name
- **WHEN** a layer entry has `"hooks": { "onLoad": "noSuchHook" }`
- **THEN** validation fails with an error at `layers[0].hooks.onLoad` that lists the available hooks

#### Scenario: Hook throws
- **WHEN** a layer's `onLoad` hook throws an error
- **THEN** the layer stays on the map, the viewer keeps running, and the error is reported on the error channel with the layer's `id`

### Requirement: Clicking a feature opens a popup
For `feature`, `geojson`, and `imagery` layers, clicking a feature SHALL open the map's
built-in popup listing that feature's attributes, unless the layer entry sets `popupEnabled`
to `false` (P-06).

#### Scenario: Default popup
- **WHEN** the user clicks a point of a configured `geojson` layer
- **THEN** a popup opens showing that point's attribute values

#### Scenario: Popup turned off
- **WHEN** the layer entry has `"popupEnabled": false` and the user clicks one of its points
- **THEN** no popup opens

### Requirement: Map image sublayers can be shown or hidden from config
A `map-image` layer entry MAY list sublayer ids in `showSublayers` and `hideSublayers`. Once the
layer has loaded, and before its `onLoad` hook runs, the viewer SHALL turn the listed sublayers
on or off, including ones the service has off by default. Showing a sublayer SHALL also show the
groups above it. Every other sublayer SHALL keep the service's default, and users SHALL still be
able to switch any sublayer in the layer list.

#### Scenario: Hide a sublayer that is on by default
- **GIVEN** a `map-image` service whose sublayer 3 is on by default
- **WHEN** its layer entry has `"hideSublayers": [3]`
- **THEN** sublayer 3 is off once the layer loads, and the other sublayers are as the service set them

#### Scenario: Show a sublayer that is off by default, inside a hidden group
- **GIVEN** a `map-image` service whose sublayer 1 is off by default, inside group sublayer 0, which is also off
- **WHEN** its layer entry has `"showSublayers": [1]`
- **THEN** sublayers 1 and 0 are on once the layer loads, and sublayer 1's siblings keep the service's setting

#### Scenario: Id the service doesn't have
- **WHEN** a `map-image` layer entry has `"showSublayers": [9]`, and the service has no sublayer 9
- **THEN** the other listed sublayers are still applied, and one console warning names the layer's `id` and sublayer 9

### Requirement: Sublayer settings are validated
`showSublayers` and `hideSublayers` SHALL each be a list of whole numbers 0 or greater. The same
id SHALL NOT be in both. The viewer SHALL report invalid sublayer settings by path. On a layer
type other than `map-image`, it SHALL ignore them with one console warning per setting.

#### Scenario: Not a list of ids
- **WHEN** a `map-image` layer entry has `"hideSublayers": ["3"]`
- **THEN** validation fails with an error at `layers[0].hideSublayers` saying whole numbers 0 or greater are expected

#### Scenario: Same id in both lists
- **WHEN** a `map-image` layer entry has `"showSublayers": [1, 3]` and `"hideSublayers": [3]`
- **THEN** validation fails with an error at `layers[0].hideSublayers` naming sublayer 3

#### Scenario: Not a map image layer
- **WHEN** a `feature` layer entry has `"hideSublayers": [3]`
- **THEN** validation passes with one warning at `layers[0].hideSublayers`, and the setting is dropped
