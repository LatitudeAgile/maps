# viewer-config Specification

## Purpose

Defines how the viewer finds its runtime configuration, fills in defaults, validates it, and
reports problems. Deployers can then reconfigure the viewer without rebuilding it.

## Requirements

### Requirement: Config is loaded at startup from a deployable file
The viewer SHALL read its configuration at startup from `config/viewer.json`, resolved against
the app's base URL, before creating the map. Changing that file in a deployed build SHALL
change the viewer's behavior without a rebuild.

#### Scenario: Default config file is used
- **WHEN** the app starts and `config/viewer.json` contains a valid configuration
- **THEN** the map is created with the basemap, center, and scale from that file

#### Scenario: Deployed config is edited without rebuilding
- **GIVEN** a production build is being served
- **WHEN** `map.scale` in the served `config/viewer.json` is changed and the page is reloaded
- **THEN** the map opens at the new scale (Playwright, against `vite preview`)

### Requirement: Initial view is set by zoom or by scale
The config SHALL set the map's initial view with exactly one of `map.zoom` (a zoom level of
the basemap's tiling scheme, 0 or greater) or `map.scale` (a map scale denominator, greater
than 0). A config that sets both, or neither, SHALL fail validation.

#### Scenario: Scale instead of zoom
- **WHEN** the config sets `map.scale` to 18489298 and does not set `map.zoom`
- **THEN** validation passes and the map opens at that scale (Vitest for the validator, Playwright for the view)

#### Scenario: Both set
- **WHEN** the config sets both `map.zoom` and `map.scale`
- **THEN** validation fails with an error at `map` saying to set either `map.zoom` or `map.scale`, not both (Vitest)

#### Scenario: Neither set
- **WHEN** the config sets neither `map.zoom` nor `map.scale`
- **THEN** validation fails with an error at `map` saying `map.zoom` or `map.scale` is required (Vitest)

#### Scenario: Invalid scale
- **WHEN** `map.scale` is 0
- **THEN** validation fails with an error naming `map.scale` as a number that must be greater than 0 (Vitest)

### Requirement: Missing optional settings receive documented defaults
The viewer SHALL apply these defaults when a setting is absent:
- `app.title`: "ArcGIS Sidebar Viewer"
- `portal.url`: `https://www.arcgis.com`
- `map.fallbackBasemap`: `osm`

#### Scenario: Minimal config
- **WHEN** the config contains only `map.basemap`, `map.center`, and `map.zoom`
- **THEN** the viewer starts with the default title, default portal URL, and default fallback basemap (Vitest)

### Requirement: Invalid config stops startup with a readable error
The viewer SHALL validate the config before creating the map. When validation fails, it SHALL
NOT create the map. It SHALL show an error message in the page that names each invalid
setting by its path (for example `map.center[1]`) and says what was expected.

#### Scenario: Out-of-range coordinate
- **WHEN** `map.center` is `[-98.5, 120]`
- **THEN** no map is created and the page shows an error naming `map.center[1]` as a latitude that must be between -90 and 90

#### Scenario: Wrong type
- **WHEN** `map.zoom` is the string `"five"`
- **THEN** no map is created and the page shows an error naming `map.zoom` as a number that must be 0 or greater

#### Scenario: Multiple problems are reported together
- **WHEN** both `map.basemap` is empty and `portal.url` is not an absolute `https` URL
- **THEN** the error lists both settings (Vitest for the validator, Playwright for the displayed message)

### Requirement: Unreadable config is reported
When the config file cannot be fetched or is not valid JSON, the viewer SHALL show an error
message in the page that includes the config URL and the failure reason. It SHALL NOT create
the map.

#### Scenario: Config file missing
- **WHEN** `config/viewer.json` returns HTTP 404
- **THEN** the page shows an error that includes the config URL and the 404 status

#### Scenario: Malformed JSON
- **WHEN** the config file contains a trailing comma
- **THEN** the page shows an error saying the config is not valid JSON

### Requirement: Config does not hold credentials
The config SHALL NOT be a source of credentials. A config that contains any key named
`apiKey`, `token`, or `clientSecret`, at any depth, SHALL fail validation. The error SHALL say
that credentials must be supplied through the build environment instead.

#### Scenario: API key placed in config
- **WHEN** the config contains `"portal": { "apiKey": "abc" }`
- **THEN** validation fails with an error naming `portal.apiKey` and pointing to the build-environment setting, and the key's value does not appear in the error

### Requirement: Sections reserved for later capabilities are tolerated
The viewer SHALL accept `layers` and `widgets` arrays without error even though this version
does not act on them. It SHALL log a console warning for any other unrecognized top-level
setting and continue starting.

#### Scenario: Reserved sections present
- **WHEN** the config includes `"layers": []` and `"widgets": []`
- **THEN** the viewer starts normally and logs no warning about them

#### Scenario: Unknown setting
- **WHEN** the config includes `"colour": "blue"` at the top level
- **THEN** the viewer starts normally and logs one warning naming `colour`

### Requirement: App title comes from config
The viewer SHALL set the browser document title to `app.title`.

#### Scenario: Custom title
- **WHEN** `app.title` is "County Viewer"
- **THEN** the browser tab title is "County Viewer"
