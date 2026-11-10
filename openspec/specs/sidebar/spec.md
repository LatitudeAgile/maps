# sidebar Specification

## Purpose

Defines the viewer's collapsible sidebar of panel components: its icons and panels, how panels
open, switch, and close, how the map and its controls make room for it, its layout on wide and
narrow screens, and its keyboard and screen-reader access.

## Requirements

### Requirement: The sidebar lists panel components
When at least one component is placed in `panel`, the viewer SHALL show a sidebar with one icon
per panel component, in config order (P-20, P-21). Each icon SHALL show the entry's
`panel.icon` and be labelled with its `panel.heading`, or the component type's defaults when
those are absent. With no panel components, the sidebar SHALL hold only the Apps and settings
button (or the Settings button), and SHALL NOT be shown when that button isn't.

#### Scenario: Two panel components
- **WHEN** the config has a `legend` component and then a `home` component, both placed in `panel`, and the `legend` entry sets `"panel": { "heading": "Map key", "icon": "list" }`
- **THEN** the sidebar shows two icons in that order: the first labelled "Map key" with the `list` icon, the second labelled "Home" with the `home` icon

#### Scenario: No panel components
- **WHEN** every configured component is placed in a map corner, the deployment has no `apps/index.json`, and the config sets `"settingsVisible": false` in `app`
- **THEN** no sidebar is shown, and the map and its controls are laid out as before

#### Scenario: Only the Settings button
- **GIVEN** the deployment has no `apps/index.json`
- **WHEN** every component in the opened config is placed in a map corner
- **THEN** the sidebar shows the Settings button alone, and the title box, corner components and the map's center are clear of it from the first paint

#### Scenario: Only the Apps button
- **GIVEN** the catalog lists `viewer` and `parks`
- **WHEN** every component in the opened config is placed in a map corner
- **THEN** the sidebar shows the "Apps and settings" button alone, and the title box, corner components and the map's center are clear of it from the first paint

### Requirement: Panel settings are validated
A component entry's `panel` setting SHALL be an object with an optional non-empty `heading`
string and an optional `icon` string. The viewer SHALL report invalid `panel` settings by path.
On an entry not placed in `panel`, it SHALL ignore `panel` with one console warning.

#### Scenario: Wrong type
- **WHEN** a panel component has `"panel": { "heading": 5 }`
- **THEN** validation fails with an error at `components[0].panel.heading`

#### Scenario: Panel settings on a corner component
- **WHEN** a component placed `top-right` has `"panel": { "heading": "Home" }`
- **THEN** the viewer starts, and one warning names `components[0].panel` as ignored

### Requirement: The sidebar starts collapsed
When the viewer starts, the sidebar SHALL show its icons with no panel open (P-20).

#### Scenario: Initial state
- **WHEN** the viewer starts with two panel components
- **THEN** both icons are shown, and no panel is open

### Requirement: Icons open, switch, and collapse panels
Activating a panel's icon SHALL open that panel, showing its heading and the component. While a
panel is open, activating a different icon SHALL switch to that panel, and activating the open
panel's icon SHALL collapse the sidebar (P-22).

#### Scenario: Open
- **WHEN** the user clicks the Legend icon
- **THEN** the Legend panel opens with its heading, and the legend lists the configured layers

#### Scenario: Switch
- **GIVEN** the Legend panel is open
- **WHEN** the user clicks the other panel's icon
- **THEN** that panel is open, and the Legend panel is not

#### Scenario: Collapse by icon
- **GIVEN** the Legend panel is open
- **WHEN** the user clicks the Legend icon again
- **THEN** no panel is open

### Requirement: The close button collapses the sidebar
Each open panel SHALL have a close button that collapses the sidebar (P-23).

#### Scenario: Close
- **GIVEN** the Legend panel is open
- **WHEN** the user presses the panel's close button
- **THEN** no panel is open, and the icons are still shown

### Requirement: Map navigation targets the visible area
The sidebar SHALL float over the map, and the map SHALL keep filling the window. The viewer
SHALL pad the map view by the area the sidebar covers, open or collapsed, so that the map's
center and zoom-to operations refer to the uncovered part of the map (P-05).

#### Scenario: Home with a panel open
- **GIVEN** a 1280×800 viewport, a `home` component in `top-right`, and the Legend panel open
- **WHEN** the user presses the Home button
- **THEN** the configured center is drawn within 10 px of the center of the map area to the right of the sidebar

#### Scenario: Map still fills the window
- **WHEN** the Legend panel is open at 1280×800
- **THEN** the map's bounding box still equals the viewport

### Requirement: Map controls and notices stay clear of the sidebar
Components in map corners on the sidebar's side, the title box, the attribution, and in-page
notices SHALL NOT be covered by the sidebar, whether it is open or collapsed (P-24).

#### Scenario: Title box moves with the sidebar
- **WHEN** the Legend panel is opened and then closed at 1280×800
- **THEN** in both states the title box's left edge is to the right of the sidebar's right edge

#### Scenario: Zoom buttons move with the sidebar
- **GIVEN** a `zoom` component placed `top-left`
- **WHEN** the Legend panel is opened and then closed at 1280×800
- **THEN** in both states the zoom buttons' left edge is to the right of the sidebar's right edge

#### Scenario: Notice beside an open panel
- **GIVEN** the viewer shows the layer-error notice, because a configured layer could not be loaded
- **WHEN** the Legend panel is open at 1280×800
- **THEN** the notice does not overlap the sidebar

### Requirement: Sidebar width follows the screen width
From a viewport width of 768 px, the sidebar SHALL be on the starting side of the map. With a
panel open, it SHALL be 305 px wide from 768 px, 390 px from 992 px, and 460 px from 1200 px,
icons included (P-25).

#### Scenario: Widths at each breakpoint
- **WHEN** the Legend panel is open at viewport widths 800, 1000, and 1280 px
- **THEN** the sidebar is 305, 390, and 460 px wide respectively, within 2 px

### Requirement: Narrow screens use a bottom bar
Below a viewport width of 768 px, the sidebar's icons SHALL form a bar along the bottom of the
window. An open panel SHALL appear above the bar, spanning the window's width and leaving at
least the top 40% of the map uncovered. The document SHALL NOT scroll (P-25).

#### Scenario: Phone layout
- **WHEN** the viewport is 375×667 and the Legend panel is opened
- **THEN** the icons are in a bar along the bottom edge, the panel is directly above it and as wide as the window, its top edge is at least 267 px from the top, and the document does not scroll

#### Scenario: Bottom controls stay clear on a phone
- **WHEN** the viewport is 375×667 and the app starts with the shipped default config
- **THEN** the Home button, the Locate button and the zoom buttons in the bottom-right corner are all above the icon bar, not under it

### Requirement: The sidebar works from the keyboard and with screen readers
The icon bar SHALL be one Tab stop: Tab SHALL move focus into the bar and, from there, out of
it. Inside the bar, the arrow keys SHALL move focus from icon to icon, and Enter or Space SHALL
activate the focused icon. Each icon SHALL have its panel heading as its accessible name and
SHALL expose whether its panel is open. Pressing Escape while a panel is open SHALL collapse the
sidebar and return focus to that panel's icon (P-26).

#### Scenario: Keyboard only
- **GIVEN** a wide screen and two panel components, Home first and then Legend
- **WHEN** the user moves focus into the icon bar with Tab, moves to the Legend icon with the Down arrow, and presses Enter, then presses Escape
- **THEN** Tab first lands on the Home icon, the Legend panel opens on Enter, and on Escape it closes and focus is back on the Legend icon

#### Scenario: One Tab stop
- **GIVEN** focus is on an icon in the icon bar
- **WHEN** the user presses Tab
- **THEN** focus leaves the icon bar rather than moving to the next icon

#### Scenario: Name and state exposed
- **WHEN** the Legend panel is opened and then closed
- **THEN** the Legend icon's accessible name is its heading, and its expanded or pressed state is true while open and false after closing

#### Scenario: Screen reader
- **WHEN** a screen-reader user tabs into the icon bar, moves through the icons with the arrow keys, opens a panel, and closes it
- **THEN** each icon is announced by its heading with its open or closed state, and the panel's heading is announced on opening

### Requirement: The sidebar spans the full height on wide screens
From a viewport width of 768 px, the sidebar's icon bar and any open panel SHALL each span the
full height of the map, inside the sidebar's floating margins, however many icons the bar has
and however short the panel's content is. A panel whose content is taller SHALL scroll inside
the panel, and the document SHALL NOT scroll.

#### Scenario: Collapsed
- **WHEN** the viewport is 1280×800 and no panel is open
- **THEN** the icon bar's top and bottom edges are each within 16 px of the map's top and bottom edges

#### Scenario: Panel open
- **WHEN** the viewport is 1280×800 and the Legend panel is open
- **THEN** the icon bar's and the panel's top and bottom edges are each within 16 px of the map's top and bottom edges

#### Scenario: Short panel content
- **WHEN** the viewport is 1280×800 and the Search panel, whose content is one input, is open
- **THEN** the panel's bottom edge is within 16 px of the map's bottom edge

#### Scenario: Tall panel content
- **GIVEN** a 1280×600 viewport and a legend for enough layers that its content is taller than the panel
- **WHEN** the Legend panel is open
- **THEN** the panel's bottom edge is within 16 px of the map's bottom edge, the legend scrolls inside the panel, and the document does not scroll

#### Scenario: Few icons
- **WHEN** the viewport is 1280×800 and the config has a single panel component
- **THEN** the icon bar's top and bottom edges are each within 16 px of the map's top and bottom edges

#### Scenario: Resized across the breakpoint
- **WHEN** the viewport changes from 375×667 to 1280×800
- **THEN** the icon bar is vertical and spans the map's height as above, and an open panel does too

### Requirement: The floating sidebar has the title box's rounded corners
From a viewport width of 768 px, the sidebar's outer corners SHALL have the same radius as the
title box. With no panel open, all four corners of the icon bar SHALL be rounded. With a panel
open, the icon bar's two outer corners and the panel's two outer corners SHALL be rounded, and
the edges where the bar meets the panel SHALL stay square, so the two read as one block. Like
the title box, the icon bar SHALL have no border in a color other than its own background.

#### Scenario: Collapsed corners
- **WHEN** the viewport is 1280×800 and no panel is open
- **THEN** each of the icon bar's four corner radii equals the title box's

#### Scenario: No frame around the bar
- **WHEN** the viewport is 1280×800, with and without `app.theme`
- **THEN** every border of the icon bar, and the sidebar's edge beside it, is either 0 px wide or the same color as the bar's background

#### Scenario: Open corners
- **WHEN** the viewport is 1280×800 and the Legend panel is open
- **THEN** the icon bar's top-left and bottom-left radii and the panel's top-right and bottom-right radii equal the title box's, and the bar's right-hand and the panel's left-hand radii are 0

### Requirement: The phone bottom bar starts from the right
Below a viewport width of 768 px, the bottom bar SHALL start from the right edge: the first
panel component's icon SHALL be rightmost, nearest the thumb, and each later one SHALL be to the
left of the one before. The Left and Right arrow keys SHALL move focus in the direction they
point on screen. From 768 px, the icons SHALL be in config order from top to bottom again.

#### Scenario: Icons start from the right on a phone
- **WHEN** the viewport is 375×667 and the app starts with the shipped default config, built with an API key
- **THEN** the bar's icons are, from right to left, Search, Directions, Layers, Legend, Basemaps, Sketch, Print, all within the window, and the Search icon's right edge is within 16 px of the window's right edge (without an API key, the same order without Directions)

#### Scenario: Arrow keys follow the screen on a phone
- **GIVEN** a 375×667 viewport, the shipped default config built with an API key, and focus on the Search icon
- **WHEN** the user presses the Left arrow, and then the Right arrow
- **THEN** focus moves to the Directions icon, to Search's left, and then back to Search, and a Tab from there leaves the icon bar (without an API key, Layers instead of Directions)

#### Scenario: Back to the top-to-bottom order on a wide screen
- **WHEN** the viewport changes from 375×667 to 1280×800
- **THEN** the icons are, from top to bottom, in config order again

### Requirement: Panel components follow their panel
The sidebar SHALL tell each panel component when its panel opens and when it closes, however
it closes: by its icon, its close button, Escape, or switching panels. A panel component SHALL
be able to ask the sidebar to open its panel, which SHALL then behave as if its icon was
activated while closed.

#### Scenario: Told on open and close
- **GIVEN** a `hello-world` panel and a Legend panel, with the open and close events on the `hello-world` element being recorded
- **WHEN** the user opens the Hello panel, switches to Legend, opens Hello again and presses Escape
- **THEN** the element was told open, closed, open, closed, in that order

#### Scenario: Asking to open
- **GIVEN** a `hello-world` panel, and the Legend panel is open
- **WHEN** the open request is sent from the `hello-world` element
- **THEN** the Hello panel is open, the Legend panel is not, and the Hello icon shows as open

#### Scenario: Corner components aren't told
- **GIVEN** a `hello-world` component placed `top-right`, and no panel open
- **WHEN** the open request is sent from that element
- **THEN** no panel opens, and no error is reported

### Requirement: Popups open undocked and dock clear of the phone bottom bar
Map popups SHALL open undocked, beside the feature, at every viewport width. A popup the user
docks with its dock button SHALL dock at the top of the map below a viewport width of 768 px,
where the sidebar is a bar along the bottom, so that neither the icon bar nor an open panel
covers it; from 768 px it SHALL dock at the SDK's default position.

#### Scenario: Undocked on a phone
- **GIVEN** a 375×667 viewport and no panel open
- **WHEN** the user taps a feature
- **THEN** its popup opens undocked, and its bottom edge is above the icon bar's top edge

#### Scenario: Undocked on a wide screen
- **GIVEN** a 1280×800 viewport
- **WHEN** the user clicks a feature
- **THEN** its popup opens undocked

#### Scenario: Docked by the user on a phone
- **GIVEN** a 375×667 viewport, the Legend panel open, and a feature's popup open
- **WHEN** the user presses the popup's dock button
- **THEN** the popup is docked at the top, and its bottom edge is above the panel's top edge

#### Scenario: Docked by the user on a wide screen
- **WHEN** the viewport is 1280×800
- **THEN** the popup's dock position is the SDK's default, `auto`

### Requirement: Escape closes a panel's dialog or popover first
While a dialog or popover opened from a panel component is open, Escape SHALL close only that
dialog or popover. The panel SHALL stay open, and a further Escape SHALL close it as before.

#### Scenario: Escape in a popover
- **GIVEN** the Sketch panel is open with its Area fill popover open
- **WHEN** the user presses Escape, and then Escape again
- **THEN** the first Escape closes the popover and the panel stays open; the second closes the panel and returns focus to its icon

#### Scenario: Escape in a dialog
- **GIVEN** the Sketch panel is open and the note dialog is asking for a new note's text
- **WHEN** the user presses Escape
- **THEN** the dialog closes as Cancel does, no note is left, and the Sketch panel is still open

### Requirement: The sidebar is shown from startup
The viewer SHALL show the sidebar's icon bar, with every panel component's icon, as soon as the
map is created, without waiting for layers to settle or for panel components to be ready. From
then on, the title box, corner components, notices and the map's center SHALL be clear of the
sidebar as they are today, and SHALL NOT move when the panel components become ready.

#### Scenario: Icons before layers settle
- **GIVEN** a config with a Legend and a Search panel component and one layer from a host that doesn't answer, so layers take the full 15 s limit to settle
- **WHEN** the map appears
- **THEN** the icon bar shows two icons, Legend then Search, with their headings, and no panel is open

#### Scenario: Nothing moves when loading finishes
- **GIVEN** the same config at 1280×800, with a `zoom` component placed `top-left`
- **WHEN** the layers settle and the panel components become ready
- **THEN** the title box, the zoom buttons and the map's center stay where they were when the map appeared

#### Scenario: Phone bottom bar from startup
- **GIVEN** the same config at 375×667, with a `home` component placed `bottom-right`
- **WHEN** the map appears, and later the panel components become ready
- **THEN** the bottom bar is shown from the start, and the Home button is above it and doesn't move

#### Scenario: No panel components
- **WHEN** every configured component is placed in a map corner
- **THEN** no sidebar is shown at any point during startup

### Requirement: A panel opened before its component is ready shows that it is loading
Activating an icon before its component is ready SHALL open its panel, with its heading, its
close button and a loading indicator in place of the component. When the component is ready, it
SHALL replace the indicator, whether the panel is open or not. A component that arrives in an
open panel SHALL be told its panel is open. Switching, closing and Escape SHALL work as for a
ready panel.

#### Scenario: Open while loading
- **GIVEN** the slow-layer config, before the layers settle
- **WHEN** the user clicks the Legend icon
- **THEN** the Legend panel opens with its heading, its close button and a loading indicator, and the icon shows as open

#### Scenario: Component arrives in an open panel
- **GIVEN** the slow-layer config with a Sketch panel component, and the Sketch panel opened before the layers settle
- **WHEN** the layers settle and the Sketch component becomes ready
- **THEN** the loading indicator is replaced by the Sketch panel's content, and drawing is on, as when the panel is opened after loading

#### Scenario: Closed while loading
- **GIVEN** the Legend panel was opened while loading and then closed with its close button
- **WHEN** the legend becomes ready and the user opens the Legend panel again
- **THEN** the panel shows the legend with no loading indicator

#### Scenario: Escape while loading
- **GIVEN** the Legend panel is open and still loading
- **WHEN** the user presses Escape
- **THEN** the panel closes and focus is on the Legend icon

### Requirement: A panel whose component failed says so
When a panel component can't be loaded or set up, or startup stops before panel components are
created, its icon SHALL stay in the bar and its panel SHALL show a notice that the panel couldn't
be loaded, in place of the loading indicator. The failure SHALL still be reported on the error
channel. Other panels SHALL be unaffected.

#### Scenario: Component can't be loaded
- **GIVEN** the legend component's code is blocked from loading, with `debug` set to `true`
- **WHEN** the viewer has started and the user opens the Legend panel
- **THEN** the Legend icon is still in the bar, in its config position; the panel shows a notice that it couldn't be loaded; the console logs the error report; and the other panels open and work

#### Scenario: Fails while open
- **GIVEN** the legend component's code is blocked from loading and the layers are slow to settle, and the user opened the Legend panel while it was loading
- **WHEN** the component stage runs
- **THEN** the loading indicator is replaced by the notice, and the panel stays open

#### Scenario: Bar stays the same size
- **GIVEN** the legend component's code is blocked from loading, at 375×667 and at 1280×800
- **WHEN** the component stage finishes
- **THEN** the icon bar has as many icons as when the map appeared, and no icon moves
