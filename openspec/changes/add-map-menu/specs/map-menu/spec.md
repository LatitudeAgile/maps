# Spec Delta

## Purpose

Defines the map menu: a menu of actions for one spot on the map, opened by right-click, long
press or keyboard. Covers how it opens and closes, the built-in, Directions and link items, the
`mapMenu` setting, and how components and extensions add items to it.

## ADDED Requirements

### Requirement: Right-clicking the map opens the menu at that spot
A right-click on the map SHALL open the map menu next to the pointer, in 2D and 3D, with the
actions for the spot that was clicked. The browser's own context menu SHALL NOT appear over the
map while the menu is turned on.

#### Scenario: Right-click in 2D
- **GIVEN** the default app
- **WHEN** the user right-clicks the map
- **THEN** the map menu opens next to the pointer, listing What's here?, Copy coordinates and Center here, and the browser's context menu doesn't appear

#### Scenario: Right-click in 3D
- **GIVEN** the city-scene app
- **WHEN** the user right-clicks a building or the ground
- **THEN** the map menu opens next to the pointer, and Copy coordinates copies the latitude and longitude of the spot under the pointer

### Requirement: Dragging the map doesn't open the menu
The menu SHALL open only on a click. A right-drag that pans, rotates or tilts the map SHALL NOT
open it when the button is released, in 2D or 3D.

#### Scenario: Rotate a scene with the right button
- **GIVEN** the city-scene app
- **WHEN** the user holds the right button, drags to rotate the camera, and releases
- **THEN** the camera rotates, and neither the map menu nor the browser's context menu opens

### Requirement: A long press opens the menu on touch
On a touch screen, pressing and holding the map SHALL open the menu at the spot pressed. Moving
the finger before the hold completes SHALL pan the map, not open the menu.

#### Scenario: Long press on a phone
- **GIVEN** the default app on a phone
- **WHEN** the user presses and holds a spot on the map without moving
- **THEN** the map menu opens at that spot

### Requirement: The menu can be used from the keyboard
With focus on the map, the ContextMenu key or Shift+F10 SHALL open the menu for the map's
center, with focus on its first item. Arrow keys SHALL move between items, Enter SHALL pick
one, and Escape SHALL close the menu and return focus to the map.

#### Scenario: Open and pick from the keyboard
- **GIVEN** the default app with focus on the map
- **WHEN** the user presses Shift+F10, presses the down arrow once and presses Enter
- **THEN** the second item, Copy coordinates, runs for the map's center

#### Scenario: Escape returns to the map
- **GIVEN** the menu was opened from the keyboard
- **WHEN** the user presses Escape
- **THEN** the menu closes and focus is on the map

### Requirement: The menu closes when it is done or left
The menu SHALL close when an item is picked, on Escape, on a click outside it, or when the map
moves. Only one menu SHALL be open at a time: a second right-click SHALL close the first menu
and open one for the new spot.

#### Scenario: Click elsewhere
- **GIVEN** the map menu is open
- **WHEN** the user clicks the map outside the menu
- **THEN** the menu closes and no item runs

#### Scenario: Right-click again
- **GIVEN** the map menu is open for one spot
- **WHEN** the user right-clicks another spot
- **THEN** one menu is open, for the new spot

### Requirement: No menu opens where the map has no ground
In 3D, a right-click on the sky, where there is no spot on the ground, SHALL NOT open the menu.
The browser's context menu SHALL NOT appear there either.

#### Scenario: Right-click the sky
- **GIVEN** the city-scene app tilted so the sky shows
- **WHEN** the user right-clicks the sky
- **THEN** no menu opens

### Requirement: The menu is left to a drawing tool while it draws
While Sketch or Measure is drawing on the map, a right-click SHALL NOT open the menu, so the
tool's own handling of the click is kept. Once drawing ends, a right-click SHALL open the menu
again.

#### Scenario: Right-click while sketching
- **GIVEN** the user has started drawing a polygon in the Sketch panel
- **WHEN** the user right-clicks the map
- **THEN** the map menu doesn't open

### Requirement: The menu stays on the map and follows the color mode
The menu SHALL be built from Calcite components and SHALL follow the app's color mode. It SHALL
stay inside the map, flipping beside the pointer near an edge, and SHALL NOT be covered by the
sidebar or its bar on a phone.

#### Scenario: Near the bottom-right corner
- **WHEN** the user right-clicks the map just above its bottom-right corner
- **THEN** the whole menu is visible inside the map, to the left of and above the pointer

#### Scenario: Dark mode
- **GIVEN** the app is in dark mode
- **WHEN** the user opens the map menu
- **THEN** the menu uses the dark Calcite colors

### Requirement: Items are listed in groups
The menu SHALL list items in groups, with no submenus. Without a `mapMenu` setting, the first,
unlabeled group SHALL hold What's here?, Copy coordinates and Center here, in that order. Each
component that adds items SHALL follow, in component order, as a group headed by that
component's heading.

#### Scenario: Default groups with Directions
- **GIVEN** the default app, built with a key that has the Routing privilege
- **WHEN** the user right-clicks the map
- **THEN** the menu shows the built-in group, then a group headed "Directions" with Directions from here, Directions to here and Add stop here

### Requirement: What's here? shows the nearest address
"What's here?" SHALL find the address or place nearest the spot with a geocoding service, by
default the keyless World Geocoding Service, and SHALL show it in a popup at the spot. When the
service finds nothing, the popup SHALL say no address was found. When the request fails, a
closable notice SHALL say so.

#### Scenario: Address found
- **WHEN** the user right-clicks a street in Redlands, California, and picks What's here?
- **THEN** a popup opens at the spot, showing the nearest address in Redlands, CA

#### Scenario: Nothing found
- **WHEN** the user right-clicks the middle of the Pacific Ocean and picks What's here?
- **THEN** a popup opens at the spot, saying no address was found here

#### Scenario: Service fails
- **GIVEN** requests to the geocoding service are blocked
- **WHEN** the user picks What's here?
- **THEN** a closable notice says the address couldn't be found, and the map keeps working

#### Scenario: Works without a key
- **GIVEN** the app was built without an API key
- **WHEN** the user picks What's here? on a street in Redlands, California
- **THEN** a popup shows the nearest address

### Requirement: What's here? can use another geocoding service
A `whats-here` entry in `mapMenu` SHALL accept a `url` option, an absolute https URL of a
GeocodeServer, used instead of the World Geocoding Service. No key SHALL be sent to it. Any
other `url` SHALL fail validation.

#### Scenario: Own geocoder
- **GIVEN** `"mapMenu": [{ "id": "whats-here", "url": "https://gis.example.com/arcgis/rest/services/Locator/GeocodeServer" }]`
- **WHEN** the user picks What's here?
- **THEN** the request goes to that GeocodeServer, with no token

#### Scenario: Not https
- **WHEN** a `whats-here` entry has `"url": "http://gis.example.com/GeocodeServer"`
- **THEN** validation fails with an error at `mapMenu[0].url` saying it must be an absolute https URL

### Requirement: Copy coordinates copies latitude and longitude
"Copy coordinates" SHALL copy the spot's latitude and longitude to the clipboard as decimal
degrees with six decimal places, latitude first, separated by a comma and a space. A closable
notice SHALL show what was copied. When the clipboard can't be written, the notice SHALL say so
and show the coordinates.

#### Scenario: Copy in decimal degrees
- **GIVEN** the default app, opened at its starting view centered on longitude -98.579404, latitude 39.828127
- **WHEN** the user focuses the map, presses Shift+F10 and picks Copy coordinates
- **THEN** the clipboard holds "39.828127, -98.579404" and a notice shows that text

#### Scenario: Clipboard refused
- **GIVEN** the browser refuses clipboard access
- **WHEN** the user picks Copy coordinates
- **THEN** a notice says the coordinates couldn't be copied and shows them

### Requirement: Copy coordinates can use another format
A `copy-coordinates` entry in `mapMenu` SHALL accept a `format` option: `dd` (the default),
`ddm`, `dms`, `mgrs`, `usng` or `utm`. The item SHALL copy the spot in that format. Any other
value SHALL fail validation with an error that lists the formats.

#### Scenario: MGRS
- **GIVEN** `"mapMenu": [{ "id": "copy-coordinates", "format": "mgrs" }]`
- **WHEN** the user right-clicks a spot and picks Copy coordinates
- **THEN** the clipboard holds the spot's MGRS grid reference, and the notice shows it

#### Scenario: Degrees, minutes and seconds
- **GIVEN** a `copy-coordinates` entry with `"format": "dms"`
- **WHEN** the map is centered on latitude 39.828127, longitude -98.579404, and the user opens the menu with Shift+F10 and picks Copy coordinates
- **THEN** the clipboard holds those coordinates in degrees, minutes and seconds, with N and W

#### Scenario: Unknown format
- **WHEN** a `copy-coordinates` entry has `"format": "wgs"`
- **THEN** validation fails with an error at `mapMenu[0].format` that lists the supported formats

### Requirement: Center here centers the map on the spot
"Center here" SHALL move the map so the spot is at its center, keeping the scale, and in 3D the
camera's tilt and heading.

#### Scenario: Center in 2D
- **WHEN** the user right-clicks near the map's edge and picks Center here
- **THEN** the map pans so that spot is at its center, at the same scale

### Requirement: Directions items set stops from the map
A `directions` component SHALL add "Directions from here", "Directions to here" and "Add stop
here". Each SHALL open the Directions panel and set a stop at the spot: the first stop, the last
stop, or a stop before the last. When the route then has a start and an end, it SHALL be solved.

#### Scenario: From here, then to here
- **GIVEN** the default app, built with a key that has the Routing privilege, with no stops set
- **WHEN** the user picks Directions from here at one spot in Denver, then Directions to here at another
- **THEN** the Directions panel is open, it lists the two stops, and the route between them is drawn

#### Scenario: Replace the start
- **GIVEN** a solved route from A to B
- **WHEN** the user picks Directions from here at spot C
- **THEN** the route is solved again from C to B

#### Scenario: Add a stop
- **GIVEN** a solved route from A to B
- **WHEN** the user picks Add stop here at spot C
- **THEN** the route is solved again from A through C to B

### Requirement: Add stop here appears only on a route
"Add stop here" SHALL be listed only when the route has a start and an end. "Directions from
here" and "Directions to here" SHALL always be listed while the `directions` component is in the
app.

#### Scenario: No route yet
- **GIVEN** the Directions panel has no stops
- **WHEN** the user right-clicks the map
- **THEN** the Directions group lists Directions from here and Directions to here, and not Add stop here

### Requirement: Directions items need the Directions component
Without a `directions` component, or when it is left out, such as for lack of a key, the menu
SHALL show no Directions items.

#### Scenario: Built without a key
- **GIVEN** the default app built without an API key, so the Directions panel is left out
- **WHEN** the user right-clicks the map
- **THEN** the menu has no Directions group

### Requirement: Link items open a page for the spot
A `mapMenu` entry with `label` and `url` SHALL be a link item. Picking it SHALL open the URL in a
new tab, with `{lat}` and `{lon}` replaced by the spot's latitude and longitude in decimal
degrees with six decimal places. An optional `icon` SHALL name a Calcite icon, `launch` by
default.

#### Scenario: Street View
- **GIVEN** `"mapMenu": ["whats-here", { "id": "street-view", "label": "Street View", "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}" }]`
- **WHEN** the map is centered on latitude 39.828127, longitude -98.579404, and the user presses Shift+F10 on the map and picks Street View
- **THEN** a new tab opens `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=39.828127,-98.579404`

### Requirement: Link items are checked
A link item SHALL have an `id`, a non-empty `label`, and a `url` that is an absolute https URL
once its placeholders are filled in. Its `id` SHALL NOT be a built-in item's or a component's.
A link item that breaks a rule SHALL fail validation with an error at its path.

#### Scenario: No label
- **WHEN** `mapMenu[1]` is `{ "id": "w3w", "url": "https://what3words.com/{lat},{lon}" }`
- **THEN** validation fails with an error at `mapMenu[1].label` saying a label is required

#### Scenario: Not https
- **WHEN** a link item's `url` is `"http://example.com/?ll={lat},{lon}"`
- **THEN** validation fails with an error at its `url` saying it must be an absolute https URL

### Requirement: The mapMenu setting chooses the entries and their order
A `mapMenu` list SHALL replace the default contents. Each entry SHALL be a built-in item's id
(`whats-here`, `copy-coordinates`, `center-here`), a component's id, standing for all of that
component's items, or a link item. The menu SHALL show them in list order. Each component
entry SHALL be its own group; other entries next to each other SHALL form an unlabeled group.

#### Scenario: Chosen order
- **GIVEN** `"mapMenu": ["copy-coordinates", "directions"]` in an app with a working `directions` component
- **WHEN** the user right-clicks the map
- **THEN** the menu shows Copy coordinates, then the Directions group, and no other items

#### Scenario: Built-in item as a string or an object
- **WHEN** `mapMenu` holds `"center-here"` or `{ "id": "center-here" }`
- **THEN** validation passes, and both give the same item

### Requirement: Unknown and missing mapMenu entries are skipped
An entry whose id is neither a built-in item, a component in the config, nor a link item SHALL be
skipped with one console warning naming it. An entry naming a component that was left out, or
that adds no items, SHALL be skipped without a warning. The same id twice SHALL fail validation.

#### Scenario: Typo
- **WHEN** `mapMenu` is `["copy-cordinates", "center-here"]`
- **THEN** the viewer starts, logs one warning naming `copy-cordinates`, and the menu shows only Center here

#### Scenario: Left-out component
- **GIVEN** `mapMenu` lists `directions`, and the app is built without a key so the Directions panel is left out
- **WHEN** the user right-clicks the map
- **THEN** the menu shows the other entries and no warning is logged

#### Scenario: Duplicate
- **WHEN** `mapMenu` is `["center-here", "center-here"]`
- **THEN** validation fails with an error at `mapMenu[1]` saying `center-here` is listed twice

### Requirement: The menu can be turned off
`"mapMenu": false` SHALL turn the menu off: right-click, long press and the keyboard shortcut
SHALL NOT open it, and the browser's own context menu SHALL appear on right-click. `mapMenu`
SHALL be `false` or a non-empty list; anything else, including `true` and `[]`, SHALL fail
validation.

#### Scenario: Turned off
- **GIVEN** `"mapMenu": false`
- **WHEN** the user right-clicks the map
- **THEN** the browser's context menu appears and no map menu opens

#### Scenario: Empty list
- **WHEN** `mapMenu` is `[]`
- **THEN** validation fails with an error at `mapMenu` saying it must be `false` or a non-empty list

### Requirement: Components and extensions add their own items
A component, built-in or from an extension, SHALL be able to add items to the menu. Its items
SHALL appear in its group with the labels and Calcite icons it gives. An item the component says
doesn't apply to the spot SHALL NOT be listed. When a component's element leaves the page, its
items SHALL no longer appear.

#### Scenario: Extension item
- **GIVEN** an app with a `hello-world` component in a sidebar panel
- **WHEN** the user right-clicks the map
- **THEN** the menu has a group headed with that component's heading, holding its item

#### Scenario: Element removed
- **GIVEN** a component that adds an item, whose element is then removed from the page
- **WHEN** the user right-clicks the map
- **THEN** that item isn't listed, and no error is logged

### Requirement: A failing item doesn't break the menu
When an item's action fails, the menu SHALL close, a closable notice SHALL name the item, and the
map and the menu SHALL keep working.

#### Scenario: Item throws
- **GIVEN** an extension item whose action throws an error
- **WHEN** the user picks it
- **THEN** a notice names the item, and the next right-click opens the menu as usual
