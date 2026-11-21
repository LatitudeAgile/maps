# buffalo-river Specification

## Purpose

The `buffalo-river` component type and its sample app. They show the Buffalo River in Arkansas in a
3D scene, coloured by an estimated floating level from live USGS gauges, and plan float trips
between its access points.

## Requirements

### Requirement: The type is a 3D sidebar panel
The viewer SHALL provide a `buffalo-river` component type from `extensions/buffalo-river/`. It
SHALL be placed only in `panel` and SHALL work only in a 3D scene. Its panel heading SHALL default
to "Buffalo River". It SHALL take no options, and it SHALL need no API key.

#### Scenario: In a 3D app
- **WHEN** a config-built 3D scene has `{ "id": "river", "type": "buffalo-river" }` in its `components`
- **THEN** validation passes, and the sidebar has a Buffalo River panel

#### Scenario: In a corner
- **WHEN** a `buffalo-river` entry has `"placement": "top-right"`
- **THEN** validation fails with an error at that entry's `placement` that lists `panel` as the only supported placement

#### Scenario: In a 2D app
- **WHEN** an app with no `map.view` has a `buffalo-river` component
- **THEN** validation fails with an error at that entry saying the type needs a 3D view

#### Scenario: Without an API key
- **WHEN** the Buffalo River sample app is opened in a build with no API key
- **THEN** the river, its levels and the access points show, the points of interest, the river gauges, the wilderness areas and the park boundary show when turned on in the Layers panel, and no sign-in dialog appears

### Requirement: The river is coloured by estimated level
The component SHALL add the Buffalo River to the scene, from its headwaters to the White River.
Each stretch SHALL be coloured by its estimated level in one of five bands: Very Low, Low,
Moderate, High and Flood. Each band SHALL have its own colour, the same in light and dark mode,
and the river's colour SHALL change gradually between bands along its length. The river's line
SHALL follow the USGS National Hydrography Dataset's large-scale flowlines for the Buffalo River.

#### Scenario: River drawn at the newest reading
- **GIVEN** the Buffalo River sample app, with the gauge readings loaded
- **WHEN** the scene has finished loading
- **THEN** the whole river is drawn as a coloured line, and the colours match the estimated levels for the newest reading

#### Scenario: Legend shows the bands
- **GIVEN** the Buffalo River sample app
- **WHEN** the user opens the Legend panel
- **THEN** the river layer is listed with its five bands, named Very Low to Flood

#### Scenario: The line follows the channel
- **GIVEN** the Buffalo River sample app, switched to satellite imagery in Basemaps
- **WHEN** the user zooms to any stretch of the river
- **THEN** the river line lies on the channel in the imagery, and doesn't cut across the inside of bends

### Requirement: Levels are estimated from five USGS gauges
Levels SHALL be estimated from discharge readings at the Boxley, Ponca, Pruitt, St. Joe and
Harriet USGS gauges over the 48 hours up to now. Between two gauges, the estimate SHALL blend both
gauges' readings and level bands, weighted by distance. Above the first gauge and below the last,
the estimate SHALL use that gauge alone. The readings SHALL be fetched once when the component is
added, and again when the user asks to refresh.

#### Scenario: Readings fetched on start
- **WHEN** the Buffalo River sample app is opened
- **THEN** one or more requests go to the USGS Water Data API for those five gauges, covering the last 48 hours, and none are sent again while the app stays open and the user doesn't refresh

#### Scenario: Refresh
- **GIVEN** the readings have loaded
- **WHEN** the user presses Refresh in the panel
- **THEN** the readings are fetched again, and the panel and the river show the newest reading

#### Scenario: A gauge is missing a reading
- **GIVEN** the API returns no reading at one gauge for one time, and readings at every gauge for an earlier time
- **WHEN** the readings load
- **THEN** that time is still offered, using that gauge's most recent earlier reading

### Requirement: The panel says when the levels were read
The panel SHALL show the date and time of the reading the river is drawn for, in the browser's
locale and time zone. It SHALL say the levels are estimates.

#### Scenario: Time of the newest reading
- **WHEN** the readings have loaded
- **THEN** the panel shows the newest reading's date and time, and the slider is at its right end

### Requirement: A time slider steps through the readings
The panel SHALL have a slider with one stop for each hour in the 48 hours, plus a stop for the
newest reading. Moving it SHALL redraw the river for that reading. Previous and next buttons SHALL
move one stop. Play SHALL step forward about every half second until the last stop, and Pause, a
step button or dragging the slider SHALL stop it.

#### Scenario: Move back in time
- **GIVEN** the readings have loaded
- **WHEN** the user drags the slider to its left end
- **THEN** the panel shows a time about 48 hours earlier, and within 2 seconds the river's colours are those of that reading

#### Scenario: Play
- **GIVEN** the slider is at its left end
- **WHEN** the user presses Play
- **THEN** the slider moves forward one stop at a time, the river is redrawn at each stop, and it stops at the right end with the Play button showing again

#### Scenario: Play from the end
- **GIVEN** the slider is at its right end
- **WHEN** the user presses Play
- **THEN** the slider starts again from its left end

#### Scenario: Step buttons at the ends
- **WHEN** the slider is at its left end
- **THEN** the previous button is disabled, and at the right end the next button is disabled

### Requirement: A failed load is reported and can be retried
If the readings can't be loaded, the panel SHALL say the levels are unavailable and offer Retry.
The river SHALL still be drawn, in one neutral colour that isn't one of the five bands. The time
slider SHALL be disabled. Access points, points of interest and trip planning SHALL keep working,
and trips SHALL show no level.

#### Scenario: USGS unreachable
- **GIVEN** requests to `api.waterdata.usgs.gov` fail
- **WHEN** the Buffalo River sample app is opened
- **THEN** the panel shows that levels are unavailable with a Retry button, the river is drawn in the neutral colour, and the access points still show

#### Scenario: Retry succeeds
- **GIVEN** the load failed, and the USGS API is reachable again
- **WHEN** the user presses Retry
- **THEN** the notice goes away, the river is coloured by level, and the slider is enabled

#### Scenario: Trip without levels
- **GIVEN** the load failed
- **WHEN** the user selects a trip
- **THEN** the trip shows its distance and time, and its level as unavailable

### Requirement: Access points are shown on the map
The component SHALL add the river's 28 access points to the scene, each with an icon and its name.
Primitive access points SHALL have their own icon and colour. The access points SHALL be one
layer, named "Access points", that the layer list can turn off. Clicking one SHALL NOT open a
popup.

#### Scenario: Access points in the layer list
- **GIVEN** the Buffalo River sample app
- **WHEN** the user opens the Layers panel and clears "Access points"
- **THEN** the access-point icons and names disappear from the scene

#### Scenario: Primitive access
- **WHEN** the scene shows Dixon Ford and Boxley Bridge
- **THEN** Dixon Ford's icon has a different colour from Boxley Bridge's

### Requirement: Each kind of point of interest is its own layer
The component SHALL add the river's points of interest as a group layer named "Points of interest",
with one layer for each kind: Streams, Bluffs, Hollows, Trails, Bridges and Other. Each layer SHALL
come from its own data set in the extension, and SHALL have its kind's icon. The layer list SHALL
turn each layer, and the whole group, on and off. Every layer in the group, River gauges among
them, SHALL be off at first. The panel SHALL have no filter of its own.

#### Scenario: Only the river at first
- **WHEN** the Buffalo River sample app opens
- **THEN** the scene shows the river and its access points, and no points of interest, gauges, wilderness areas or park boundary

#### Scenario: Show only bluffs
- **WHEN** the user opens the Layers panel and checks Bluffs
- **THEN** the scene shows bluffs, and no streams, hollows, trails, bridges, other points or gauges

#### Scenario: Group off
- **WHEN** the user clears "Points of interest" in the Layers panel
- **THEN** no points of interest or gauges show, and checking it again shows them again

#### Scenario: Kinds in the legend
- **WHEN** the user opens the Legend panel
- **THEN** each kind of point of interest is listed with its icon

### Requirement: The river's gauges are shown as points of interest
The "Points of interest" group SHALL include a "River gauges" layer, listed first. It SHALL show
the USGS gauges on the Buffalo River in Arkansas, read live from the Live Stream Gauges service in
ArcGIS Living Atlas, each with an icon and a short name such as "Boxley gauge". Clicking a gauge
SHALL open a popup with its name, its latest flow and height, the time of that reading, and a link
to its USGS station page.

#### Scenario: Gauges on the map
- **WHEN** the Buffalo River sample app has loaded and the user checks River gauges in the Layers panel
- **THEN** the River gauges layer shows the Boxley, Ponca, Pruitt, Carver, St. Joe and Harriet gauges, and no gauge on another river or in another state

#### Scenario: Gauge popup
- **WHEN** River gauges is on and the user clicks the Boxley gauge
- **THEN** the popup shows "Buffalo River near Boxley, AR", its flow in cubic feet per second, its height in feet, the time of its last reading, and a link that opens its USGS station page in a new tab

### Requirement: The park boundary is shown
The component SHALL add Buffalo National River's boundary, read live from the National Park
Service's public boundary service, as a faint green fill under the river. Its layer SHALL be named
"Buffalo National River boundary", and SHALL be off at first. Clicking inside the park SHALL NOT open a popup.

#### Scenario: Park on the map
- **WHEN** the Buffalo River sample app has loaded and the user checks "Buffalo National River boundary" in the Layers panel
- **THEN** a green outline follows the river's corridor, and clearing "Buffalo National River boundary" again hides it

### Requirement: The river's three wilderness areas are shown
The component SHALL add "Upper Buffalo Wilderness", "Ponca Wilderness" and "Lower Buffalo
Wilderness" layers from Wilderness Connect's public service, off at first and with no popup. The
Upper Buffalo SHALL join the Forest Service's area to the Park Service's next to it. If the
service can't be read, all three SHALL stay empty and the component SHALL keep working.

#### Scenario: Wilderness on the map
- **WHEN** the Buffalo River sample app has loaded and the user checks the three wilderness layers in the Layers panel
- **THEN** one dashed area with no line through it surrounds the river south of Boxley Bridge, one surrounds it around Ponca and Steel Creek, another surrounds it from below Rush Landing to the White River, and the attribution credits Wilderness Connect

#### Scenario: Wilderness service unavailable
- **WHEN** the wilderness service can't be reached
- **THEN** the three wilderness layers are listed and empty, a warning is logged, and the river, its levels, access points and trips work as before

### Requirement: A point of interest's details open in a popup
Clicking a point of interest SHALL open the scene's popup with the point's name, its type, which
side of the river it's on when that's known ("River left" or "River right"), and its description
when it has one, each paragraph separately. A point whose data names a source for its description
SHALL credit that source under it.

#### Scenario: Point with a description
- **WHEN** the user clicks Benton Bluff
- **THEN** the popup shows "Benton Bluff", that it's a bluff on river left, and "Named after artist Thomas Hart Benton."

#### Scenario: Point without a description
- **WHEN** the user clicks a point of interest that has no description
- **THEN** the popup shows its name, its type and its side of the river, and says no description is available

### Requirement: Clicking two access points selects a trip
A click on an access point SHALL select it as the trip's first point and open the Buffalo River
panel if it's closed. A click on a second access point SHALL complete the trip. The point further
up the river SHALL be the put-in, whichever was clicked first. A third click SHALL start a new
trip from the clicked point. Clicks elsewhere SHALL NOT change the trip.

#### Scenario: Pick a trip with the panel closed
- **GIVEN** the Buffalo River panel is closed
- **WHEN** the user clicks Kyles Landing and then Ponca Bridge
- **THEN** the panel opens on the first click, and after the second it shows Ponca Bridge as the put-in and Kyles Landing as the take-out

#### Scenario: Selection on the map
- **WHEN** a trip from Ponca Bridge to Kyles Landing is selected
- **THEN** both access points are highlighted, and the river between them is outlined in cyan on both sides, with its level colours still showing

#### Scenario: Waiting for the second point
- **WHEN** the user has clicked only Ponca Bridge
- **THEN** the panel shows Ponca Bridge and asks for another access point, and no stretch of river is highlighted

#### Scenario: Start over
- **GIVEN** a trip from Ponca Bridge to Kyles Landing
- **WHEN** the user clicks Erbie
- **THEN** the trip has Erbie as its only point, and the highlight is gone

#### Scenario: Clear
- **GIVEN** a trip is selected
- **WHEN** the user presses the trip's clear button in the panel
- **THEN** no access point is highlighted, and no stretch of river is highlighted

#### Scenario: Click on the river
- **GIVEN** a trip is selected
- **WHEN** the user clicks the river or the ground away from any access point
- **THEN** the trip doesn't change

### Requirement: A trip shows its distance, time and level
A selected trip SHALL show the distance along the river in miles to two decimal places, and an
estimated time at 2.5 miles per hour, with a note that says so. It SHALL show the trip's level at
the newest reading, as one of the five bands with that band's guidance. When either end is a
primitive access, it SHALL warn which one.

#### Scenario: Trip summary
- **WHEN** a trip from Ponca Bridge to Kyles Landing is selected
- **THEN** the panel shows the distance in miles, an estimated time in hours and minutes that matches 2.5 mph for that distance, and a level band

#### Scenario: Primitive access warning
- **WHEN** a trip from Dixon Ford to Boxley Bridge is selected
- **THEN** the panel warns that Dixon Ford is a primitive access

#### Scenario: Level doesn't follow the slider
- **GIVEN** a trip is selected and the slider is moved to its left end
- **THEN** the trip's level is still the level at the newest reading

### Requirement: Trip details plan a day on the river
A completed trip SHALL offer Trip details, a view in the panel with a way back. It SHALL let the
user choose a date: Today, Tomorrow, the coming Saturday or Sunday, or any other date, with the
coming weekend as the default. For that date it SHALL show sunrise and sunset at the put-in, the
latest time to launch and still finish by sunset, and the number of days at 8 hours of paddling a
day.

#### Scenario: Open and go back
- **GIVEN** a trip from Ponca Bridge to Kyles Landing
- **WHEN** the user opens Trip details and then goes back
- **THEN** the details show both access points, and going back shows the panel with the trip still selected

#### Scenario: Default date
- **WHEN** the user opens Trip details on a Wednesday
- **THEN** the chosen date is the coming Saturday

#### Scenario: Sun times
- **WHEN** the user picks a date in Trip details
- **THEN** sunrise and sunset for that date at the put-in are shown, each within 5 minutes of the times NOAA's solar calculator gives for that place

#### Scenario: Latest launch
- **WHEN** a trip's estimated time is shorter than the daylight on the chosen date
- **THEN** the details show a latest launch time equal to sunset minus the estimated time

#### Scenario: Multi-day trip
- **WHEN** a trip from Ponca Bridge to Buffalo Point is selected
- **THEN** the details say the trip takes more than one day, as the estimated time divided by 8 hours, rounded up

#### Scenario: Level only for today
- **WHEN** the chosen date isn't today
- **THEN** the details show no level for the trip, and say there's no forecast for a future date, or no history for a past one

### Requirement: Trip details show how to get there and what's on the way
Trip details SHALL have directions links for the put-in, for the take-out, and for the shuttle
between them. It SHALL show a map of the whole river with the trip's stretch marked, and a closer
map of the stretch. It SHALL list the points of interest along the way, with miles from the
put-in.

#### Scenario: Directions
- **WHEN** the user presses the directions link for the put-in
- **THEN** a new tab opens Google Maps with directions to the put-in's coordinates, and the viewer stays open

#### Scenario: Points along the trip
- **WHEN** Trip details is open for Ponca Bridge to Kyles Landing
- **THEN** it lists the points of interest between them in downstream order, each with its miles from the put-in, and includes a point right at either end

### Requirement: A safety warning is acknowledged once per app
The first time the component is shown in an app, it SHALL show a modal warning that the levels are
estimates, that conditions change quickly, and that users must check conditions themselves. The
warning SHALL stay until the user acknowledges it. After that, it SHALL NOT be shown again in that
app in that browser.

#### Scenario: First visit
- **GIVEN** a browser that has never opened the Buffalo River sample app
- **WHEN** the app opens
- **THEN** the warning is shown, and it can't be dismissed except with Acknowledge

#### Scenario: Return visit
- **GIVEN** the user acknowledged the warning
- **WHEN** the app is reloaded
- **THEN** no warning is shown

### Requirement: Closing the panel keeps the river on the map
Closing the Buffalo River panel SHALL leave the river, its colours, the access points, the points
of interest and any selected trip on the map, and SHALL pause playback. Opening the panel again
SHALL show the same reading and trip.

#### Scenario: Close during playback
- **GIVEN** playback is running and a trip is selected
- **WHEN** the user closes the panel
- **THEN** the river stops changing colour, the trip stays highlighted, and reopening the panel shows the same slider position and trip

### Requirement: Removing the component cleans up
When the component is removed from the page, its layers, highlights and map-click handling SHALL be
removed from the scene, and no pending request or timer SHALL change the scene afterwards.

#### Scenario: Removed while readings load
- **GIVEN** the gauge readings are still loading
- **WHEN** the component's element is removed from the page
- **THEN** all of its layers (the river, access points, points of interest, gauges, wilderness areas and park boundary) are gone, no error is reported when the readings arrive, and clicking where an access point was does nothing

### Requirement: The Buffalo River sample app
The repository SHALL include a Buffalo River app, listed in the apps catalog. It SHALL open a 3D
scene with OpenStreetMap on world elevation, looking down on the whole river at 1:300,000. It
SHALL have the `buffalo-river` panel, a layer list with group layers opened, a legend, bookmarks
for the river's sections, basemaps, Measure in the map's bottom-left corner, Locate with Home and
Zoom, and Fullscreen at the top right. Its description SHALL credit the
original app at brokan.xyz/buffalo.

#### Scenario: Open from the catalog
- **WHEN** the user opens the Apps panel and chooses Buffalo River
- **THEN** a 3D scene opens with the whole river in view at 1280x800, the sidebar has Buffalo River, Layers, Legend, Bookmarks and Basemaps panels, a Measure button is in the map's bottom-left corner, Locate is between Home and Zoom, and Fullscreen is above the compass

#### Scenario: Go to a section
- **WHEN** the user opens Bookmarks and chooses "Ponca Bridge to Kyles Landing"
- **THEN** the scene goes to that stretch at 1:50,000, with Ponca Bridge, Steel Creek and Kyles Landing in view beside the open sidebar

#### Scenario: Measure a stretch
- **WHEN** the user opens Measure from its corner button and measures a distance along the river
- **THEN** the length shows in feet or miles, and the sidebar stays as it was

#### Scenario: Points of interest open in the layer list
- **WHEN** the user opens the Layers panel for the first time
- **THEN** "Points of interest" is open, listing River gauges, Streams, Bluffs, Hollows, Trails, Bridges and Other

#### Scenario: Credit
- **WHEN** the user reads the app's description in the Apps panel
- **THEN** it names brokan.xyz/buffalo as the original app
