# map-measurements Specification

## Purpose

Defines the `measure` component: measuring distances and areas on the map in 2D maps and 3D
scenes, its units, the Clear button, and what happens to measurements when the panel or expand
that holds it closes.

## Requirements

### Requirement: The measure component measures distances and areas
A `measure` component SHALL let the user draw a line and read its length, or draw an area and
read its area and perimeter, on the map. Its `tools` option SHALL list the tools it offers,
`distance` and `area`, in the order shown. It SHALL default to both. With two tools, a switch
SHALL choose between them. With one, no switch SHALL be shown. Its sidebar heading SHALL be
"Measure".

#### Scenario: Measure a distance
- **GIVEN** a `measure` panel with no options, in a 2D map
- **WHEN** the user opens the Measure panel, chooses Distance, starts a measurement and clicks two points on the map, then double-clicks
- **THEN** a line joins the points on the map and the panel shows its length

#### Scenario: Measure an area
- **GIVEN** a `measure` panel with no options, in a 2D map
- **WHEN** the user chooses Area, starts a measurement and clicks four points on the map, then double-clicks
- **THEN** the area is drawn on the map and the panel shows its area and perimeter

#### Scenario: Both tools by default
- **WHEN** a `measure` component has no `tools` option
- **THEN** validation passes, its `tools` are `distance` and `area`, and it shows a switch with Distance first

#### Scenario: One tool
- **WHEN** a `measure` component has `"options": { "tools": ["area"] }`
- **THEN** it shows the area tool and no switch

#### Scenario: Invalid tools
- **WHEN** a `measure` component has `"options": { "tools": [] }`, or `"tools": ["area", "area"]`
- **THEN** validation fails with an error at `components[0].options.tools` saying a list of `distance` and `area`, each at most once, is expected

#### Scenario: Unknown tool
- **WHEN** a `measure` component has `"options": { "tools": ["volume"] }`
- **THEN** validation fails with an error at `components[0].options.tools[0]` that lists `distance` and `area`

### Requirement: Measuring works in 2D maps and 3D scenes
A `measure` component SHALL work in 2D maps and in 3D scenes. In a scene, the distance tool SHALL
measure the straight line between two points and show its direct, horizontal and vertical
distances. The area tool SHALL measure an area on the scene's surface.

#### Scenario: Distance in a scene
- **GIVEN** the City Scene sample app with a `measure` component
- **WHEN** the user measures from the top of one building to the street below
- **THEN** the component shows a direct, a horizontal and a vertical distance, and the vertical distance is greater than 0

#### Scenario: Measure in a web scene
- **WHEN** an app with a web scene item has a `measure` panel
- **THEN** validation passes, the sidebar has a Measure icon, and both tools measure in the scene

### Requirement: Measurements use the configured units
A `measure` component's `unit` option SHALL be `imperial` or `metric` and SHALL default to
`imperial`. Lengths and areas SHALL be shown in units of that system, chosen to suit the size of
the measurement. The user SHALL still be able to pick another unit in the component.

#### Scenario: Imperial by default
- **GIVEN** a `measure` component with no `unit` option
- **WHEN** the user measures a line about 5 km long
- **THEN** its length is shown in miles

#### Scenario: Metric
- **GIVEN** a `measure` component with `"options": { "unit": "metric" }`
- **WHEN** the user measures a line about 5 km long
- **THEN** its length is shown in kilometers

#### Scenario: Invalid unit
- **WHEN** a `measure` component has `"options": { "unit": "nautical" }`
- **THEN** validation fails with an error at `components[0].options.unit` that lists `imperial` and `metric`

### Requirement: The Clear button removes the measurements
A `measure` component SHALL have a Clear button. Pressing it SHALL remove every measurement the
component has on the map, for both tools, and SHALL stop a measurement in progress. The button
SHALL be disabled when the component has nothing on the map. After clearing, the user SHALL be
able to start a new measurement.

#### Scenario: Clear a finished measurement
- **GIVEN** a `measure` component with a finished distance measurement on the map
- **WHEN** the user presses Clear
- **THEN** the line and its length are gone from the map, and the Clear button is disabled

#### Scenario: Clear both tools
- **GIVEN** a finished distance measurement, and then a finished area measurement made after switching to Area
- **WHEN** the user presses Clear
- **THEN** neither measurement is on the map

#### Scenario: Nothing to clear
- **WHEN** a `measure` component has just been opened and nothing has been measured
- **THEN** its Clear button is disabled

#### Scenario: Measure again after clearing
- **GIVEN** the user has pressed Clear
- **WHEN** the user starts a new distance measurement and clicks two points
- **THEN** the new line and its length are shown

### Requirement: Closing keeps finished measurements and stops one in progress
When the panel or expand that holds a `measure` component closes, a measurement in progress SHALL
be stopped and removed. A finished measurement SHALL stay on the map. Clicks on the map while the
component is closed SHALL NOT add points to a measurement. When it opens again, a finished
measurement SHALL still be shown in it, with Clear enabled.

#### Scenario: Close with a finished measurement
- **GIVEN** a `measure` panel with a finished distance measurement
- **WHEN** the user closes the Measure panel, and opens it again
- **THEN** the line stays on the map while the panel is closed, and the reopened panel shows its length with Clear enabled

#### Scenario: Close during a measurement
- **GIVEN** a `measure` component in a corner expand, with a distance measurement started and one point clicked
- **WHEN** the user closes the expand, clicks the map twice, and then clicks a feature
- **THEN** the partly drawn line is gone, no new line is drawn, and the feature's popup opens

#### Scenario: Switching tools stops a measurement in progress
- **GIVEN** a finished area measurement, and then a distance measurement started with one point clicked
- **WHEN** the user switches to Area
- **THEN** the partly drawn line is gone, and the finished area is still on the map
