# map-components Specification

## Purpose

Defines how the viewer adds components from its config: which component types are supported, where
each can be placed, how options and layer references are applied, and when components are
created.

## Requirements

### Requirement: Components are created from config
The viewer SHALL create one component for each entry of the `components` config array, using the
entry's `type`. Only registered component types SHALL be accepted. This version registers
twenty: `home`, `zoom`, `legend`, `locate`, `track`, `basemap-toggle`, `search`, `directions`,
`layer-list`, `basemap-gallery`, `print`, `sketch`, `compass`, `navigation-toggle`, `measure`,
`fullscreen`, `scale-bar`, `bookmarks`, `coordinate-conversion`, and the `hello-world` template.

#### Scenario: Home component returns to the initial view
- **GIVEN** the config has a `home` component placed `top-left`
- **WHEN** the user pans and zooms the map and then presses the Home button
- **THEN** the map returns to within 0.01° of the configured center and within 1% of the configured scale

#### Scenario: Unknown component type
- **WHEN** a component entry has `"type": "weather"`
- **THEN** validation fails with an error at `components[0].type` that lists the supported types, including `measure` and `coordinate-conversion`

#### Scenario: Duplicate component ID
- **WHEN** two component entries have the `id` `home`
- **THEN** validation fails with an error at `components[1].id` saying IDs must be unique

### Requirement: Components are placed by their placement setting
A component entry's `placement` SHALL be a map corner (`top-left`, `top-right`, `bottom-left`,
`bottom-right`, `top-start`, `top-end`, `bottom-start`, `bottom-end`), `panel`, or `none`, and
SHALL default to `panel` when absent. Corner components SHALL appear in that corner of the map,
stacked vertically in config order, the first entry at the top, in top and bottom corners alike
(P-14).

#### Scenario: Corner placement
- **WHEN** a `home` component has `"placement": "bottom-right"`
- **THEN** its button appears in the bottom-right corner of the map

#### Scenario: Order within a corner
- **WHEN** two `home` components, `first` and `second`, are both placed `top-right`
- **THEN** `first` appears above `second`

#### Scenario: Order within a bottom corner
- **WHEN** two `home` components, `first` and `second`, are both placed `bottom-right`
- **THEN** `first` appears above `second`, and their right edges are within 2 px of each other

#### Scenario: Invalid placement
- **WHEN** a component entry has `"placement": "sidebar"`
- **THEN** validation fails with an error at `components[0].placement` that lists the valid placements

#### Scenario: Placement omitted
- **WHEN** a `legend` component entry has no `placement`
- **THEN** validation passes, and the legend is shown as a sidebar panel

### Requirement: Headless components are created without UI
A component placed `none` SHALL be created and connected to the map, but SHALL NOT be visible.

#### Scenario: Headless component
- **WHEN** a `home` component has `"placement": "none"`
- **THEN** no Home button is visible, and the component can be found by its `id` through the app model

### Requirement: Component options are applied
The viewer SHALL apply each property in a component entry's `options` that the component type
supports. It SHALL ignore any property the type does not support, logging one console warning
that names it.

#### Scenario: Supported option
- **WHEN** a `home` component has `"options": { "icon": "globe" }`
- **THEN** the Home button shows the `globe` icon

#### Scenario: Unsupported option
- **WHEN** a `home` component has `"options": { "colour": "red" }`
- **THEN** the component is created, and one console warning names `components[0].options.colour`

### Requirement: Layer references in component options resolve to layers
When a component type declares an option as a layer reference, the viewer SHALL accept layer
`id`s from the `layers` config in that option, and SHALL give the component the matching layers.
A reference to an unknown `id` SHALL fail validation (P-15).

#### Scenario: Reference resolved
- **GIVEN** a component type whose `layers` option is a layer reference, and a config layer with `id` `parcels`
- **WHEN** a component entry of that type has `"options": { "layers": ["parcels"] }`
- **THEN** the component receives the `parcels` layer object, not the string

#### Scenario: Unknown layer reference
- **WHEN** a layer-reference option names `nope`, and no layer has that `id`
- **THEN** validation fails with an error at that option's path saying `nope` is not a configured layer

### Requirement: The legend shows the configured layers
A `legend` component SHALL show the symbols of the map's operational layers. Its `layerInfos`
option MAY limit and title the layers it shows, as a list of `{ "layer": <layer id>, "title":
<text> }` entries, where `title` is optional. A `layer` that is not a configured layer `id`
SHALL fail validation (P-33).

#### Scenario: All layers by default
- **WHEN** a `legend` panel has no `layerInfos`, and two layers are configured
- **THEN** opening its panel shows a legend entry for each of the two layers

#### Scenario: Chosen layers with titles
- **WHEN** a `legend` has `"layerInfos": [{ "layer": "sites", "title": "Survey sites" }]`, and layers `sites` and `roads` are configured
- **THEN** its legend shows "Survey sites" and no entry for `roads`

#### Scenario: Unknown layer
- **WHEN** a `legend` has `"layerInfos": [{ "layer": "nope" }]`
- **THEN** validation fails with an error at `components[0].options.layerInfos[0].layer` saying `nope` is not a configured layer

### Requirement: The locate button zooms to the device's location
A `locate` component SHALL, when pressed, get the device's position from the browser, center
the map on it, and mark it on the map (P-31). Its `scale` option, a number greater than 0, SHALL
set the scale the map zooms to. Its `icon` option SHALL set the button's icon. Its
`popupDisabled` option SHALL stop the location's popup from opening.

#### Scenario: Locate
- **GIVEN** the browser reports the position longitude -105.0, latitude 40.0, and a `locate` component has `"options": { "scale": 18000 }`
- **WHEN** the user presses the Locate button
- **THEN** the map settles within 0.01° of that position at a scale within 1% of 1:18,000, with a location graphic at that position

#### Scenario: Default layout
- **WHEN** the app starts with the shipped default config, at 1280×800 and at 375×667
- **THEN** the bottom-right corner shows, from top to bottom, the Home button, the Locate button, and the zoom buttons, with their right edges within 2 px of each other, and the top-left corner holds only the title box

#### Scenario: Invalid scale
- **WHEN** a `locate` component has `"options": { "scale": 0 }`
- **THEN** validation fails with an error at `components[0].options.scale` saying a number greater than 0 is expected

### Requirement: The track button follows the device's location
A `track` component SHALL be a toggle button. Pressed once, it SHALL start following the
device's position, keeping the map centered on it as it changes. Pressed again, it SHALL stop.
Its `scale` option (a number greater than 0), `icon` option, and `rotationDisabled` option
(true or false) SHALL be applied.

#### Scenario: Start tracking
- **GIVEN** the browser reports longitude -105.0, latitude 40.0, and a `track` component is placed `top-left`
- **WHEN** the user presses the Track button
- **THEN** the map settles within 0.01° of that position, and the button shows that tracking is on

#### Scenario: Position changes while tracking
- **GIVEN** tracking is on at longitude -105.0, latitude 40.0
- **WHEN** the browser's position changes to longitude -104.9, latitude 40.1
- **THEN** the map settles within 0.01° of the new position

#### Scenario: Stop tracking
- **GIVEN** tracking is on
- **WHEN** the user presses the Track button again, and the browser's position then changes
- **THEN** the button shows that tracking is off, and the map center doesn't move

### Requirement: Location errors are explained
When a `locate` or `track` component can't get the device's position, the viewer SHALL show a
closable warning notice titled "Your location isn't available". The notice SHALL say whether
location access was denied, finding the location timed out, or the location could not be
determined. A later failure SHALL replace the notice rather than add a second one.

#### Scenario: Permission denied
- **GIVEN** the browser denies location access
- **WHEN** the user presses the Locate button
- **THEN** a warning notice appears saying location access was denied, and it closes with its Close button

#### Scenario: Timed out
- **GIVEN** the browser's position request times out
- **WHEN** the user presses the Track button
- **THEN** a warning notice appears saying finding the location took too long

#### Scenario: Repeated failure
- **GIVEN** a location notice is showing
- **WHEN** the user presses the Locate button again, and it fails again
- **THEN** exactly one location notice is showing

### Requirement: The basemap toggle switches between two basemaps
A `basemap-toggle` component SHALL switch the map between its current basemap and the one
named by its `nextBasemap` option. Pressing it again SHALL switch back. `nextBasemap` SHALL
default to `hybrid`, the built-in basemap that needs no key (P-32). A legacy basemap ID SHALL
be accepted with the same warning as in `map.basemap`. Its `showTitle` option (true or false)
SHALL show the next basemap's name. The shipped default config SHALL NOT include one.

#### Scenario: Toggle and back
- **GIVEN** the shipped default config with a `basemap-toggle` component added, placed `top-right`, with no options
- **WHEN** the user presses the basemap toggle, and then presses it again
- **THEN** the map shows the `hybrid` basemap after the first press, and after the second the basemap it started with: ArcGIS Streets with an API key, OpenStreetMap without one

#### Scenario: Default next basemap
- **WHEN** a `basemap-toggle` component has no `nextBasemap` option
- **THEN** validation passes, and the component's `nextBasemap` is `hybrid`

#### Scenario: Legacy next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "streets-vector" }`
- **THEN** validation passes with one warning at `components[0].options.nextBasemap` suggesting `arcgis/streets`

#### Scenario: Empty next basemap
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "" }`
- **THEN** validation fails with an error at `components[0].options.nextBasemap`

#### Scenario: Default placement, with or without a key
- **WHEN** the app starts with the shipped default config, whether or not it was built with an API key
- **THEN** no basemap toggle is shown

### Requirement: A basemap toggle that needs a key is left out without one
When no API key is configured and a `basemap-toggle` component's `nextBasemap` names a basemap
styles service style, the viewer SHALL leave that toggle out and SHALL write a warning naming
it to the console, so that no request goes to the basemap styles service and no sign-in dialog
appears.

#### Scenario: Next basemap needs a key
- **GIVEN** the app was built without an API key
- **WHEN** a `basemap-toggle` component has `"options": { "nextBasemap": "arcgis/imagery/standard" }`
- **THEN** no basemap toggle is shown, a console warning names `arcgis/imagery/standard`, no sign-in dialog appears, and no request goes to the basemap styles service

### Requirement: Search finds addresses and places without a key
A `search` component SHALL find addresses and places as the user types, offer suggestions, and
zoom the map to the chosen result (P-34). It SHALL use the geocoding service at its
`geocoderUrl` option, which SHALL default to Esri's public World Geocoding Service at
`geocode.arcgis.com`, and SHALL work with or without an API key. The API key SHALL NOT be sent
to its geocoder. `maxSuggestions` (a whole number from 1 to 10) and `popupDisabled` (true or
false) SHALL be applied.

#### Scenario: Search and zoom
- **GIVEN** the geocoder answers suggestions and a candidate for "Denver" at longitude -104.98, latitude 39.74
- **WHEN** the user types "Denv" in the Search panel and chooses the "Denver" suggestion
- **THEN** the map settles within 0.05° of that location, and every geocoder request went to the configured geocoder URL with no `token` parameter

#### Scenario: Live geocoder without a key
- **GIVEN** the app was built without an API key
- **WHEN** the user searches for "Denver, CO"
- **THEN** the map moves to Denver

#### Scenario: Invalid geocoder URL
- **WHEN** a `search` component has `"options": { "geocoderUrl": "geocode" }`
- **THEN** validation fails with an error at `components[0].options.geocoderUrl` saying an `https` URL is expected

### Requirement: Directions routes between stops
A `directions` component SHALL let the user add stops, solve a route, and read turn-by-turn
directions, with a button that clears the route (P-35). The route service SHALL come from its
`routeServiceUrl` option, which SHALL default to Esri's world route service. Distances SHALL be
shown in miles unless its `unit` option names another length unit. Stops SHALL be found with the
same sources as Search, never with the portal's default geocoder.

#### Scenario: Route between two stops
- **GIVEN** a `directions` component whose route service answers a two-stop route of 1.82 miles
- **WHEN** the user enters two stops and the route solves
- **THEN** the route is drawn on the map and the directions list shows the total distance in miles

#### Scenario: World route service with a key
- **GIVEN** the app was built with an API key that has the Routing privilege, and the shipped default config
- **WHEN** the user routes between two addresses in Denver
- **THEN** a route is drawn and its directions are listed

#### Scenario: Invalid unit
- **WHEN** a `directions` component has `"options": { "unit": "furlongs" }`
- **THEN** validation fails with an error at `components[0].options.unit` that lists the supported units

#### Scenario: One world geocoder for stops
- **WHEN** there is no `geocoding` setting
- **THEN** Directions' stop search has exactly one source, the keyless world geocoder, and the portal's default geocoder is turned off

### Requirement: Directions sends the key only to ArcGIS routing
When an API key is configured and a `directions` component's route service is an ArcGIS routing
service, the key SHALL be sent with its routing requests. The key SHALL NOT be sent to a route
service on any other host.

#### Scenario: Key goes only to ArcGIS routing
- **GIVEN** the app was built with an API key, and `routeServiceUrl` is on a host other than an ArcGIS routing host
- **WHEN** a route is solved
- **THEN** no request to that host carries the key

### Requirement: A Directions panel that needs a key is left out without one
When no API key is configured and a `directions` component's route service is an ArcGIS
routing service that requires a key, the viewer SHALL leave that component out and SHALL write a
warning naming it to the console. No request SHALL go to that route service, and no sign-in
dialog SHALL appear. A `directions` component whose route service is on another host SHALL be
created without a key.

#### Scenario: Default config without a key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar has no Directions icon, a console warning names the `directions` component, no request goes to an ArcGIS routing host, and no sign-in dialog appears

#### Scenario: Public route service without a key
- **GIVEN** the app was built without an API key
- **WHEN** a `directions` component has `routeServiceUrl` set to a route service on another host
- **THEN** the Directions panel is available and a route between two stops solves

### Requirement: The layer list shows layers with visibility checkboxes
A `layer-list` component SHALL list the map's operational layers by title, each with a control
that turns the layer on and off. The control SHALL be a checkbox unless its
`visibilityAppearance` option is `default`. Its `showFilter` option (true or false) SHALL show a
filter box (P-36). Its `openGroups` option (true or false, default false) SHALL show each group
layer opened, with its layers listed, including groups a component adds after the app starts.

#### Scenario: Turn a layer off and on
- **GIVEN** the config has two titled layers, both visible, and a `layer-list` panel
- **WHEN** the user opens the panel and clears the checkbox for "Road works", then checks it again
- **THEN** the `roads` layer is hidden after the first click and visible after the second, and the other layer stays visible

#### Scenario: Checkbox by default
- **WHEN** a `layer-list` component has no `visibilityAppearance` option
- **THEN** validation passes, its `visibilityAppearance` is `checkbox`, and each layer row shows a checkbox

#### Scenario: Invalid appearance
- **WHEN** a `layer-list` component has `"options": { "visibilityAppearance": "toggle" }`
- **THEN** validation fails with an error at `components[0].options.visibilityAppearance` that lists `checkbox` and `default`

#### Scenario: Groups opened
- **GIVEN** a `layer-list` component with `"options": { "openGroups": true }`, in an app where a component adds a group layer after the app starts
- **WHEN** the user opens the Layers panel
- **THEN** the group's row is open and its layers are listed under it, and the user can still close it

#### Scenario: Groups closed by default
- **WHEN** a `layer-list` component has no `openGroups` option
- **THEN** group layers are listed closed, as before

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
- **THEN** the map shows the `light` basemap and the gallery marks it as current

#### Scenario: Gallery with a key
- **GIVEN** the app was built with an API key
- **WHEN** the user opens the Basemaps panel of the shipped default config and chooses "Topographic"
- **THEN** it lists ten basemaps, and the map shows the `arcgis/topographic` style

#### Scenario: Empty basemap list
- **WHEN** a `basemap-gallery` component has `"options": { "basemaps": [] }`
- **THEN** validation fails with an error at `components[0].options.basemaps` saying at least one basemap ID is expected

### Requirement: Without a key, the basemap gallery lists only basemaps that need none
When no API key is configured, a `basemap-gallery` component SHALL leave out every ID in its
`basemaps` option that needs a key, and no request SHALL go to the basemap styles service. If
no ID is left, the component SHALL be left out, with a console warning naming it.

#### Scenario: Gallery without a key
- **GIVEN** the app was built without an API key
- **WHEN** the user opens the Basemaps panel of the shipped default config
- **THEN** it lists exactly the five free basemaps, no request goes to the basemap styles service, and no sign-in dialog appears

#### Scenario: Only keyed basemaps, without a key
- **GIVEN** the app was built without an API key
- **WHEN** a `basemap-gallery` component has `"options": { "basemaps": ["arcgis/streets"] }`
- **THEN** no Basemaps panel is created, and a console warning names the component

### Requirement: The default sidebar matches dojo-sidebar and adds the new panels
The shipped default config SHALL have these sidebar panels, in this order: Search, Directions,
Layers, Legend, Basemaps, Sketch, Print. dojo-sidebar's order (Search, Directions, Legend) is
kept, with the new panels around it, and Sketch comes just before Print so marking up a map
leads to printing it. Each of these entries SHALL state `"placement": "panel"` explicitly, so
the shipped config shows where every component goes.

#### Scenario: Default panels with a key
- **GIVEN** the app was built with an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar icons are, from top to bottom, Search, Directions, Layers, Legend, Basemaps, Sketch, Print

#### Scenario: Default panels without a key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config
- **THEN** the sidebar icons are Search, Layers, Legend, Basemaps, Sketch, Print

#### Scenario: Placement stated in the shipped config
- **WHEN** the shipped default config is read
- **THEN** every entry in `components` has a `placement` setting, and the seven panel entries have `"placement": "panel"`

### Requirement: The location marker can be removed from its popup
The marker that a `locate` or `track` component puts on the map SHALL open a popup with a
"Remove" action. Pressing it SHALL remove the marker from the map and close the popup, without
errors. Pressing the Locate button again SHALL put a new marker on the map.

#### Scenario: Remove the location marker
- **GIVEN** the browser reports longitude -105.0, latitude 40.0, the user has pressed the Locate button, and the location marker is on the map
- **WHEN** the user clicks the marker and presses the popup's "Remove" action
- **THEN** the marker is no longer on the map, the popup is closed, and no error is logged to the console

#### Scenario: Locate again after removing
- **GIVEN** the location marker was removed from its popup
- **WHEN** the user presses the Locate button again
- **THEN** the location marker is on the map again

### Requirement: Print exports the map through a print service
A `print` component SHALL be Esri's print component as it ships: the user chooses a layout or
map only, a title and a format, and exports the map to a file listed for download (P-60). Its
`printServiceUrl` option, an https URL, SHALL set the print service. Without it, the viewer
SHALL leave the component's own default service in place.

#### Scenario: Export through a configured service
- **GIVEN** a `print` panel with `printServiceUrl` set to a print service
- **WHEN** the user opens the Print panel, enters the title "Site visit" and exports
- **THEN** the export request goes to the configured URL with "Site visit" in the web map, and the panel lists the exported file

#### Scenario: Default service
- **WHEN** a `print` component has no `printServiceUrl` option
- **THEN** validation passes, the viewer sets no print service on the component, and its export request goes to the component's default service

#### Scenario: Default service without a key
- **GIVEN** the app was built without an API key, with the shipped default config
- **WHEN** the user exports a map image from the Print panel
- **THEN** the panel lists the exported file, and no sign-in dialog appears

#### Scenario: Invalid print service URL
- **WHEN** a `print` component has `"options": { "printServiceUrl": "print" }`
- **THEN** validation fails with an error at `components[0].options.printServiceUrl` saying an `https` URL is expected

### Requirement: A component type can limit its placements
A component type MAY support only some placements. An entry of that type with any other
placement, stated or defaulted, SHALL fail validation with an error at its `placement` that
lists the placements the type supports. The `sketch` type SHALL support only `panel`.
`fullscreen` SHALL support only the corners and `none`, `scale-bar` only the corners, and
`measure` only `panel` and the corners.

#### Scenario: Sketch in a corner
- **WHEN** a `sketch` component has `"placement": "top-right"`
- **THEN** validation fails with an error at `components[0].placement` saying the `sketch` component supports only `panel`

#### Scenario: Sketch with placement omitted
- **WHEN** a `sketch` component entry has no `placement`
- **THEN** validation passes, and the Sketch panel is in the sidebar

#### Scenario: Scale bar with placement omitted
- **WHEN** a `scale-bar` component entry has no `placement`
- **THEN** validation fails with an error at `components[0].placement` that lists the corner placements

#### Scenario: Fullscreen in a panel
- **WHEN** a `fullscreen` component has `"placement": "panel"`
- **THEN** validation fails with an error at `components[0].placement` that lists the corner placements and `none`

### Requirement: A component type can limit the views it supports
A component type MAY work only in 2D maps or only in 3D scenes. `print`, `sketch` and `scale-bar`
SHALL be 2D only, and `navigation-toggle` 3D only. Every other built-in type SHALL work in both. In
an app whose view is known from the config, an entry of a type that doesn't support it SHALL fail
validation.

#### Scenario: Print in a config-built scene
- **WHEN** an app with `"view": "3d"` has a `print` component as its first entry
- **THEN** validation fails with an error at `components[0].type` saying the `print` component works only in 2D maps

#### Scenario: Scale bar in a config-built scene
- **WHEN** an app with `"view": "3d"` has a `scale-bar` component as its first entry
- **THEN** validation fails with an error at `components[0].type` saying the `scale-bar` component works only in 2D maps

#### Scenario: Navigation toggle in a 2D app
- **WHEN** an app with no `map.view` and no `map.item` has a `navigation-toggle` component as its first entry
- **THEN** validation fails with an error at `components[0].type` saying the `navigation-toggle` component works only in 3D scenes

#### Scenario: Both views
- **WHEN** an app with `"view": "3d"` has `home`, `zoom`, `search`, `legend`, `layer-list`, `basemap-gallery`, `measure`, `fullscreen`, `bookmarks` and `coordinate-conversion` components
- **THEN** validation passes, and each component appears and works in the scene

### Requirement: Components that don't support an item's view are left out
In an app with `map.item`, once the item's type shows the view, the viewer SHALL leave out every
component whose type doesn't support that view, writing one console warning that names it. The
sidebar SHALL have no icon for a panel component that is left out.

#### Scenario: Print with a web scene
- **WHEN** an app with a web scene item has a `print` panel and a `legend` panel
- **THEN** the sidebar has a Legend icon and no Print icon, and one console warning names the `print` component

#### Scenario: Print with a web map
- **WHEN** an app with a web map item has a `print` panel
- **THEN** the sidebar has a Print icon, and printing exports the web map's layers

### Requirement: The compass shows and resets the heading
A `compass` component SHALL show which way north is. Pressing it SHALL turn the map back to
north up. It SHALL work in 2D maps and 3D scenes.

#### Scenario: Reset the heading in a scene
- **GIVEN** a config-built 3D scene with `"heading": 90` and a `compass` component placed `top-right`
- **WHEN** the user presses the compass
- **THEN** after the scene settles, its heading is within 1° of 0

### Requirement: The navigation toggle switches between panning and rotating
A `navigation-toggle` component SHALL switch what dragging the scene with the primary mouse
button does, between panning and rotating. It SHALL work only in 3D scenes.

#### Scenario: Rotate by dragging
- **GIVEN** a config-built 3D scene with a `navigation-toggle` component placed `top-right`
- **WHEN** the user switches the toggle to rotate and drags the scene sideways with the primary mouse button
- **THEN** the scene's heading changes and its center stays within 0.01° of where it was

### Requirement: A corner component can open from an expand button
A corner entry with `"expand": true` or an `expand` object SHALL show a button in its corner
instead of the component, in the same position in config order (P-66). Pressing the button SHALL
open the component over the map, next to the button. Pressing it again, or Escape, SHALL close
it. `"expand": false` SHALL mean no expand. When it opens over the map beside its button, the
component SHALL open on the side toward the middle of the map and line up with the button's
outer edge: a bottom corner's component with the button's bottom, a top corner's with its top.

#### Scenario: Print behind a button at the top right
- **WHEN** a `print` component has `"placement": "top-right"` and `"expand": true`
- **THEN** the top-right corner shows one button with the print icon and no print form, and pressing it opens the print component next to the button

#### Scenario: Close with Escape
- **GIVEN** a `legend` component placed `top-right` with `"expand": true`, opened by its button
- **WHEN** the user presses Escape
- **THEN** the legend is no longer shown, and focus is on its button

#### Scenario: Expand keeps its place in the corner
- **WHEN** a `home` component and then a `legend` component with `"expand": true` are both placed `top-right`
- **THEN** the Home button appears above the legend's button

#### Scenario: Bottom corner component clear of the map's edge
- **GIVEN** a `measure` component placed `bottom-left` with `"expand": true`
- **WHEN** the user opens it, and it grows after a measurement
- **THEN** it opens to the right of its button with its bottom level with the button's, and grows upward, leaving the corner's gutter below it

### Requirement: An expand button shows its component's icon and heading
An expand button's icon SHALL default to the icon of the type's sidebar panel, and its tooltip
and accessible name to that panel's heading. The `expand` object's `icon` and `tooltip` SHALL
override them. A custom type SHALL get its registered panel icon and heading the same way.

#### Scenario: Default icon and tooltip
- **WHEN** a `print` component placed `top-right` has `"expand": true`
- **THEN** its button shows the `print` icon, and hovering it shows "Print"

#### Scenario: Own icon and tooltip
- **WHEN** a `legend` component placed `top-right` has `"expand": { "icon": "information", "tooltip": "Map key" }`
- **THEN** its button shows the `information` icon, and hovering it shows "Map key"

#### Scenario: Custom type
- **WHEN** a `hello-world` component placed `top-left` has `"expand": true`
- **THEN** its button shows the `code` icon, and hovering it shows "Hello"

### Requirement: Expand settings are checked
An `expand` object MAY set `icon` and `tooltip` (non-empty strings), `expanded` (true or false,
open at startup, default false), `group` (a non-empty string, or false), and `mode` (`auto`,
`floating` or `drawer`). `mode` SHALL default to `auto`, except for `measure` and
`coordinate-conversion`, which are used on the map while open and SHALL default to `floating`.
An unknown key SHALL be ignored with a warning. Any other value of `expand` SHALL fail
validation.

#### Scenario: Open at startup
- **WHEN** a `legend` component placed `top-right` has `"expand": { "expanded": true }`
- **THEN** the legend is open next to its button once the components are created

#### Scenario: Drawer mode
- **WHEN** a `legend` component placed `top-right` has `"expand": { "mode": "drawer" }` and its button is pressed
- **THEN** the legend opens in a sheet along an edge of the map instead of next to the button

#### Scenario: Measure floats on a phone
- **GIVEN** a `measure` component placed `top-right` with `"expand": true`, on a 375×667 screen
- **WHEN** the user opens it, starts a distance measurement and taps the map
- **THEN** it is open next to its button rather than in a sheet, and the tap adds a point to the measurement

#### Scenario: Invalid mode
- **WHEN** a component has `"expand": { "mode": "popup" }`
- **THEN** validation fails with an error at `components[0].expand.mode` that lists `auto`, `floating` and `drawer`

#### Scenario: Invalid expand value
- **WHEN** a component has `"expand": "yes"`
- **THEN** validation fails with an error at `components[0].expand` saying true, false, or a settings object is expected

#### Scenario: Unknown expand setting
- **WHEN** a component has `"expand": { "colour": "red" }`
- **THEN** validation passes with one warning at `components[0].expand.colour`

### Requirement: Expands in one corner close each other
Expands in the same corner SHALL be in one group by default, so that opening one closes any other
open one in that corner. An expand's `group` setting SHALL put it in the named group instead,
across corners. `"group": false` SHALL put it in no group, so it stays open when others open.

#### Scenario: Same corner
- **GIVEN** a `legend` and a `print` component, both placed `top-right` with `"expand": true`, and the legend is open
- **WHEN** the user presses the print button
- **THEN** print is open and the legend is closed

#### Scenario: Different corners
- **GIVEN** a `legend` placed `top-right` and a `print` placed `top-left`, both with `"expand": true`, and the legend is open
- **WHEN** the user presses the print button
- **THEN** both are open

#### Scenario: No group
- **GIVEN** a `legend` with `"expand": { "group": false }` and a `print` with `"expand": true`, both placed `top-right`, and the legend is open
- **WHEN** the user presses the print button
- **THEN** both are open

### Requirement: Only some component types open from an expand
These types SHALL accept `expand`: `legend`, `layer-list`, `basemap-gallery`, `print`, `search`,
`bookmarks`, `coordinate-conversion`, `measure` and `hello-world`. A custom type SHALL accept it
when registered as doing so. A corner entry of any other type that turns expand on SHALL fail
validation with an error at its `expand` that lists the types that accept it.

#### Scenario: Button type
- **WHEN** a `home` component placed `top-right` has `"expand": true`
- **THEN** validation fails with an error at `components[0].expand` that lists the types that accept it

#### Scenario: Expand turned off on a button type
- **WHEN** a `home` component placed `top-right` has `"expand": false`
- **THEN** validation passes, and the Home button is shown in the corner

### Requirement: Expand applies only to corner placements
An `expand` setting on an entry placed `panel` or `none`, stated or defaulted, SHALL be ignored
with one warning at its `expand` saying it is only used with a corner placement.

#### Scenario: Expand on a panel
- **WHEN** a `legend` component with no `placement` has `"expand": true`
- **THEN** validation passes with one warning at `components[0].expand`, and the legend is a sidebar panel

### Requirement: A component in an expand is told when it opens and closes
A component in an expand SHALL be told when the expand opens and when it closes, with the same
open and close events that a sidebar panel sends, however the expand closes: its button, Escape,
or another expand in its group opening. A component's request to open its panel SHALL open its
expand.

#### Scenario: Told on open and close
- **GIVEN** a `hello-world` component placed `top-right` with `"expand": true`, with the open and close events on its element being recorded
- **WHEN** the user opens the expand, presses Escape, opens it again and presses its button
- **THEN** the element was told open, closed, open, closed, in that order

#### Scenario: Open at startup is told
- **WHEN** a `hello-world` component placed `top-right` has `"expand": { "expanded": true }`
- **THEN** its element is told open once, after it is on the page

#### Scenario: Asking to open
- **GIVEN** a `hello-world` component placed `top-right` with `"expand": true`, and its expand closed
- **WHEN** the open request is sent from that element
- **THEN** its expand is open, and any other open expand in its group is closed

### Requirement: Fullscreen shows the viewer on the whole screen
A `fullscreen` button SHALL show the whole viewer, sidebar included, fullscreen when pressed
(P-68), and SHALL return to the normal page when pressed again or on Escape. Its `target` option
SHALL be `app` (the default) or `map`, which shows only the map. Where the browser has no
fullscreen support, pressing it SHALL do nothing and report no error.

#### Scenario: App fullscreen
- **GIVEN** a `fullscreen` component placed `top-right` with no options
- **WHEN** the user presses it
- **THEN** the viewer fills the screen with the sidebar's icon bar still showing, and the sidebar's panels still open

#### Scenario: Map only
- **GIVEN** a `fullscreen` component with `"options": { "target": "map" }`
- **WHEN** the user presses it
- **THEN** only the map fills the screen, without the sidebar

#### Scenario: Leave fullscreen
- **GIVEN** the viewer is fullscreen from a `fullscreen` button
- **WHEN** the user presses Escape
- **THEN** the viewer is back in the normal page

#### Scenario: Invalid target
- **WHEN** a `fullscreen` component has `"options": { "target": "page" }`
- **THEN** validation fails with an error at `components[0].options.target` that lists `app` and `map`

### Requirement: The scale bar shows the map scale
A `scale-bar` component SHALL show a bar for the map's current scale, updated as the map zooms
(P-69). Its `unit` option SHALL be `imperial` (the default), `metric`, or `dual` for both. Its
`barStyle` option SHALL be `line` (the default) or `ruler`.

#### Scenario: Imperial by default
- **GIVEN** a `scale-bar` component placed `bottom-left` with no options, in a 2D map
- **WHEN** the map is shown
- **THEN** the bottom-left corner shows a scale bar labeled in miles or feet

#### Scenario: Both units
- **WHEN** a `scale-bar` component has `"options": { "unit": "dual" }`
- **THEN** the scale bar shows one label in imperial units and one in metric units

#### Scenario: Updates on zoom
- **GIVEN** a `scale-bar` component is showing
- **WHEN** the user zooms in two levels
- **THEN** the scale bar's label shows a shorter distance than before

### Requirement: Bookmarks go to saved places
A `bookmarks` component SHALL list the bookmarks of the app's web map or web scene, then those of
its `bookmarks` option, and SHALL go to a bookmark when it is chosen (P-70). Each configured
bookmark SHALL have a `name`, a `center`, and a `zoom` or a `scale`, and in a 3D scene MAY have a
`tilt` and a `heading`, checked as in `map`. `showAddBookmarkButton` (default true) SHALL let the
user add the current view; `showFilter` SHALL show a filter box. With none, it SHALL say so.

#### Scenario: Go to a bookmark
- **GIVEN** an app whose web map item has bookmarks, and a `bookmarks` panel
- **WHEN** the user opens the Bookmarks panel and chooses the first bookmark
- **THEN** the map settles on that bookmark's extent

#### Scenario: Bookmarks in a config-built map
- **GIVEN** a 2D app with no `map.item`, and a `bookmarks` panel with `"options": { "bookmarks": [{ "name": "Red Rocks", "center": [-105.2053, 39.6654], "zoom": 16 }] }`
- **WHEN** the user opens the Bookmarks panel and chooses "Red Rocks"
- **THEN** the map settles within 0.002° of that center, at zoom 16

#### Scenario: Bookmark with tilt and heading in a scene
- **GIVEN** an app with `"view": "3d"` and a configured bookmark with `"tilt": 70` and `"heading": 330`
- **WHEN** the user chooses that bookmark
- **THEN** the scene looks at its center with a tilt of 70° and a heading of 330°, each within 1°

#### Scenario: Web map bookmarks come first
- **WHEN** an app with a web map item that has bookmarks also configures bookmarks
- **THEN** the list shows the web map's bookmarks, then the configured ones

#### Scenario: Invalid bookmark
- **WHEN** a configured bookmark has no `name`, or both `zoom` and `scale`, or neither, or a latitude of 95, or a `tilt` in a 2D app
- **THEN** validation fails with an error at that bookmark's path, such as `components[0].options.bookmarks[0].name`, saying what is expected

#### Scenario: No bookmarks
- **WHEN** a `bookmarks` component is opened in a config-built app with `"options": { "showAddBookmarkButton": false }`
- **THEN** it shows its empty message, and no error is reported

### Requirement: Bookmarks the user adds are kept in the browser
Bookmarks the user adds, and changes to them, SHALL be kept in the browser for each app (`?app=`)
and SHALL come back, after the app's other bookmarks, when it is opened again. Bookmarks from the
web map, web scene or config SHALL come back as configured, even if the user changed or removed
them. Where the browser can't keep them, they SHALL last until the page is closed. In a 3D scene,
a bookmark the user adds or edits SHALL keep the view's camera, with its tilt and heading.

#### Scenario: Add a bookmark
- **GIVEN** a `bookmarks` component with no options, in an app with no bookmarks
- **WHEN** the user adds a bookmark named "Trailhead", pans away and chooses "Trailhead"
- **THEN** the map returns to the view it had when the bookmark was added

#### Scenario: Add a bookmark in a scene
- **GIVEN** a `bookmarks` component in an app with `"view": "3d"`, and the view tilted to 70 with a heading of 120
- **WHEN** the user adds a bookmark named "Overlook", looks straight down somewhere else, and chooses "Overlook"
- **THEN** the scene returns to the same camera position, tilt 70 and heading 120, and does the same after a reload

#### Scenario: Kept after a reload
- **GIVEN** the user added a bookmark named "Trailhead" and renamed it "Red Rocks lot"
- **WHEN** the page is reloaded
- **THEN** the list ends with "Red Rocks lot", and choosing it returns to the view it was added at

#### Scenario: Separate for each app
- **GIVEN** the user added a bookmark in one app
- **WHEN** another app with a `bookmarks` component is opened in the same browser
- **THEN** its list doesn't include that bookmark

#### Scenario: Configured bookmarks come back
- **GIVEN** the user removed a configured bookmark
- **WHEN** the page is reloaded
- **THEN** the bookmark is back in its place in the list

### Requirement: Coordinate conversion shows and finds coordinates
A `coordinate-conversion` component SHALL show the coordinates of the pointer, or of a clicked
point, in the user's chosen formats, and SHALL go to coordinates the user types in (P-71). Its
`formats` option SHALL limit the formats offered to a list from `xy`, `dd`, `ddm`, `dms`, `mgrs`,
`usng`, `utm` and `basemap`. Its `mode` option SHALL be `live` (the default) or `capture`. It SHALL
convert in the browser, with no service request.

#### Scenario: Live coordinates
- **GIVEN** a `coordinate-conversion` component placed `bottom-left` with no options
- **WHEN** the user moves the pointer over the map
- **THEN** the coordinates it shows change with the pointer

#### Scenario: Capture a point
- **GIVEN** a `coordinate-conversion` component with `"options": { "mode": "capture" }`
- **WHEN** the user clicks the map
- **THEN** it shows that point's coordinates and marks the point on the map

#### Scenario: Limited formats
- **WHEN** a `coordinate-conversion` component has `"options": { "formats": ["dd", "mgrs"] }`
- **THEN** its list of formats to add offers only decimal degrees and MGRS

#### Scenario: Go to typed coordinates
- **GIVEN** a `coordinate-conversion` component
- **WHEN** the user enters `39.74N 104.99W` as decimal degrees and goes to it
- **THEN** the map settles within 0.01° of longitude -104.99, latitude 39.74

#### Scenario: No service requests
- **GIVEN** the app was built without an API key
- **WHEN** the user converts a point to MGRS, USNG and UTM
- **THEN** each conversion is shown, and no request goes to a geometry service

#### Scenario: Invalid format
- **WHEN** a `coordinate-conversion` component has `"options": { "formats": ["latlon"] }`
- **THEN** validation fails with an error at `components[0].options.formats[0]` that lists the supported formats

### Requirement: A corner component's look comes from its type
A component type SHALL say how it looks in a map corner: as a button, with the shadow the SDK
gives its own buttons; as a panel, with that shadow plus a panel's width and scrolling; or with
neither. Built-in and custom types SHALL get the same look from the same setting. Built-in types
SHALL look as they did before this change.

#### Scenario: Built-in measure keeps its look
- **WHEN** a `measure` component is placed `top-right` without an expand
- **THEN** it has a shadow and is as wide as a `legend` placed in the same corner

#### Scenario: Custom panel-style type
- **GIVEN** an extension type whose manifest gives it the panel look in corners
- **WHEN** it is placed `top-right` above a `legend`
- **THEN** both have the same shadow and width, and the custom component scrolls when its content is taller than the map allows

#### Scenario: Custom button-style type
- **GIVEN** an extension type whose manifest gives it the button look in corners
- **WHEN** it is placed `top-left` below a `home` component
- **THEN** it has the same shadow as the Home button

#### Scenario: No corner look
- **GIVEN** an extension type whose manifest gives no corner look
- **WHEN** it is placed `top-right`
- **THEN** the viewer adds no shadow or width to it, and it looks only as its own styles make it
