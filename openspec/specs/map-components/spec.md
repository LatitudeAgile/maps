# map-components Specification

## Purpose

Defines how the viewer adds components from its config: which component types are supported, where
each can be placed, how options and layer references are applied, and when components are
created.

## Requirements

### Requirement: Components are created from config
The viewer SHALL create one component for each entry of the `components` config array, using the
entry's `type`. Only registered component types SHALL be accepted. This version registers
thirteen: `home`, `zoom`, `legend`, `locate`, `track`, `basemap-toggle`, `search`, `directions`,
`layer-list`, `basemap-gallery`, `print`, `sketch`, and the `hello-world` template.

#### Scenario: Home component returns to the initial view
- **GIVEN** the config has a `home` component placed `top-left`
- **WHEN** the user pans and zooms the map and then presses the Home button
- **THEN** the map returns to within 0.01° of the configured center and within 1% of the configured scale (Playwright)

#### Scenario: Unknown component type
- **WHEN** a component entry has `"type": "compass"`
- **THEN** validation fails with an error at `components[0].type` that lists the supported types, including `print` and `sketch` (Vitest)

#### Scenario: Duplicate component ID
- **WHEN** two component entries have the `id` `home`
- **THEN** validation fails with an error at `components[1].id` saying IDs must be unique (Vitest)

### Requirement: Components are placed by their placement setting
A component entry's `placement` SHALL be a map corner (`top-left`, `top-right`, `bottom-left`,
`bottom-right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`), `panel`, or `none`, and
SHALL default to `panel` when absent. Corner components SHALL appear in that corner of the map,
stacked vertically in config order, the first entry at the top, in top and bottom corners alike
(P-14).

#### Scenario: Corner placement
- **WHEN** a `home` component has `"placement": "bottom-right"`
- **THEN** its button appears in the bottom-right corner of the map (Playwright, comparing its bounding box with the map's)

#### Scenario: Order within a corner
- **WHEN** two `home` components, `first` and `second`, are both placed `top-right`
- **THEN** `first` appears above `second` (Playwright)

#### Scenario: Order within a bottom corner
- **WHEN** two `home` components, `first` and `second`, are both placed `bottom-right`
- **THEN** `first` appears above `second`, and their right edges are within 2 px of each other (Playwright, comparing bounding boxes)

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
- **WHEN** the app starts with the shipped default config, at 1280×800 and at 375×667
- **THEN** the bottom-right corner shows, from top to bottom, the Home button, the Locate button, and the zoom buttons, with their right edges within 2 px of each other, and the top-left corner holds only the title box (P-02, P-30, P-31; Playwright, comparing bounding boxes)

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
SHALL show the next basemap's name. The shipped default config SHALL NOT include one.

#### Scenario: Toggle and back
- **GIVEN** the shipped default config with a `basemap-toggle` component added, placed `top-right`, with no options
- **WHEN** the user presses the basemap toggle, and then presses it again
- **THEN** the map shows the `hybrid` basemap after the first press, and after the second the basemap it started with: ArcGIS Streets with an API key, OpenStreetMap without one (Playwright, run in both the keyed and keyless suites)

#### Scenario: Default next basemap
- **WHEN** a `basemap-toggle` component has no `nextBasemap` option
- **THEN** validation passes, and the component's `nextBasemap` is `hybrid` (Vitest)

#### Scenario: Legacy next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "streets-vector" }`
- **THEN** validation passes with one warning at `components[0].options.nextBasemap` suggesting `arcgis/streets` (Vitest)

#### Scenario: Empty next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "" }`
- **THEN** validation fails with an error at `components[0].options.nextBasemap` (Vitest)

#### Scenario: Default placement, with or without a key
- **WHEN** the app starts with the shipped default config, whether or not it was built with an API key
- **THEN** no basemap toggle is shown (Playwright, run in both the keyed and keyless suites)

### Requirement: A basemap toggle that needs a key is left out without one
When no API key is configured and a `basemap-toggle` component's `nextBasemap` names a basemap
styles service style, the viewer SHALL leave that toggle out and SHALL write a warning naming
it to the console, so that no request goes to the basemap styles service and no sign-in dialog
appears.

#### Scenario: Next basemap needs a key
- **GIVEN** the app was built without an API key
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "arcgis/imagery/standard" }`
- **THEN** no basemap toggle is shown, a console warning names `arcgis/imagery/standard`, no sign-in dialog appears, and no request goes to the basemap styles service (Playwright, network log; skipped when a key is configured)

### Requirement: Search finds addresses and places without a key
A `search` component SHALL find addresses and places as the user types, offer suggestions, and
zoom the map to the chosen result (P-34). It SHALL use the geocoding service at its
`geocoderUrl` option, which SHALL default to Esri's public World Geocoding Service at
`geocode.arcgis.com`, and SHALL work with or without an API key. The API key SHALL NOT be sent
to its geocoder. `maxSuggestions` (a whole number from 1 to 10) and `popupDisabled` (true or
false) SHALL be applied.

#### Scenario: Search and zoom
- **GIVEN** the geocoder answers suggestions and a candidate for "Denver" at longitude -104.98, latitude 39.74 (request fixture)
- **WHEN** the user types "Denv" in the Search panel and chooses the "Denver" suggestion
- **THEN** the map settles within 0.05° of that location, and every geocoder request went to the configured geocoder URL with no `token` parameter (Playwright, run in both suites)

#### Scenario: Live geocoder without a key
- **GIVEN** the app was built without an API key
- **WHEN** the user searches for "Denver, CO"
- **THEN** the map moves to Denver (Playwright, live network; tagged so it can be skipped offline)

#### Scenario: Invalid geocoder URL
- **WHEN** a `search` component has `"options": { "geocoderUrl": "geocode" }`
- **THEN** validation fails with an error at `components[0].options.geocoderUrl` saying an `https` URL is expected (Vitest)

### Requirement: Directions routes between stops
A `directions` component SHALL let the user add stops, solve a route, and read turn-by-turn
directions, with a button that clears the route (P-35). The route service SHALL come from its
`routeServiceUrl` option, which SHALL default to Esri's world route service. Distances SHALL be
shown in miles unless its `unit` option names another length unit. Stops SHALL be found with the
same sources as Search, never with the portal's default geocoder.

#### Scenario: Route between two stops
- **GIVEN** a `directions` component whose `routeServiceUrl` is answered by request fixtures captured from Esri's San Diego sample service, with a two-stop route of 1.82 miles
- **WHEN** the user enters two stops and the route solves
- **THEN** the route is drawn on the map and the directions list shows the total distance in miles (Playwright, run in both suites)

#### Scenario: World route service with a key
- **GIVEN** the app was built with an API key that has the Routing privilege, and the shipped default config
- **WHEN** the user routes between two addresses in Denver
- **THEN** a route is drawn and its directions are listed (Playwright, live network; skipped when no key is configured)

#### Scenario: Invalid unit
- **WHEN** a `directions` component has `"options": { "unit": "furlongs" }`
- **THEN** validation fails with an error at `components[0].options.unit` that lists the supported units (Vitest)

#### Scenario: One world geocoder for stops
- **WHEN** there is no `geocoding` setting
- **THEN** Directions' stop search has exactly one source, the keyless world geocoder, and the portal's default geocoder is turned off (Vitest)

### Requirement: Directions sends the key only to ArcGIS routing
When an API key is configured and a `directions` component's route service is an ArcGIS routing
service, the key SHALL be sent with its routing requests. The key SHALL NOT be sent to a route
service on any other host.

#### Scenario: Key goes only to ArcGIS routing
- **GIVEN** the app was built with an API key, and `routeServiceUrl` is on a host other than an ArcGIS routing host (request fixture)
- **WHEN** a route is solved
- **THEN** no request to that host carries the key (Playwright, network log; skipped when no key is configured)

### Requirement: A Directions panel that needs a key is left out without one
When no API key is configured and a `directions` component's route service is an ArcGIS
routing service that requires a key, the viewer SHALL leave that component out and SHALL write a
warning naming it to the console. No request SHALL go to that route service, and no sign-in
dialog SHALL appear. A `directions` component whose route service is on another host SHALL be
created without a key.

#### Scenario: Default config without a key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar has no Directions icon, a console warning names the `directions` component, no request goes to an ArcGIS routing host, and no sign-in dialog appears (Playwright, network log; skipped when a key is configured)

#### Scenario: Public route service without a key
- **GIVEN** the app was built without an API key
- **WHEN** a `directions` component has `routeServiceUrl` set to a route service on another host (request fixture)
- **THEN** the Directions panel is available and a route between two stops solves (Playwright)

### Requirement: The layer list shows layers with visibility checkboxes
A `layer-list` component SHALL list the map's operational layers by title, each with a control
that turns the layer on and off. The control SHALL be a checkbox unless its
`visibilityAppearance` option is `default`. Its `showFilter` option (true or false) SHALL show a
filter box (P-36).

#### Scenario: Turn a layer off and on
- **GIVEN** the config has two titled layers, both visible, and a `layer-list` panel
- **WHEN** the user opens the panel and clears the checkbox for "Road works", then checks it again
- **THEN** the `roads` layer is hidden after the first click and visible after the second, and the other layer stays visible (Playwright)

#### Scenario: Checkbox by default
- **WHEN** a `layer-list` component has no `visibilityAppearance` option
- **THEN** validation passes, its `visibilityAppearance` is `checkbox`, and each layer row shows a checkbox (Vitest for the default; Playwright for the checkbox)

#### Scenario: Invalid appearance
- **WHEN** a `layer-list` component has `"options": { "visibilityAppearance": "toggle" }`
- **THEN** validation fails with an error at `components[0].options.visibilityAppearance` that lists `checkbox` and `default` (Vitest)

### Requirement: The basemap gallery offers basemaps that work
A `basemap-gallery` component SHALL show a thumbnail and title for each basemap in its
`basemaps` option and SHALL switch the map's basemap when one is chosen, marking the current one
(P-37). `basemaps` SHALL accept the same IDs as `map.basemap`, and legacy IDs with the same
warning. It SHALL default to `osm`, `hybrid`, `satellite`, `light`, and `dark`, followed by
`arcgis/streets`, `arcgis/topographic`, `arcgis/imagery`, `arcgis/light-gray`, and
`arcgis/dark-gray`.

#### Scenario: Choose a basemap
- **GIVEN** the map shows its starting basemap
- **WHEN** the user opens the Basemaps panel and chooses "Light gray"
- **THEN** the map shows the `light` basemap and the gallery marks it as current (Playwright, run in both suites)

#### Scenario: Gallery with a key
- **GIVEN** the app was built with an API key
- **WHEN** the user opens the Basemaps panel of the shipped default config and chooses "Topographic"
- **THEN** it lists ten basemaps, and the map shows the `arcgis/topographic` style (Playwright; skipped when no key is configured)

#### Scenario: Empty basemap list
- **WHEN** a `basemap-gallery` component has `"options": { "basemaps": [] }`
- **THEN** validation fails with an error at `components[0].options.basemaps` saying at least one basemap ID is expected (Vitest)

### Requirement: Without a key, the basemap gallery lists only basemaps that need none
When no API key is configured, a `basemap-gallery` component SHALL leave out every ID in its
`basemaps` option that needs a key, and no request SHALL go to the basemap styles service. If
no ID is left, the component SHALL be left out, with a console warning naming it.

#### Scenario: Gallery without a key
- **GIVEN** the app was built without an API key
- **WHEN** the user opens the Basemaps panel of the shipped default config
- **THEN** it lists exactly the five free basemaps, no request goes to the basemap styles service, and no sign-in dialog appears (Playwright, network log; skipped when a key is configured)

#### Scenario: Only keyed basemaps, without a key
- **GIVEN** the app was built without an API key
- **WHEN** a `basemap-gallery` component has `"options": { "basemaps": ["arcgis/streets"] }`
- **THEN** no Basemaps panel is created, and a console warning names the component (Playwright; skipped when a key is configured)

### Requirement: The default sidebar matches dojo-sidebar and adds the new panels
The shipped default config SHALL have these sidebar panels, in this order: Search, Directions,
Layers, Legend, Basemaps, Sketch, Print. dojo-sidebar's order (Search, Directions, Legend) is
kept, with the new panels around it, and Sketch comes just before Print so marking up a map
leads to printing it. Each of these entries SHALL state `"placement": "panel"` explicitly, so
the shipped config shows where every component goes.

#### Scenario: Default panels with a key
- **GIVEN** the app was built with an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar icons are, from top to bottom, Search, Directions, Layers, Legend, Basemaps, Sketch, Print (Playwright; skipped when no key is configured)

#### Scenario: Default panels without a key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar icons are Search, Layers, Legend, Basemaps, Sketch, Print (Playwright; skipped when a key is configured)

#### Scenario: Placement stated in the shipped config
- **WHEN** the shipped default config is read
- **THEN** every entry in `components` has a `placement` setting, and the seven panel entries have `"placement": "panel"` (Vitest, reading `public/config/viewer.json`)

### Requirement: The location marker can be removed from its popup
The marker that a `locate` or `track` component puts on the map SHALL open a popup with a
"Remove" action. Pressing it SHALL remove the marker from the map and close the popup, without
errors. Pressing the Locate button again SHALL put a new marker on the map.

#### Scenario: Remove the location marker
- **GIVEN** the browser reports longitude -105.0, latitude 40.0, the user has pressed the Locate button, and the location marker is on the map
- **WHEN** the user clicks the marker and presses the popup's "Remove" action
- **THEN** the marker is no longer on the map, the popup is closed, and no error is logged to the console (Playwright, fake geolocation)

#### Scenario: Locate again after removing
- **GIVEN** the location marker was removed from its popup
- **WHEN** the user presses the Locate button again
- **THEN** the location marker is on the map again (Playwright, fake geolocation)

### Requirement: Print exports the map through a print service
A `print` component SHALL be Esri's print component as it ships: the user chooses a layout or
map only, a title and a format, and exports the map to a file listed for download (P-60). Its
`printServiceUrl` option, an https URL, SHALL set the print service. Without it, the viewer
SHALL leave the component's own default service in place.

#### Scenario: Export through a configured service
- **GIVEN** a `print` panel with `printServiceUrl` set to a service answered by request fixtures
- **WHEN** the user opens the Print panel, enters the title "Site visit" and exports
- **THEN** the export request goes to the configured URL with "Site visit" in the web map, and the panel lists the exported file (Playwright, run in both suites)

#### Scenario: Default service
- **WHEN** a `print` component has no `printServiceUrl` option
- **THEN** validation passes, the viewer sets no print service on the component, and its export request goes to the component's default service (Vitest for the options; Playwright with a request fixture for the request)

#### Scenario: Default service without a key
- **GIVEN** the app was built without an API key, with the shipped default config
- **WHEN** the user exports a map image from the Print panel
- **THEN** the panel lists the exported file, and no sign-in dialog appears (Playwright, live network; tagged so it can be skipped offline)

#### Scenario: Invalid print service URL
- **WHEN** a `print` component has `"options": { "printServiceUrl": "print" }`
- **THEN** validation fails with an error at `components[0].options.printServiceUrl` saying an `https` URL is expected (Vitest)

### Requirement: A component type can limit its placements
A component type MAY support only some placements. An entry of that type with any other
placement, stated or defaulted, SHALL fail validation with an error at its `placement` that
lists the placements the type supports. The `sketch` type SHALL support only `panel`.

#### Scenario: Sketch in a corner
- **WHEN** a `sketch` component has `"placement": "top-right"`
- **THEN** validation fails with an error at `components[0].placement` saying the `sketch` component supports only `panel` (Vitest)

#### Scenario: Sketch with placement omitted
- **WHEN** a `sketch` component entry has no `placement`
- **THEN** validation passes, and the Sketch panel is in the sidebar (Vitest for validation; Playwright for the panel)
