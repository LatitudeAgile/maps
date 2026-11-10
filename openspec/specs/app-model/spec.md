# app-model Specification

## Purpose

Defines the runtime model the viewer and its components share: the map's current view state,
lookups for configured layers and components, an error channel, and the debug mode that exposes
them for troubleshooting.

## Requirements

### Requirement: The model tracks the map's view state
The app model SHALL expose the map's current extent, center, zoom, and scale. These SHALL stay
equal to the map's values as the map moves. Code holding the model SHALL be able to watch any
of them and be notified when it changes (P-04).

#### Scenario: Values follow the map
- **WHEN** the map has settled after the zoom-in button is pressed
- **THEN** the model's zoom, scale, center, and extent equal the map's

#### Scenario: Change notification
- **WHEN** code watches the model's extent and the map is then panned
- **THEN** the watcher is called with the new extent after the map settles

### Requirement: Layers and components can be looked up by ID
The app model SHALL return a configured layer or component by its config `id`, with both its
config entry and the created layer or component. An unknown `id` SHALL return nothing (P-16).

#### Scenario: Layer lookup
- **WHEN** code asks the model for the layer `parcels`, and that layer is configured
- **THEN** it gets the `parcels` config entry and the map layer created from it

#### Scenario: Unknown ID
- **WHEN** code asks the model for the layer or component `nope`
- **THEN** it gets nothing, and no error is thrown

### Requirement: Errors are reported on one channel
The viewer SHALL report runtime errors on the app model's error channel. Each report SHALL name
its source, such as a layer `id`, and give a message. Code holding the model SHALL be able to
subscribe to the channel.

#### Scenario: Layer failure reported
- **WHEN** a subscriber is listening and a configured layer fails to load
- **THEN** the subscriber receives one report naming that layer's `id`

### Requirement: Debug mode exposes the model and logs errors
When the config sets `debug` to `true`, the viewer SHALL expose the app model as `window.app`,
and SHALL log every error-channel report to the console with its source. When `debug` is
absent or `false`, the viewer SHALL do neither (P-17).

#### Scenario: Debug on
- **WHEN** `debug` is `true` and a configured layer fails to load
- **THEN** `window.app` is the app model, and the console shows an error naming that layer's `id`

#### Scenario: Debug off
- **WHEN** `debug` is absent and a configured layer fails to load
- **THEN** `window.app` is undefined, and no error-channel report appears in the console

#### Scenario: Debug output carries no key
- **GIVEN** the app was built with an API key and `debug` is `true`
- **WHEN** the viewer starts and a layer fails to load
- **THEN** no console message contains the key
