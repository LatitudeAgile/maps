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
- **THEN** the map is ready with its center within 0.01° of longitude -98.579404, latitude 39.828127, and its scale within 1% of 1:18,489,298, whichever basemap is shown (Playwright, reading the map element's `center` and `scale`; the ArcGIS Streets check is skipped when no key is configured)

### Requirement: Map fills the window
The map SHALL fill the browser viewport, with no page scrollbars, at every viewport width
from 320 px up.

#### Scenario: Desktop and phone widths
- **WHEN** the viewport is 1280×800 and then 375×667
- **THEN** in both cases the map's bounding box equals the viewport and the document does not scroll (Playwright)

### Requirement: Zoom buttons replace the zoom slider
The map SHALL show zoom-in and zoom-out buttons in its top-left corner (P-02). Each press
SHALL change the zoom level by one.

#### Scenario: Zoom in
- **WHEN** the map has settled at zoom level N and the zoom-in button is pressed
- **THEN** the map settles at zoom level N + 1

#### Scenario: Keyboard operable
- **WHEN** focus is moved to the zoom-out button with the Tab key and Enter is pressed
- **THEN** the map zooms out by one level

### Requirement: Basemap falls back when no basemap credential is available
When `map.basemap` names a basemap styles service style (`provider/style`, e.g.
`arcgis/streets`) and no basemap credential is configured, the viewer SHALL use
`map.fallbackBasemap` instead, without showing a notice: running without a key is a supported
configuration. It SHALL NOT send any request to the basemap styles service, including for
basemaps named by components.

#### Scenario: No API key
- **GIVEN** the app was built without an API key
- **WHEN** the app starts with the shipped default config, which has `map.basemap` `arcgis/streets` and a basemap toggle
- **THEN** the OpenStreetMap basemap is shown, no notice appears, no sign-in dialog appears, and no request goes to the basemap styles service (Playwright, network log)

#### Scenario: API key present
- **GIVEN** the app was built with a valid API key that has the basemap styles privilege
- **WHEN** the map opens with `map.basemap` set to `arcgis/streets`
- **THEN** the ArcGIS Streets basemap is shown and no notice appears (Playwright, skipped when no key is configured)

#### Scenario: Configured basemap needs no credential
- **WHEN** `map.basemap` is `osm` and no API key is configured
- **THEN** the OpenStreetMap basemap is shown and no notice appears

### Requirement: Map keeps its center on resize
When the viewport is resized, the map SHALL keep the same geographic center (P-03).

#### Scenario: Window narrowed
- **WHEN** the map is ready at its default view and the viewport width changes from 1280 to 800 px
- **THEN** after the map is stationary, its center is within 0.01° of the center before the resize (Playwright)

### Requirement: Map failures are reported
When the basemap fails to load, or the map cannot become ready, the viewer SHALL show an error
message in the page instead of leaving a blank map without explanation.

#### Scenario: Basemap service unreachable
- **WHEN** all requests for the basemap's service metadata, styles, and tiles are blocked
- **THEN** within 15 seconds an error message appears saying the basemap could not be loaded (Playwright, request blocking)

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
- **THEN** the map shows the imagery and both reference layers, every tile request goes to `services.arcgisonline.com`, no request goes to the basemap styles service, and no notice appears (Playwright, network log)

#### Scenario: Hybrid is not a legacy ID
- **WHEN** `map.basemap` is `hybrid`
- **THEN** validation passes with no warning (Vitest)

#### Scenario: Hybrid layers
- **WHEN** the `hybrid` basemap is created
- **THEN** it has one base layer and two reference layers, each a tile layer on `services.arcgisonline.com`, a title, a thumbnail, and a copyright on every layer (Vitest)

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
- **THEN** `satellite` has one base layer and no reference layers, `light` and `dark` each have one base and one reference layer, every layer is a tile layer on `services.arcgisonline.com` with a copyright, and each basemap has a title and a thumbnail (Vitest)

#### Scenario: Light gray without a key
- **GIVEN** the app was built without an API key
- **WHEN** the map opens with `map.basemap` set to `light`
- **THEN** every tile request goes to `services.arcgisonline.com`, no request goes to the basemap styles service, and no notice appears (Playwright, network log)

#### Scenario: Satellite is not a legacy ID
- **WHEN** `map.basemap` is `satellite`
- **THEN** validation passes with no warning (Vitest)
