# geocoding Specification

## Purpose

Defines the search sources the viewer's Search panel and Directions stop search share: the
keyless world geocoder, any additional geocoders a deployer configures, and optional Places
search. It covers how they are configured and chosen, and how they stay within the API key's
limits.

## Requirements

### Requirement: Geocoding settings are validated
The top-level `geocoding` setting SHALL be an object. Its `geocoders` SHALL be a list of
`{ "url", "name", "placeholder" }` entries: `url` an absolute https URL, `name` a non-empty
string, `placeholder` optional. Its optional `places` SHALL be an object with an optional
`radius` (whole meters, 1 to 10,000, default 5,000), optional `categories` (up to 10 Places
category ids) and an optional non-empty `name` (default "Places"). Problems SHALL be reported by
path.

#### Scenario: Valid section
- **WHEN** `geocoding` is `{ "geocoders": [{ "url": "https://gis.example.org/arcgis/rest/services/Addresses/GeocodeServer", "name": "County addresses" }], "places": { "radius": 2000 } }`
- **THEN** validation passes with no warning, and Places has the name "Places" and no categories

#### Scenario: Geocoder without a name
- **WHEN** `geocoding.geocoders[0]` has a `url` and no `name`
- **THEN** validation fails with an error at `geocoding.geocoders[0].name`

#### Scenario: Radius out of range
- **WHEN** `geocoding.places.radius` is `20000`
- **THEN** validation fails with an error at `geocoding.places.radius` saying a whole number from 1 to 10000 is expected

#### Scenario: Too many categories
- **WHEN** `geocoding.places.categories` lists 11 ids
- **THEN** validation fails with an error at `geocoding.places.categories` saying at most 10 are allowed

### Requirement: Search and Directions offer every configured source, starting on All
The Search panel and the Directions stop search SHALL offer the same sources, in this order:
the keyless world geocoder, each entry of `geocoding.geocoders` in config order, then Places when
it is configured and available. With more than one source, a source menu SHALL be shown, and
"All" SHALL be selected when the panel opens, so that a search covers every source.

#### Scenario: Two geocoders
- **GIVEN** `geocoding.geocoders` has one entry named "County addresses"
- **WHEN** the user opens the Search panel and types a term
- **THEN** the source menu lists "All", "ArcGIS World Geocoding Service" and "County addresses", "All" is selected, and both geocoders are asked for suggestions

#### Scenario: Directions uses the same sources
- **GIVEN** the same `geocoding` setting, and a `directions` component on a route service
- **WHEN** the user types in a Directions stop box
- **THEN** both geocoders are asked for suggestions

#### Scenario: One source only
- **WHEN** there is no `geocoding` setting
- **THEN** the Search panel offers the world geocoder alone, with no source menu

### Requirement: Additional geocoders never receive the key
The viewer SHALL NOT send the API key to any geocoder listed in `geocoding.geocoders`, whatever
its host.

#### Scenario: Key not sent to an additional geocoder
- **GIVEN** the app was built with an API key, and `geocoding.geocoders` lists a geocoder on another host
- **WHEN** the user searches
- **THEN** no request to that geocoder carries the key

### Requirement: Places search finds places near the map's center
When `geocoding.places` is set and an API key is configured, Search and Directions SHALL offer a
Places source. It SHALL suggest places whose names or categories match the typed text, within
`radius` meters of the map's center, limited to `categories` when set. Choosing a suggestion, or
pressing Enter, SHALL go to the place. The key SHALL go only to the ArcGIS Places service.

#### Scenario: Suggest and choose a place
- **GIVEN** the app was built with an API key, `geocoding.places` is `{ "radius": 2000 }`, and the Places service answers with a place "Union Station"
- **WHEN** the user types "Union" in the Search panel and chooses "Union Station"
- **THEN** the map goes to the place, and the Places request was a near-point query at the map's center with a 2000 m radius and the search text "Union"

### Requirement: Places suggestions are rationed
Each Places request that returns results is billed. The Places source SHALL send no request for
fewer than 3 typed characters. It SHALL wait for typing to pause and send only the latest term.
It SHALL reuse earlier results for a term it has already looked up at the same map center.

#### Scenario: Short term
- **WHEN** the Places source is asked for suggestions for "Un"
- **THEN** it returns none and sends no request

#### Scenario: Fast typing
- **WHEN** the Places source is asked for "Uni", "Unio" and "Union" in quick succession
- **THEN** it sends one request, for "Union"

#### Scenario: Repeated term
- **WHEN** the Places source is asked for "Union" twice at the same map center
- **THEN** it sends one request, and both calls get the same suggestions

### Requirement: Places is left out without a key
When `geocoding.places` is set and no API key is configured, the viewer SHALL leave Places out of
every search, write one console warning naming `geocoding.places`, and send no request to the
Places service.

#### Scenario: Keyless build with Places configured
- **GIVEN** the app was built without an API key, and `geocoding.places` is set
- **WHEN** the user searches in the Search panel
- **THEN** the source menu has no Places entry, one console warning names `geocoding.places`, and no request goes to `places-api.arcgis.com`
