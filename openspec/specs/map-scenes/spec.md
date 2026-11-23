# map-scenes Specification

## Purpose

Lets an app show its map in 3D, as a scene built from the config or opened from a web scene
item: the ground and its elevation, the starting tilt and heading, and how map controls behave
in 3D.

## Requirements

### Requirement: A config can build a 3D scene
When `map.view` is `"3d"`, the viewer SHALL show the configured basemap and layers as a global
3D scene, at the configured `center` with `zoom` or `scale`. `map.view` SHALL be `"2d"`
or `"3d"`, SHALL default to `"2d"`, and any other value SHALL fail validation.

#### Scenario: Config-built scene
- **WHEN** an app has `"map": { "view": "3d", "basemap": "satellite", "center": [-122.40, 37.79], "scale": 20000 }` and one `scene` layer of buildings
- **THEN** a 3D scene opens centered within 0.01° of that point, with the satellite basemap and the buildings drawn in 3D

#### Scenario: 2D by default
- **WHEN** an app has no `map.view` and no `map.item`
- **THEN** the map opens in 2D, as before this change

#### Scenario: Invalid view
- **WHEN** `map.view` is `"globe"`
- **THEN** validation fails with an error at `map.view` saying `"2d"` or `"3d"` is expected

### Requirement: The ground shows world elevation by default
In a config-built 3D scene, `map.ground` SHALL set the ground: `"world-elevation"` (the default)
shows Esri's world terrain, and `"none"` shows a flat ground. It SHALL work without an API key
and without signing in. Setting `map.ground` in a 2D app SHALL fail validation.

#### Scenario: Terrain by default
- **GIVEN** a config-built 3D scene with no `map.ground`, centered on Mount Rainier and tilted 70°
- **WHEN** the scene has finished loading
- **THEN** the mountain stands out from the ground around it, and no sign-in dialog appears

#### Scenario: Flat ground
- **WHEN** a config-built 3D scene sets `"ground": "none"`
- **THEN** the scene's ground is flat, and no request goes to the world elevation service

#### Scenario: Ground in a 2D app
- **WHEN** an app with no `map.view` and no `map.item` sets `"ground": "world-elevation"`
- **THEN** validation fails with an error at `map.ground` saying the ground needs `"view": "3d"`

#### Scenario: Unknown ground
- **WHEN** a config-built 3D scene sets `"ground": "mars"`
- **THEN** validation fails with an error at `map.ground` saying `"world-elevation"` or `"none"` is expected

### Requirement: Elevation layers add to the ground
An `elevation` layer entry SHALL add its elevation to the scene's ground instead of appearing
in the layer list. With `"ground": "none"`, the ground SHALL have only the configured elevation
layers. An elevation layer that fails SHALL be reported like any failed layer.

#### Scenario: Local elevation on top of world elevation
- **WHEN** a config-built 3D scene has an `elevation` layer with `id` `lidar-dem`
- **THEN** the scene's ground uses that layer's elevation where it has data, and the layer list doesn't list `lidar-dem`

#### Scenario: Elevation layer fails
- **WHEN** an `elevation` layer's URL returns HTTP 404
- **THEN** the scene opens, and a warning notice names that layer's `id`

### Requirement: The starting view can be tilted and turned
In a 3D app, `map.tilt` SHALL set the starting tilt in degrees, from 0 (looking straight down,
the default) to 90 (looking at the horizon). `map.heading` SHALL set the starting compass
direction in degrees, from 0 (north up, the default) up to but not including 360.

#### Scenario: Tilted and turned
- **WHEN** a config-built 3D scene sets `"tilt": 65` and `"heading": 90`
- **THEN** the scene opens with its camera tilted within 1° of 65° and facing east within 1°

#### Scenario: Out of range
- **WHEN** a config-built 3D scene sets `"tilt": 120`
- **THEN** validation fails with an error at `map.tilt` saying a number from 0 to 90 is expected

#### Scenario: Tilt in a 2D app
- **WHEN** an app with no `map.view` and no `map.item` sets `"tilt": 45`
- **THEN** validation fails with an error at `map.tilt` saying tilt needs `"view": "3d"`

### Requirement: Scene settings override a web scene item
With `map.item` set, `map.tilt`, `map.heading` and `map.ground` SHALL be accepted. When the item
is a web scene, each one that is set SHALL replace the web scene's own value. When the item is a
web map, each one SHALL be ignored, with one console warning naming it.

#### Scenario: Tilt over a web scene
- **WHEN** an app with a web scene item sets `"tilt": 30`
- **THEN** the scene opens at the web scene's center, tilted within 1° of 30°

#### Scenario: Tilt over a web map
- **WHEN** an app with a web map item sets `"tilt": 30`
- **THEN** the map opens in 2D at the web map's starting view, and one console warning names `map.tilt`

### Requirement: Map controls work in 3D
In a 3D app, the zoom buttons SHALL move the camera closer or farther. The Home button SHALL
return the camera to the starting view, including its tilt and heading. Resizing the window
SHALL keep the scene's center, as in 2D.

#### Scenario: Zoom in a scene
- **GIVEN** a 3D app with a `zoom` component
- **WHEN** the scene has settled and the zoom-in button is pressed
- **THEN** after the scene settles, its scale is smaller than before

#### Scenario: Home after rotating
- **GIVEN** a config-built 3D scene with `"tilt": 65`, `"heading": 90` and a `home` component
- **WHEN** the user rotates and pans the scene, and then presses the Home button
- **THEN** the camera returns within 1° of a 65° tilt and a 90° heading, and the center within 0.01° of the configured center
