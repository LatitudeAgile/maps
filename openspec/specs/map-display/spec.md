# map-display Specification

## Purpose

Defines the viewer's main map: what it shows when it opens, how the basemap is chosen when
credentials are or are not available, the zoom control, and behavior on resize.

## Requirements

### Requirement: Map opens at the configured view
The map SHALL open using `map.basemap`, `map.center` (longitude, latitude), and `map.zoom` or
`map.scale` from the config.

#### Scenario: Default configuration (P-01)
- **WHEN** the app starts with the shipped default config
- **THEN** the map is ready with its center within 0.01° of longitude -98.579404, latitude 39.828127, and its scale within 1% of 1:18,489,298, whichever basemap is shown

### Requirement: Map fills the window
The map SHALL fill the browser viewport, with no page scrollbars, at every viewport width
from 320 px up.

#### Scenario: Desktop and phone widths
- **WHEN** the viewport is 1280×800 and then 375×667
- **THEN** in both cases the map's bounding box equals the viewport and the document does not scroll

### Requirement: Zoom buttons replace the zoom slider
A `zoom` component SHALL show zoom-in and zoom-out buttons where it is placed (P-02). Each press
SHALL change the zoom level by one. The map SHALL NOT add zoom buttons of its own: a config with
no `zoom` component SHALL show none, and pinch, scroll-wheel and keyboard zoom SHALL keep
working. The shipped default config SHALL place its `zoom` component last in the bottom-right
corner, so the zoom buttons are lowest.

#### Scenario: Zoom in
- **GIVEN** the shipped default config
- **WHEN** the map has settled at zoom level N and the zoom-in button is pressed
- **THEN** the map settles at zoom level N + 1

#### Scenario: Keyboard operable
- **WHEN** focus is moved to the zoom-out button with the Tab key and Enter is pressed
- **THEN** the map zooms out by one level

#### Scenario: No zoom component
- **WHEN** the config has no `zoom` component
- **THEN** no zoom buttons are shown, and scrolling the mouse wheel over the map still changes its zoom level

#### Scenario: Zoom placed elsewhere
- **WHEN** a `zoom` component is placed `top-right`
- **THEN** the zoom buttons appear in the top-right corner of the map

### Requirement: Basemap falls back when no basemap credential is available
When `map.basemap` names a basemap styles service style (`provider/style`, e.g.
`arcgis/streets`) and no basemap credential is configured, the viewer SHALL use
`map.fallbackBasemap` instead, without showing a notice: running without a key is a supported
configuration. It SHALL NOT send any request to the basemap styles service, including for
basemaps named by components.

#### Scenario: No API key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config, which has `map.basemap` `arcgis/streets` and a Basemaps panel
- **THEN** the OpenStreetMap basemap is shown, no notice appears, no sign-in dialog appears, and no request goes to the basemap styles service

#### Scenario: API key present
- **GIVEN** the app was built with a valid API key that has the basemap styles privilege
- **WHEN** the map opens with `map.basemap` set to `arcgis/streets`
- **THEN** the ArcGIS Streets basemap is shown and no notice appears

#### Scenario: Configured basemap needs no credential
- **WHEN** `map.basemap` is `osm` and no API key is configured
- **THEN** the OpenStreetMap basemap is shown and no notice appears

### Requirement: Map keeps its center on resize
When the viewport is resized, the map SHALL keep the same geographic center (P-03).

#### Scenario: Window narrowed
- **WHEN** the map is ready at its default view and the viewport width changes from 1280 to 800 px
- **THEN** after the map is stationary, its center is within 0.01° of the center before the resize

### Requirement: Map failures are reported
When the basemap fails to load, and so does the fallback basemap if one was tried, or the map
cannot become ready, the viewer SHALL show an error message in the page instead of leaving a
blank map without explanation.

#### Scenario: Basemap service unreachable
- **WHEN** all requests for the basemap's service metadata, styles, and tiles are blocked
- **THEN** within 15 seconds an error message appears saying the basemap could not be loaded

### Requirement: A hybrid basemap that needs no key is built in
The basemap ID `hybrid` SHALL mean imagery with roads and place names, drawn from Esri's public
tile services (`services.arcgisonline.com`: `World_Imagery`, with the
`Reference/World_Transportation` and `Reference/World_Boundaries_and_Places` layers on top). It
SHALL need no API key and SHALL be accepted wherever a basemap ID is: `map.basemap`,
`map.fallbackBasemap`, and a basemap toggle's `nextBasemap`. `hybrid` SHALL NOT be treated as a
legacy basemap ID.

#### Scenario: Hybrid without a key
- **GIVEN** the app was built without an API key
- **WHEN** the map opens with `map.basemap` set to `hybrid`
- **THEN** the map shows the imagery and both reference layers, every tile request goes to `services.arcgisonline.com`, no request goes to the basemap styles service, and no notice appears

#### Scenario: Hybrid is not a legacy ID
- **WHEN** `map.basemap` is `hybrid`
- **THEN** validation passes with no warning

#### Scenario: Hybrid layers
- **WHEN** the `hybrid` basemap is created
- **THEN** it has one base layer and two reference layers, each a tile layer on `services.arcgisonline.com`, a title, a thumbnail, and a copyright on every layer

### Requirement: Satellite, light gray, and dark gray basemaps that need no key are built in
The basemap IDs `satellite`, `light`, and `dark` SHALL mean basemaps drawn from Esri's public
tile services on `services.arcgisonline.com`, needing no API key:
- `satellite`: `World_Imagery` alone;
- `light`: `Canvas/World_Light_Gray_Base` with `Canvas/World_Light_Gray_Reference` on top;
- `dark`: `Canvas/World_Dark_Gray_Base` with `Canvas/World_Dark_Gray_Reference` on top.

They SHALL be accepted wherever a basemap ID is, like `hybrid`. `satellite` SHALL NOT be treated
as a legacy basemap ID.

#### Scenario: Free basemap layers
- **WHEN** the `satellite`, `light`, and `dark` basemaps are created
- **THEN** `satellite` has one base layer and no reference layers, `light` and `dark` each have one base and one reference layer, every layer is a tile layer on `services.arcgisonline.com` with a copyright, and each basemap has a title and a thumbnail

#### Scenario: Light gray without a key
- **GIVEN** the app was built without an API key
- **WHEN** the map opens with `map.basemap` set to `light`
- **THEN** every tile request goes to `services.arcgisonline.com`, no request goes to the basemap styles service, and no notice appears

#### Scenario: Satellite is not a legacy ID
- **WHEN** `map.basemap` is `satellite`
- **THEN** validation passes with no warning

### Requirement: Basemap falls back when its service refuses the key
When `map.basemap` names a basemap styles service style, a key is configured, and that basemap
fails to load (for example, the service rejects the key or the key lacks the basemap styles
privilege), the viewer SHALL switch to `map.fallbackBasemap` without an error notice. It SHALL
write one console warning that names the configured basemap and says the fallback is shown.

#### Scenario: Key rejected
- **GIVEN** the app was built with an API key, and the basemap styles service answers every request with HTTP 401 (request interception)
- **WHEN** the app starts with the shipped default config
- **THEN** the OpenStreetMap basemap is shown, no error notice appears, and one console warning names `arcgis/streets`

#### Scenario: Fallback fails too
- **GIVEN** the app was built with an API key, and every request to a host other than the viewer's own fails, so the fallback can't display either
- **WHEN** the app starts with the shipped default config
- **THEN** within 15 seconds an error message appears saying the basemap could not be loaded
