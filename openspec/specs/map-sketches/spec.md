# map-sketches Specification

## Purpose

Lets users draw and write on the map from a Sketch panel, for example to mark streets, areas
and notes before printing, and keeps their sketches in the browser across reloads, separately
for each config.

## Requirements

### Requirement: Opening the Sketch panel turns drawing on
A `sketch` component SHALL show, in its sidebar panel, a docked sketch toolbar, a color strip,
and an Area fill control. While its panel is open, the user SHALL be able to draw new sketches
and select existing ones.

#### Scenario: Open the panel
- **GIVEN** the config has a `sketch` component in `panel`
- **WHEN** the user opens the Sketch panel
- **THEN** the panel shows the sketch toolbar, the color strip and Area fill, and the user can choose the polygon tool

### Requirement: Closing the Sketch panel ends drawing
Closing the Sketch panel, by its icon, its close button, Escape, or switching to another panel,
SHALL discard a sketch still being drawn, end any selection, and leave finished sketches on
the map.

#### Scenario: Close while drawing
- **GIVEN** the Sketch panel is open and the user has placed three corners of a polygon
- **WHEN** the user presses the panel's close button
- **THEN** the unfinished polygon is gone, no sketch is selected, and the sketches already finished are still on the map

#### Scenario: Switch panels with a sketch selected
- **GIVEN** the Sketch panel is open and a rectangle is selected, with its handles showing
- **WHEN** the user opens the Legend panel
- **THEN** the rectangle is no longer selected and no handles show

### Requirement: Selecting sketches needs the Sketch panel
Sketches SHALL be selectable and editable only while the Sketch panel is open. While it is
closed, clicking a sketch SHALL NOT select it or show editing handles.

#### Scenario: Click a sketch with the panel closed
- **GIVEN** a polygon is on the map and the Sketch panel is closed
- **WHEN** the user clicks the polygon
- **THEN** it isn't selected and no editing handles show

#### Scenario: Select again after reopening
- **GIVEN** a sketch was selected when the user closed the Sketch panel
- **WHEN** the user opens the panel again and clicks the sketch
- **THEN** the sketch is selected

### Requirement: Sketch tools
The toolbar SHALL offer point, line, polygon, rectangle, circle and text tools, with straight,
freehand and curved segments for lines and polygons. It SHALL offer selecting by click or
lasso, moving, reshaping, rotating and resizing, undo and redo, delete, duplicate, and a
settings menu with snapping to other sketches and drawing tooltips.

#### Scenario: Draw a line by hand
- **WHEN** the user chooses the line tool, then the freehand segment, and drags across the map
- **THEN** finishing it leaves a line in the chosen color along the dragged path

#### Scenario: Undo while drawing
- **WHEN** the user has placed three corners of a polygon and selects undo
- **THEN** the last corner is removed and the polygon is still being drawn

#### Scenario: Undo an edit
- **WHEN** the user selects a rectangle, moves it, and then selects undo
- **THEN** the rectangle is back where it was, and redo moves it again

#### Scenario: Delete a finished sketch
- **WHEN** the user selects a finished sketch and deletes it
- **THEN** the sketch is gone from the map

### Requirement: Notes
The text tool SHALL place a note where the user clicks and then ask for its text in a dialog
with Add and Cancel. Add SHALL need some text. Cancelling SHALL leave no note. While exactly
one note is selected, the panel SHALL offer Edit note, which opens the dialog with its text.

#### Scenario: Write a note
- **WHEN** the user chooses the text tool, clicks the map, types "Meet here" and selects Add
- **THEN** a note reading "Meet here" shows on the map where the user clicked

#### Scenario: Cancel a note
- **WHEN** the user places a note and cancels the dialog
- **THEN** no note is left on the map

#### Scenario: Edit a note
- **WHEN** the user selects a note, chooses Edit note, changes the text and selects Save
- **THEN** the note on the map shows the new text

### Requirement: Finishing a sketch ends its tool
Finishing a sketch SHALL end its drawing tool, as Escape does: the toolbar SHALL return to its
main tools with no drawing tool active, so the next click selects a sketch or opens a popup.

#### Scenario: Click after a polygon
- **WHEN** the user finishes a polygon and then clicks a feature of a configured layer
- **THEN** the feature's popup opens, and no new polygon is started

### Requirement: Clear selection
While any sketches are selected, the panel SHALL offer Clear selection, which deselects them as
Escape does. It SHALL NOT be shown while nothing is selected.

#### Scenario: Deselect a sketch
- **WHEN** the user selects a polygon and chooses Clear selection
- **THEN** the polygon is no longer selected, it stays on the map, and Clear selection is gone

### Requirement: Measurements while drawing
While the drawing tooltips are on, they SHALL show a segment's distance, a line's length and an
area's size as a sketch is drawn or edited, in feet and miles unless the `unit` option is
`metric`. Measurements SHALL NOT stay on the map or print.

#### Scenario: Imperial by default
- **WHEN** a `sketch` component has no `unit` option, tooltips are on, and the user draws a line
- **THEN** the tooltip shows the line's length in feet or miles, and no measurement is left on the map once the line is finished

#### Scenario: Metric
- **WHEN** a `sketch` component has `"options": { "unit": "metric" }` and the user draws a line with tooltips on
- **THEN** the tooltip shows the length in meters or kilometers

#### Scenario: Invalid unit
- **WHEN** a `sketch` component has `"options": { "unit": "feet" }`
- **THEN** validation fails with an error at `components[0].options.unit` that lists `imperial` and `metric`

### Requirement: Sketch colors
The color strip SHALL offer the colors in the `colors` option, a list of 1 to 12 `{ "name",
"color" }` entries with unique `#rrggbb` colors, defaulting to Red, Blue, Green, Orange and
Black. The first SHALL be chosen at first. New sketches SHALL use the chosen color, and
choosing a color SHALL recolor the selected sketches.

#### Scenario: Draw in another color
- **WHEN** the user chooses Blue and draws a polygon
- **THEN** the polygon is drawn in Blue

#### Scenario: Recolor a selected sketch
- **WHEN** a red line is selected and the user chooses Green
- **THEN** the line turns green, and other sketches keep their colors

#### Scenario: Colors from config
- **WHEN** a `sketch` component has `"options": { "colors": [{ "name": "Teal", "color": "#1f6f8b" }, { "name": "Gold", "color": "#c99700" }] }`
- **THEN** the strip shows Teal and Gold, with Teal chosen

#### Scenario: Invalid color
- **WHEN** a `sketch` component has `"options": { "colors": [{ "name": "Red", "color": "red" }] }`
- **THEN** validation fails with an error at `components[0].options.colors[0].color` saying a `#rrggbb` color is expected

#### Scenario: Duplicate color
- **WHEN** two entries in `colors` have the color `#d7263d`
- **THEN** validation fails with an error at `components[0].options.colors[1].color` saying colors must be unique

### Requirement: The chosen color is remembered
The chosen color SHALL be remembered in the browser across reloads. If the remembered color is
no longer on the strip, the first color SHALL be chosen.

#### Scenario: Reload
- **WHEN** the user chooses Green and reloads the page
- **THEN** Green is chosen

### Requirement: Adding colors
After the configured colors the strip SHALL offer Add a color, opening a color picker with Add
and Cancel. Adding SHALL put the color at the end of the strip and choose it, and SHALL be
refused for a color already on the strip. Up to six added colors SHALL be kept in the browser;
with six, Add a color SHALL be unavailable.

#### Scenario: Add a color
- **WHEN** the user opens Add a color, picks a magenta and selects Add
- **THEN** a magenta swatch follows the configured colors, chosen, and the next rectangle is drawn in magenta

#### Scenario: A color that's already there
- **WHEN** the picker shows a color already on the strip
- **THEN** it says so, and Add is unavailable

#### Scenario: Six added colors
- **WHEN** the user has added six colors
- **THEN** Add a color is unavailable, and its tooltip says to remove one first

### Requirement: Removing an added color
Each added color, unlike the configured ones, SHALL offer a remove button. Removing it SHALL
take it off the strip without changing sketches drawn in it. If it was the chosen color, the
first configured color SHALL be chosen.

#### Scenario: Remove an added color
- **WHEN** a magenta was added and chosen, a rectangle was drawn in it, and the user removes the magenta
- **THEN** the magenta is gone from the strip, the first color is chosen, and the rectangle stays magenta

### Requirement: Area fill opacity
The panel SHALL offer Area fill, showing the fill opacity new areas (polygons, rectangles,
circles) get. It SHALL open a slider from None (0%) to Solid (100%) in 5% steps, usable with
the arrow keys, with presets None, 25%, 50%, 75% and Solid. It SHALL start at the
`fillPercent` option (0 by default) and be remembered in the browser.

#### Scenario: Outlines at first
- **WHEN** a user who has never changed the fill draws a polygon, with no `fillPercent` option
- **THEN** Area fill reads 0%, the polygon shows only its edge, and clicking inside it with the panel open still selects it

#### Scenario: Draw a half-filled area
- **WHEN** the user opens Area fill, chooses 50% and draws a circle
- **THEN** the circle's fill is its color at 50% opacity

#### Scenario: Fill from config
- **WHEN** a `sketch` component has `"options": { "fillPercent": 25 }` and the user has never changed the fill
- **THEN** Area fill reads 25%

#### Scenario: Invalid fill
- **WHEN** a `sketch` component has `"options": { "fillPercent": 150 }`
- **THEN** validation fails with an error at `components[0].options.fillPercent` saying a whole number from 0 to 100 is expected

### Requirement: Area fill follows the selection
While any areas are selected, Area fill SHALL show their fill instead of new areas': the
selected area's, or "mixed" with the lowest and highest when they differ. Changing it SHALL
change the selected areas as the slider moves, and only areas, and SHALL also become the fill
of new areas.

#### Scenario: One area selected
- **WHEN** new areas get 0% and the user selects an area filled at 25%, then opens Area fill
- **THEN** it shows 25%, with the 25% preset marked

#### Scenario: Areas with different fills
- **WHEN** the user selects an area at 25% and one at 75%, then opens Area fill
- **THEN** it reads "mixed (25–75%)", no preset is marked, and choosing 50% sets both to 50%

#### Scenario: Recolor keeps the fill
- **WHEN** an area filled at 55% is selected and the user chooses another color
- **THEN** the area is in the new color, still at 55% fill

### Requirement: How sketches look
Areas SHALL be drawn with a solid edge in their color and the chosen fill opacity, which at 0%
SHALL be fully transparent rather than absent. Lines SHALL be solid in their color. Points
SHALL be large markers with a white outline. Notes SHALL be text in their color with a white
halo.

#### Scenario: Symbols
- **WHEN** symbols are made for Blue at 25% fill
- **THEN** the area's fill is Blue at 25% opacity with a Blue edge, the line is a solid Blue line, the point has a white outline, and the note has a white halo

#### Scenario: Note over imagery
- **WHEN** the basemap is `satellite` and the user writes a black note
- **THEN** the note is readable against the imagery because of its halo

### Requirement: Sketch popups
While the Sketch panel is closed, clicking a sketch SHALL open a popup for it before anything
under it: titled Note with the text for a note, otherwise Sketch with its color name and kind,
and an area's fill ("Blue area, 25% fill"). A color added by the user SHALL be described as a
custom color.

#### Scenario: Click an area with the panel closed
- **WHEN** the panel is closed and the user clicks a blue area filled at 25%
- **THEN** the popup is titled Sketch and reads "Blue area, 25% fill"

#### Scenario: Click a note with the panel closed
- **WHEN** the panel is closed and the user clicks a note
- **THEN** the popup is titled Note and shows the note's text

#### Scenario: Descriptions
- **WHEN** sketches are described: a red line, an unfilled green area, and a point in an added color
- **THEN** the descriptions are "Red line", "Green area, no fill" and "Point in a custom color"

### Requirement: Edit a sketch from its popup
A sketch's popup SHALL offer Edit sketch. Choosing it SHALL close the popup, open the Sketch
panel, and select that sketch.

#### Scenario: Edit from the popup
- **WHEN** the panel is closed, the user clicks a blue area filled at 25% and chooses Edit sketch
- **THEN** the popup closes, the Sketch panel is open with the area selected, and Area fill reads 25%

### Requirement: Popups wait while drawing
While a drawing tool is active, clicking the map SHALL draw and SHALL NOT open a popup. With no
drawing tool active, including while sketches are selected, clicking a feature SHALL open its
popup as usual. Selecting a sketch SHALL NOT also open the popup of what is under it.

#### Scenario: Draw over a feature
- **WHEN** the polygon tool is active and the user clicks a feature of a configured layer to place a corner
- **THEN** a corner is placed and no popup opens

#### Scenario: Select a sketch over a feature
- **WHEN** the panel is open, no drawing tool is active, and the user clicks a sketch lying over a feature
- **THEN** the sketch is selected and no popup opens

### Requirement: Sketches are kept in the browser for each config
Sketches SHALL be saved in the browser as soon as each is made, changed or deleted, and SHALL
come back on reload with the same geometry, colors, fill and text. Sketches made under one
app name (`?app=`, or `default` with no parameter) SHALL NOT show under another.

#### Scenario: Reload
- **WHEN** the user draws two polygons and a note and reloads the page
- **THEN** the two polygons and the note are on the map, in their colors, with the note's text

#### Scenario: Curved line after a reload
- **WHEN** the user draws a line with a curved segment and reloads
- **THEN** the line comes back with the same curve

#### Scenario: Another config
- **WHEN** the user draws a polygon under the default app and then opens the viewer with `?app=` naming another app that has a `sketch` component
- **THEN** that map shows no sketches, and the polygon is back when the default app is opened again

#### Scenario: Unreadable saved sketch
- **WHEN** the saved sketches hold one entry that can't be read and two that can
- **THEN** the two readable sketches are restored and no error stops the viewer

### Requirement: Saving sketches can fail
If sketches can't be saved in the browser, for example because its storage is full or blocked,
the Sketch panel SHALL say that the latest changes weren't saved, until a save works. The
sketches SHALL stay on the map until the page is closed.

#### Scenario: Storage full
- **GIVEN** the browser's storage refuses writes
- **WHEN** the user draws a polygon
- **THEN** the polygon stays on the map and the panel says the change wasn't saved

### Requirement: Clear all sketches
The panel SHALL offer Clear all, unavailable while there are no sketches. It SHALL ask the user
to confirm, saying the sketches can't be brought back, and on confirmation SHALL delete every
sketch from the map and from the browser for this config.

#### Scenario: Clear and confirm
- **WHEN** the user selects Clear all and confirms
- **THEN** every sketch is gone, and none come back after a reload

#### Scenario: Clear and cancel
- **WHEN** the user selects Clear all and cancels
- **THEN** every sketch stays

### Requirement: Hide sketches from the Layers list
The sketches SHALL be one layer titled Sketches, which a `layer-list` shows with a checkbox
that shows or hides all of them without deleting them. The layer SHALL be shown each time the
viewer starts, and opening the Sketch panel SHALL show it again if hidden.

#### Scenario: Hide and show
- **GIVEN** sketches are on the map and the config has a `layer-list` panel
- **WHEN** the user clears the Sketches checkbox, and then opens the Sketch panel
- **THEN** the sketches are hidden after the first step and shown again after the second

### Requirement: Sketches print with the map
Shown sketches SHALL be part of the map sent to the print service, with their symbols and note
text, so they print. Hidden sketches SHALL NOT be sent. A sketch that was selected SHALL be sent
without editing handles or selection outlines.

#### Scenario: Print a marked-up map
- **GIVEN** the config has `sketch` and `print` panels
- **WHEN** the user draws a red polygon and a note, opens the Print panel and exports
- **THEN** the web map sent to the print service holds the polygon and the note with their symbols and text

#### Scenario: Print while a sketch was selected
- **WHEN** a line is selected for reshaping and the user opens the Print panel and exports
- **THEN** the web map sent holds the line and no handle or selection graphics

#### Scenario: Hidden sketches don't print
- **WHEN** the Sketches checkbox is cleared and the user exports
- **THEN** the web map sent holds no sketches

#### Scenario: Printed output
- **WHEN** the user prints a layout with a filled area, a line and a note through the default print service
- **THEN** the printed file shows all three where they are on the map, with the note's text

### Requirement: Sketch data leaves the browser only to print
Drawing, editing, saving, restoring and clearing sketches SHALL make no network requests that
carry sketch data. Printing SHALL be the only time sketches, including note text, are sent,
and only to the print service.

#### Scenario: Network while sketching
- **WHEN** the user draws shapes and a note, reloads, and clears them, without printing
- **THEN** no request carries sketch geometry or note text
