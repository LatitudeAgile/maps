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
`map.fallbackBasemap` instead. It SHALL show a dismissible notice that a fallback basemap is
in use. It SHALL NOT send any request to the basemap styles service.

#### Scenario: No API key
- **GIVEN** the app was built without an API key
- **WHEN** the map opens with `map.basemap` set to `arcgis/streets`
- **THEN** the OpenStreetMap basemap is shown, a notice says a fallback basemap is in use because no API key is configured, and no request goes to the basemap styles service (Playwright, network log)

#### Scenario: API key present
- **GIVEN** the app was built with a valid API key that has the basemap styles privilege
- **WHEN** the map opens with `map.basemap` set to `arcgis/streets`
- **THEN** the ArcGIS Streets basemap is shown and no fallback notice appears (Playwright, skipped when no key is configured)

#### Scenario: Configured basemap needs no credential
- **WHEN** `map.basemap` is `osm` and no API key is configured
- **THEN** the OpenStreetMap basemap is shown and no fallback notice appears

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
