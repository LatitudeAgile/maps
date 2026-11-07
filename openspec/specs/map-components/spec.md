# map-components Specification

## Purpose

Defines how the viewer adds components from its config: which component types are supported, where
each can be placed, how options and layer references are applied, and when components are
created.

## Requirements

### Requirement: Components are created from config
The viewer SHALL create one component for each entry of the `components` config array, using the
entry's `type`. Only registered component types SHALL be accepted. This version registers two
types: `home`, a button that returns the map to its configured initial view, and `legend`, which
shows the symbols of the map's layers.

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
