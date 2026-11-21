# tracks Specification

## Purpose

The `tracks` component type: a sidebar panel that opens GPX files from the user's device, keeps
them in a library in the browser shared by every app, and shows any number of them on the map in
2D or 3D, each with its own name, notes, color and stats.

## Requirements

### Requirement: The type is a sidebar panel for 2D and 3D
A config entry of type `tracks` SHALL be placed only in `panel` and SHALL work in both a 2D map and
a 3D scene. Its panel heading SHALL default to "Tracks". Apps that don't use the type SHALL not
download its code.

#### Scenario: Added to a 3D app
- **GIVEN** an app with a 3D scene and a component entry `{ "id": "tracks", "type": "tracks" }`
- **WHEN** the app opens
- **THEN** the sidebar has a Tracks panel

#### Scenario: Added to a 2D app
- **GIVEN** an app with a 2D map and the same entry
- **WHEN** the app opens
- **THEN** the sidebar has a Tracks panel, and tracks opened in it show on the map

#### Scenario: Placed in a map corner
- **GIVEN** an entry of type `tracks` with `"placement": "top-right"`
- **WHEN** the app opens
- **THEN** validation fails with an error at that entry's `placement` that lists `panel` as the only supported placement

### Requirement: Distances and heights use the configured units
The type SHALL take a `units` option, `"imperial"` or `"metric"`, defaulting to `"imperial"`.
Imperial SHALL show distances in miles and heights in feet; metric SHALL show kilometers and meters.

#### Scenario: Metric
- **GIVEN** the entry has `"options": { "units": "metric" }` and a track is in the library
- **WHEN** the user opens the track's details
- **THEN** its distance is in kilometers and its elevation gain and loss are in meters

#### Scenario: Unknown units
- **GIVEN** the entry has `"options": { "units": "nautical" }`
- **WHEN** the app opens
- **THEN** validation fails with an error at `options.units` that lists `imperial` and `metric`

### Requirement: GPX files are opened from the user's device
The panel SHALL have an Open button that lets the user choose one or more `.gpx` files. Each file
SHALL become one entry in the library. A file's tracks and routes SHALL be its lines, and its
waypoints its points. The file SHALL be read in the browser and SHALL not be sent anywhere.

#### Scenario: Open one file
- **WHEN** the user presses Open and chooses a GPX file of a hike
- **THEN** the hike is added to the library list and drawn on the map

#### Scenario: Open several files at once
- **WHEN** the user chooses three GPX files in one go
- **THEN** all three are added to the library, each as its own entry

#### Scenario: A file with several tracks and waypoints
- **GIVEN** a GPX file with two tracks, one route and four waypoints
- **WHEN** the user opens it
- **THEN** one entry is added, and the map shows three lines and four points in that entry's color

#### Scenario: Nothing is uploaded
- **WHEN** the user opens a GPX file with the browser's network tools open
- **THEN** no request carries the file's contents

### Requirement: A new track is named from its file
A new entry's name SHALL be the GPX file's own name for its contents when it has one, otherwise its
first track's or route's name, otherwise the file name without `.gpx`.

#### Scenario: Named in the file
- **GIVEN** a file `2026-10-12.gpx` whose metadata names it "Ozark Highlands day 3"
- **WHEN** the user opens it
- **THEN** the entry is named "Ozark Highlands day 3"

#### Scenario: No name in the file
- **GIVEN** a file `lost-valley.gpx` with no name in its metadata, tracks or routes
- **WHEN** the user opens it
- **THEN** the entry is named "lost-valley"

### Requirement: A file that can't be read is reported
A file that isn't valid GPX, or that has no tracks, routes or waypoints, SHALL not be added. A
notice SHALL name the file and say why. The other files chosen with it SHALL still be added.

#### Scenario: Not a GPX file
- **WHEN** the user chooses `notes.gpx` that holds plain text, together with a valid GPX file
- **THEN** a notice says `notes.gpx` couldn't be read, and the valid file is added

#### Scenario: An empty GPX file
- **WHEN** the user opens a GPX file with no tracks, routes or waypoints
- **THEN** a notice says the file has nothing to show, and the library is unchanged

### Requirement: A file already in the library is skipped
Opening a file whose contents are the same as an entry already in the library SHALL not add a
second entry. A notice SHALL say the file is already in the library, under that entry's name.

#### Scenario: Opened twice
- **GIVEN** `lost-valley.gpx` is in the library, renamed "Lost Valley loop"
- **WHEN** the user opens `lost-valley.gpx` again
- **THEN** the library still has one entry for it, and a notice says it's already there as "Lost Valley loop"

### Requirement: The library is kept in the browser and shared by every app
The library SHALL be kept in the browser, so it's still there after a reload. It SHALL be the same
in every app on the same site. The list SHALL show the most recently added entry first.

#### Scenario: After a reload
- **GIVEN** the user opened two files and renamed one
- **WHEN** the user reloads the page
- **THEN** the Tracks panel lists both entries, in the same order, with the new name

#### Scenario: In another app
- **GIVEN** the user opened a file in one app with a Tracks panel
- **WHEN** the user opens another app that has a Tracks panel
- **THEN** its Tracks panel lists the same entry

### Requirement: Each app remembers which tracks are on the map
Each entry in the list SHALL have a checkbox that shows or hides it. Each app SHALL remember its own
checkboxes across reloads. An entry turned on in one app SHALL not be on in another app until
turned on there. A newly opened file SHALL be turned on in the app it was opened in.

#### Scenario: Several at once
- **GIVEN** three entries in the library
- **WHEN** the user checks two of them
- **THEN** both are drawn on the map, each in its own color, and the third isn't

#### Scenario: Remembered after a reload
- **GIVEN** two of three entries are checked in the Buffalo River app
- **WHEN** the user reloads the page
- **THEN** the same two are checked and drawn

#### Scenario: Not carried to another app
- **GIVEN** an entry is checked in the Buffalo River app
- **WHEN** the user opens another app with a Tracks panel for the first time
- **THEN** the entry is listed there, unchecked, and isn't drawn

### Requirement: The map goes to newly opened tracks
After the user opens files, the map SHALL go to show all of the entries just added.

#### Scenario: Open a file far away
- **GIVEN** the map shows Arkansas
- **WHEN** the user opens a GPX file of a hike in Colorado
- **THEN** the map goes to the hike, with all of it in view beside the open sidebar

### Requirement: Tracks are drawn in their color, on the ground in 3D
An entry's lines and waypoints SHALL be drawn in its color, readable on light and dark basemaps.
In a 3D scene they SHALL be draped on the ground, so the terrain never hides any part of them,
whatever elevations the file recorded.

#### Scenario: Elevations below the terrain
- **GIVEN** a 3D scene with world elevation, and a GPX file whose recorded elevations are 30 m below the terrain for part of the track
- **WHEN** the user opens it and tilts the view along that part
- **THEN** the whole line is visible on the terrain surface

#### Scenario: Waypoints in 3D
- **GIVEN** a 3D scene and a file with waypoints in a valley
- **WHEN** the user tilts the view to look across the valley
- **THEN** each waypoint is visible on the ground where it was recorded

#### Scenario: On a dark basemap
- **WHEN** the user switches to a dark basemap with tracks on the map
- **THEN** every track and waypoint can still be seen clearly

### Requirement: Tracks on the map are listed in the layer list and legend
Entries turned on in this session SHALL be listed by name in a "Tracks" group in the layer list and
in the legend. Turning an entry on or off in the layer list SHALL do the same in the panel, and the
other way round, and SHALL be remembered the same way.

#### Scenario: Turned off in the layer list
- **GIVEN** an entry is checked in the Tracks panel
- **WHEN** the user opens Layers and clears it under "Tracks"
- **THEN** the track leaves the map, its checkbox in the Tracks panel is cleared, and after a reload it's still off

#### Scenario: Never turned on
- **GIVEN** the library has five entries and two are checked
- **WHEN** the user opens Layers
- **THEN** the "Tracks" group lists the two checked entries and not the other three

#### Scenario: In the legend
- **GIVEN** two entries are checked
- **WHEN** the user opens Legend
- **THEN** it shows both under their names, in their colors

### Requirement: Closing the panel keeps tracks on the map
Closing the Tracks panel SHALL leave every checked entry on the map. Opening it again SHALL show
the list or detail view the user left.

#### Scenario: Close and reopen
- **GIVEN** the user is looking at an entry's details
- **WHEN** the user closes the Tracks panel and opens it again
- **THEN** the tracks are still on the map, and the panel shows the same entry's details

### Requirement: Each track has a detail view with its name, notes and color
Choosing an entry in the list SHALL open its details, with a way back to the list. The user SHALL be
able to change its name and notes and choose its color from a palette. Changes SHALL be kept in the
library, and the new name and color SHALL show in the list, on the map, in the layer list and in
the legend.

#### Scenario: Rename
- **GIVEN** an entry is checked and listed in Layers
- **WHEN** the user opens its details and changes its name to "Day 3: Hurricane Creek"
- **THEN** the list, the layer list and the legend show the new name, and it's still there after a reload and in other apps

#### Scenario: Name cleared
- **WHEN** the user clears the name field and leaves it
- **THEN** the entry keeps its previous name

#### Scenario: Notes
- **WHEN** the user writes notes in an entry's details and reloads the page
- **THEN** the notes are there when its details are opened again

#### Scenario: Change color
- **GIVEN** an entry is checked
- **WHEN** the user chooses another color in its details
- **THEN** its lines and waypoints are redrawn in that color, and its swatch in the list and its legend symbol change to match

#### Scenario: New entries get different colors
- **WHEN** the user opens three files in one go
- **THEN** each entry is given a different color from the palette

### Requirement: Stats are worked out from the file
An entry's details SHALL show the length of its lines, and its elevation gain and loss when the file
has elevations. When the file has times, they SHALL also show the date it was recorded, the total
duration and the moving time. Stats that need missing data SHALL be left out, not shown as zero.

#### Scenario: A recorded hike
- **GIVEN** a GPX file recorded on a phone, with elevations and times
- **WHEN** the user opens its details
- **THEN** they show its distance, gain, loss, date, duration and a moving time shorter than the duration when the hiker stopped

#### Scenario: A planned route
- **GIVEN** a GPX file with a route drawn in a planning app, with no elevations or times
- **WHEN** the user opens its details
- **THEN** they show its distance and no gain, loss, date, duration or moving time

#### Scenario: Close to a known length
- **GIVEN** a GPX file whose recording app reported its length as 7.4 miles
- **WHEN** the user opens its details
- **THEN** the distance shown is within 3% of 7.4 miles

### Requirement: A track can be zoomed to
The list and the detail view SHALL each offer a way to go to an entry. Going to an entry that's off
SHALL turn it on.

#### Scenario: Zoom to an entry that's off
- **GIVEN** an unchecked entry
- **WHEN** the user chooses to zoom to it
- **THEN** it's checked, drawn, and fully in view beside the open sidebar

### Requirement: The original file can be downloaded
An entry's details SHALL offer to download its file. The download SHALL have the same contents as
the file that was opened, and its original file name.

#### Scenario: Download
- **GIVEN** an entry opened from `2026-10-12.gpx` and since renamed
- **WHEN** the user chooses to download it
- **THEN** the browser saves `2026-10-12.gpx` with the same contents as the original

### Requirement: A track can be deleted
An entry's details SHALL offer to delete it, and SHALL ask the user to confirm. Deleting SHALL
remove it from the library in every app, from the map, the layer list and the legend.

#### Scenario: Delete
- **GIVEN** a checked entry
- **WHEN** the user chooses to delete it and confirms
- **THEN** it leaves the list, the map, the layer list and the legend, and it isn't listed in other apps or after a reload

#### Scenario: Cancel
- **WHEN** the user chooses to delete an entry and then cancels
- **THEN** the entry and its details are unchanged

### Requirement: The panel works when the browser can't keep the library
When the browser can't keep the library, such as in some private windows or when its storage is
full, files the user opens SHALL still be shown for the rest of the visit, and a notice SHALL say
they won't be kept after the page is closed.

#### Scenario: Storage blocked
- **GIVEN** a browser that blocks site storage
- **WHEN** the user opens a GPX file
- **THEN** it's listed and drawn, a notice says it won't be kept, and nothing else fails

### Requirement: Removing the component cleans up
When the component is removed from the page, all of its layers SHALL be removed from the map, and
no file still being read SHALL change the map afterwards.

#### Scenario: Removed while a file is read
- **GIVEN** the user has just opened a large GPX file
- **WHEN** the component's element is removed from the page before the file is drawn
- **THEN** the "Tracks" group and every track are gone from the map and the layer list, and no error is reported
