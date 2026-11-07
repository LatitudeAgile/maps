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
those are absent. With no panel components, the viewer SHALL show no sidebar.

#### Scenario: Two panel components
- **WHEN** the config has a `legend` component and then a `home` component, both placed in `panel`, and the `legend` entry sets `"panel": { "heading": "Map key", "icon": "list" }`
- **THEN** the sidebar shows two icons in that order: the first labelled "Map key" with the `list` icon, the second labelled "Home" with the `home` icon (Playwright)

#### Scenario: No panel components
- **WHEN** every configured component is placed in a map corner
- **THEN** no sidebar is shown, and the map and its controls are laid out as before (Playwright)

### Requirement: Panel settings are validated
A component entry's `panel` setting SHALL be an object with an optional non-empty `heading`
string and an optional `icon` string. The viewer SHALL report invalid `panel` settings by path.
On an entry not placed in `panel`, it SHALL ignore `panel` with one console warning.

#### Scenario: Wrong type
- **WHEN** a panel component has `"panel": { "heading": 5 }`
- **THEN** validation fails with an error at `components[0].panel.heading` (Vitest)

#### Scenario: Panel settings on a corner component
- **WHEN** a component placed `top-right` has `"panel": { "heading": "Home" }`
- **THEN** the viewer starts, and one warning names `components[0].panel` as ignored (Vitest)

### Requirement: The sidebar starts collapsed
When the viewer starts, the sidebar SHALL show its icons with no panel open (P-20).

#### Scenario: Initial state
- **WHEN** the viewer starts with two panel components
- **THEN** both icons are shown, and no panel is open (Playwright)

### Requirement: Icons open, switch, and collapse panels
Activating a panel's icon SHALL open that panel, showing its heading and the component. While a
panel is open, activating a different icon SHALL switch to that panel, and activating the open
panel's icon SHALL collapse the sidebar (P-22).

#### Scenario: Open
- **WHEN** the user clicks the Legend icon
- **THEN** the Legend panel opens with its heading, and the legend lists the configured layers (Playwright)

#### Scenario: Switch
- **GIVEN** the Legend panel is open
- **WHEN** the user clicks the other panel's icon
- **THEN** that panel is open, and the Legend panel is not (Playwright)

#### Scenario: Collapse by icon
- **GIVEN** the Legend panel is open
- **WHEN** the user clicks the Legend icon again
- **THEN** no panel is open (Playwright)

### Requirement: The close button collapses the sidebar
Each open panel SHALL have a close button that collapses the sidebar (P-23).

#### Scenario: Close
- **GIVEN** the Legend panel is open
- **WHEN** the user presses the panel's close button
- **THEN** no panel is open, and the icons are still shown (Playwright)

### Requirement: Map navigation targets the visible area
The sidebar SHALL float over the map, and the map SHALL keep filling the window. The viewer
SHALL pad the map view by the area the sidebar covers, open or collapsed, so that the map's
center and zoom-to operations refer to the uncovered part of the map (P-05).

#### Scenario: Home with a panel open
- **GIVEN** a 1280×800 viewport, a `home` component in `top-right`, and the Legend panel open
- **WHEN** the user presses the Home button
- **THEN** the configured center is drawn within 10 px of the center of the map area to the right of the sidebar (Playwright)

#### Scenario: Map still fills the window
- **WHEN** the Legend panel is open at 1280×800
- **THEN** the map's bounding box still equals the viewport (Playwright)

### Requirement: Map controls and notices stay clear of the sidebar
Components in map corners on the sidebar's side, the zoom buttons, the attribution, and
in-page notices SHALL NOT be covered by the sidebar, whether it is open or collapsed (P-24).

#### Scenario: Zoom buttons move with the sidebar
- **WHEN** the Legend panel is opened and then closed at 1280×800
- **THEN** in both states the zoom buttons' left edge is to the right of the sidebar's right edge (Playwright)

#### Scenario: Notice beside an open panel
- **GIVEN** the viewer shows the layer-error notice, because a configured layer could not be loaded
- **WHEN** the Legend panel is open at 1280×800
- **THEN** the notice does not overlap the sidebar (Playwright, comparing bounding boxes; runs with or without an API key)

### Requirement: Sidebar width follows the screen width
From a viewport width of 768 px, the sidebar SHALL be on the starting side of the map. With a
panel open, it SHALL be 305 px wide from 768 px, 390 px from 992 px, and 460 px from 1200 px,
icons included (P-25).

#### Scenario: Widths at each breakpoint
- **WHEN** the Legend panel is open at viewport widths 800, 1000, and 1280 px
- **THEN** the sidebar is 305, 390, and 460 px wide respectively, within 2 px (Playwright)

### Requirement: Narrow screens use a bottom bar
Below a viewport width of 768 px, the sidebar's icons SHALL form a bar along the bottom of the
window. An open panel SHALL appear above the bar, spanning the window's width and leaving at
least the top 40% of the map uncovered. The document SHALL NOT scroll (P-25).

#### Scenario: Phone layout
- **WHEN** the viewport is 375×667 and the Legend panel is opened
- **THEN** the icons are in a bar along the bottom edge, the panel is directly above it and as wide as the window, its top edge is at least 267 px from the top, and the document does not scroll (Playwright)

#### Scenario: Bottom controls stay clear on a phone
- **WHEN** the viewport is 375×667 and a `home` component is placed `bottom-right`
- **THEN** the Home button is above the icon bar, not under it (Playwright)

### Requirement: The sidebar works from the keyboard and with screen readers
Each icon SHALL be reachable with Tab and activated with Enter or Space. Each icon SHALL have
its panel heading as its accessible name and SHALL expose whether its panel is open. Pressing
Escape while a panel is open SHALL collapse the sidebar and return focus to that panel's icon
(P-26).

#### Scenario: Keyboard only
- **WHEN** the user moves focus to the Legend icon with Tab and presses Enter, then presses Escape
- **THEN** the Legend panel opens on Enter, and on Escape it closes and focus is back on the Legend icon (Playwright)

#### Scenario: Name and state exposed
- **WHEN** the Legend panel is opened and then closed
- **THEN** the Legend icon's accessible name is its heading, and its expanded or pressed state is true while open and false after closing (Playwright, reading the accessibility tree)

#### Scenario: Screen reader
- **WHEN** a screen-reader user tabs to each icon, opens a panel, and closes it
- **THEN** each icon is announced by its heading with its open or closed state, and the panel's heading is announced on opening (named manual check with NVDA on Windows, recorded in the change notes)
