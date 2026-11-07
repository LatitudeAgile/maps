# map-components Specification

## Purpose

Defines how the viewer adds components from its config: which component types are supported, where
each can be placed, how options and layer references are applied, and when components are
created.

## Requirements

### Requirement: Components are created from config
The viewer SHALL create one component for each entry of the `components` config array, using the
entry's `type`. Only registered component types SHALL be accepted. This version registers five:
`home` (returns the map to its initial view), `legend`, `locate`, `track`, and `basemap-toggle`.

#### Scenario: Home component returns to the initial view
- **GIVEN** the config has a `home` component placed `top-left`
- **WHEN** the user pans and zooms the map and then presses the Home button
- **THEN** the map returns to within 0.01° of the configured center and within 1% of the configured scale (Playwright)

#### Scenario: Unknown component type
- **WHEN** a component entry has `"type": "compass"`
- **THEN** validation fails with an error at `components[0].type` that lists the supported types (Vitest)

#### Scenario: Duplicate component ID
- **WHEN** two component entries have the `id` `home`
- **THEN** validation fails with an error at `components[1].id` saying IDs must be unique (Vitest)

### Requirement: Components are placed by their placement setting
A component entry's `placement` SHALL be a map corner (`top-left`, `top-right`, `bottom-left`,
`bottom-right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`), `panel`, or `none`, and
SHALL default to `panel` when absent. Corner components SHALL appear in that corner of the map,
in config order (P-14).

#### Scenario: Corner placement
- **WHEN** a `home` component has `"placement": "bottom-right"`
- **THEN** its button appears in the bottom-right corner of the map (Playwright, comparing its bounding box with the map's)

#### Scenario: Order within a corner
- **WHEN** two `home` components, `first` and `second`, are both placed `top-right`
- **THEN** `first` appears above `second` (Playwright)

#### Scenario: Invalid placement
- **WHEN** a component entry has `"placement": "sidebar"`
- **THEN** validation fails with an error at `components[0].placement` that lists the valid placements (Vitest)

#### Scenario: Placement omitted
- **WHEN** a `legend` component entry has no `placement`
- **THEN** validation passes, and the legend is shown as a sidebar panel (Vitest for the default, Playwright for the panel)

### Requirement: Headless components are created without UI
A component placed `none` SHALL be created and connected to the map, but SHALL NOT be visible.

#### Scenario: Headless component
- **WHEN** a `home` component has `"placement": "none"`
- **THEN** no Home button is visible, and the component can be found by its `id` through the app model (Playwright, debug mode)

### Requirement: Component options are applied
The viewer SHALL apply each property in a component entry's `options` that the component type
supports. It SHALL ignore any property the type does not support, logging one console warning
that names it.

#### Scenario: Supported option
- **WHEN** a `home` component has `"options": { "icon": "globe" }`
- **THEN** the Home button shows the `globe` icon (Playwright)

#### Scenario: Unsupported option
- **WHEN** a `home` component has `"options": { "colour": "red" }`
- **THEN** the component is created, and one console warning names `components[0].options.colour` (Vitest)

### Requirement: Layer references in component options resolve to layers
When a component type declares an option as a layer reference, the viewer SHALL accept layer
`id`s from the `layers` config in that option, and SHALL give the component the matching layers.
A reference to an unknown `id` SHALL fail validation (P-15).

#### Scenario: Reference resolved
- **GIVEN** a component type whose `layers` option is a layer reference, and a config layer with `id` `parcels`
- **WHEN** a component entry of that type has `"options": { "layers": ["parcels"] }`
- **THEN** the component receives the `parcels` layer object, not the string (Vitest, with a test component type)

#### Scenario: Unknown layer reference
- **WHEN** a layer-reference option names `nope`, and no layer has that `id`
- **THEN** validation fails with an error at that option's path saying `nope` is not a configured layer (Vitest, with a test component type)

### Requirement: The legend shows the configured layers
A `legend` component SHALL show the symbols of the map's operational layers. Its `layerInfos`
option MAY limit and title the layers it shows, as a list of `{ "layer": <layer id>, "title":
<text> }` entries, where `title` is optional. A `layer` that is not a configured layer `id`
SHALL fail validation (P-33).

#### Scenario: All layers by default
- **WHEN** a `legend` panel has no `layerInfos`, and two layers are configured
- **THEN** opening its panel shows a legend entry for each of the two layers (Playwright)

#### Scenario: Chosen layers with titles
- **WHEN** a `legend` has `"layerInfos": [{ "layer": "sites", "title": "Survey sites" }]`, and layers `sites` and `roads` are configured
- **THEN** its legend shows "Survey sites" and no entry for `roads` (Playwright)

#### Scenario: Unknown layer
- **WHEN** a `legend` has `"layerInfos": [{ "layer": "nope" }]`
- **THEN** validation fails with an error at `components[0].options.layerInfos[0].layer` saying `nope` is not a configured layer (Vitest)

### Requirement: The locate button zooms to the device's location
A `locate` component SHALL, when pressed, get the device's position from the browser, center
the map on it, and mark it on the map (P-31). Its `scale` option, a number greater than 0, SHALL
set the scale the map zooms to. Its `icon` option SHALL set the button's icon. Its
`popupDisabled` option SHALL stop the location's popup from opening.

#### Scenario: Locate
- **GIVEN** the browser reports the position longitude -105.0, latitude 40.0, and a `locate` component has `"options": { "scale": 18000 }`
- **WHEN** the user presses the Locate button
- **THEN** the map settles within 0.01° of that position at a scale within 1% of 1:18,000, with a location graphic at that position (Playwright, fake geolocation)

#### Scenario: Default layout
- **WHEN** the app starts with the shipped default config
- **THEN** the top-left corner shows, from top to bottom, the zoom buttons, the Home button, and the Locate button (P-30, P-31; Playwright, comparing bounding boxes)

#### Scenario: Invalid scale
- **WHEN** a `locate` component has `"options": { "scale": 0 }`
- **THEN** validation fails with an error at `components[0].options.scale` saying a number greater than 0 is expected (Vitest)

### Requirement: The track button follows the device's location
A `track` component SHALL be a toggle button. Pressed once, it SHALL start following the
device's position, keeping the map centered on it as it changes. Pressed again, it SHALL stop.
Its `scale` option (a number greater than 0), `icon` option, and `rotationDisabled` option
(true or false) SHALL be applied.

#### Scenario: Start tracking
- **GIVEN** the browser reports longitude -105.0, latitude 40.0, and a `track` component is placed `top-left`
- **WHEN** the user presses the Track button
- **THEN** the map settles within 0.01° of that position, and the button shows that tracking is on (Playwright, fake geolocation)

#### Scenario: Position changes while tracking
- **GIVEN** tracking is on at longitude -105.0, latitude 40.0
- **WHEN** the browser's position changes to longitude -104.9, latitude 40.1
- **THEN** the map settles within 0.01° of the new position (Playwright, fake geolocation)

#### Scenario: Stop tracking
- **GIVEN** tracking is on
- **WHEN** the user presses the Track button again, and the browser's position then changes
- **THEN** the button shows that tracking is off, and the map center doesn't move (Playwright, fake geolocation)

### Requirement: Location errors are explained
When a `locate` or `track` component can't get the device's position, the viewer SHALL show a
closable warning notice titled "Your location isn't available". The notice SHALL say whether
location access was denied, finding the location timed out, or the location could not be
determined. A later failure SHALL replace the notice rather than add a second one.

#### Scenario: Permission denied
- **GIVEN** the browser denies location access
- **WHEN** the user presses the Locate button
- **THEN** a warning notice appears saying location access was denied, and it closes with its Close button (Playwright, geolocation that fails with a permission-denied error)

#### Scenario: Timed out
- **GIVEN** the browser's position request times out
- **WHEN** the user presses the Track button
- **THEN** a warning notice appears saying finding the location took too long (Playwright, geolocation that fails with a timeout error)

#### Scenario: Repeated failure
- **GIVEN** a location notice is showing
- **WHEN** the user presses the Locate button again, and it fails again
- **THEN** exactly one location notice is showing (Playwright)

### Requirement: The basemap toggle switches between two basemaps
A `basemap-toggle` component SHALL switch the map between its current basemap and the one
named by its `nextBasemap` option. Pressing it again SHALL switch back. `nextBasemap` SHALL
default to `hybrid`, the built-in basemap that needs no key (P-32). A legacy basemap ID SHALL
be accepted with the same warning as in `map.basemap`. Its `showTitle` option (true or false)
SHALL show the next basemap's name.

#### Scenario: Toggle and back
- **GIVEN** the app starts with the shipped default config
- **WHEN** the user presses the basemap toggle, and then presses it again
- **THEN** the map shows the `hybrid` basemap after the first press, and after the second the basemap it started with: ArcGIS Streets with an API key, OpenStreetMap without one (Playwright, run in both the keyed and keyless suites)

#### Scenario: Default next basemap
- **WHEN** a `basemap-toggle` component has no `nextBasemap` option
- **THEN** validation passes, and the component's `nextBasemap` is `hybrid` (Vitest)

#### Scenario: Legacy next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "satellite" }`
- **THEN** validation passes with one warning at `components[0].options.nextBasemap` suggesting `arcgis/imagery/standard` (Vitest)

#### Scenario: Empty next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "" }`
- **THEN** validation fails with an error at `components[0].options.nextBasemap` (Vitest)

#### Scenario: Default placement, with or without a key
- **WHEN** the app starts with the shipped default config, whether or not it was built with an API key
- **THEN** the basemap toggle is visible in the top-right corner of the map (Playwright, run in both the keyed and keyless suites)

### Requirement: A basemap toggle that needs a key is left out without one
When no API key is configured and a `basemap-toggle` component's `nextBasemap` names a basemap
styles service style, the viewer SHALL leave that toggle out and SHALL write a warning naming
it to the console, so that no request goes to the basemap styles service and no sign-in dialog
appears.

#### Scenario: Next basemap needs a key
- **GIVEN** the app was built without an API key
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "arcgis/imagery/standard" }`
- **THEN** no basemap toggle is shown, a console warning names `arcgis/imagery/standard`, no sign-in dialog appears, and no request goes to the basemap styles service (Playwright, network log; skipped when a key is configured)
