# service-credentials Specification

## Purpose

Defines where the viewer gets ArcGIS credentials and which requests may carry them, so that
public deployments expose no more access than the location services they use.

## Requirements

### Requirement: API key is supplied by the build environment
The viewer SHALL read an optional ArcGIS API key from the `VITE_ARCGIS_API_KEY` build
environment variable. An absent, empty, or whitespace-only value SHALL mean that no key is
configured.

#### Scenario: Key provided
- **WHEN** the app is built with `VITE_ARCGIS_API_KEY` set to a non-empty value
- **THEN** the viewer treats a basemap credential as configured

#### Scenario: Blank key
- **WHEN** `VITE_ARCGIS_API_KEY` is set to spaces only
- **THEN** the viewer treats no key as configured and uses the basemap fallback

### Requirement: API key is sent only to the basemap styles service
The viewer SHALL attach the API key only to requests for ArcGIS location services that need it:
the basemap styles service; for a `directions` component, ArcGIS routing services and the
geocoding requests Directions makes; and, when `geocoding.places` is set, the ArcGIS Places
service. It SHALL NOT attach the key to portal, feature, map, or any other service requests,
including a route service or geocoder on any other host, and every geocoder listed in
`geocoding.geocoders`.

#### Scenario: Requests to other hosts carry no key
- **GIVEN** the app was built with an API key
- **WHEN** the map has loaded with the shipped default config, and the user has searched for an address
- **THEN** the key appears as a token only on requests to the basemap styles service and ArcGIS routing and geocoding hosts, and on no request to any other URL

#### Scenario: Places requests carry the key
- **GIVEN** the app was built with an API key, and `geocoding.places` is set
- **WHEN** the user types a place name in the Search panel
- **THEN** the requests to `places-api.arcgis.com` carry the key, and no request to any other host gains it

### Requirement: Credentials stay out of source control and logs
The repository SHALL NOT contain a real API key. Local keys SHALL live in a gitignored
environment file. The repository SHALL include an example environment file with an empty
value. The viewer SHALL NOT write the key to the console or the page.

#### Scenario: Local key file is ignored
- **WHEN** `.env.local` exists in the working tree
- **THEN** `git check-ignore .env.local` reports it as ignored, and `.env.example` is tracked with `VITE_ARCGIS_API_KEY=` empty (scripted check)

#### Scenario: Key not echoed
- **GIVEN** the app was built with an API key
- **WHEN** the app starts normally, and again when it starts with an invalid config
- **THEN** no console message or page text contains the key
