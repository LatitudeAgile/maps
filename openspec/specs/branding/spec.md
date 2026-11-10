# branding Specification

## Purpose

Lets deployers brand the viewer: a floating title box that shows the app's name, a theme
color for the title box and the sidebar's icon bar, and light and dark mode, which follows the
system by default and can be forced per app.

## Requirements

### Requirement: The title box shows the app title
The viewer SHALL show `app.title` in a floating box in the top-left corner of the map, at every
viewport width, as soon as the map is created (P-27). The box SHALL have the same corner radius
as the sidebar's icon bar. Its accessible name SHALL be the full title. Map components placed
`top-left` SHALL appear below it, lined up with it.

#### Scenario: Custom title on a wide screen
- **GIVEN** a 1280×800 viewport
- **WHEN** the app starts with `app.title` "Corporate Maps"
- **THEN** a box reading "Corporate Maps" is shown at the top of the map, its left edge right of the sidebar's icon bar

#### Scenario: Title on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box is shown in the top-left corner of the map, clear of the bottom icon bar

#### Scenario: Top-left components sit below the title
- **WHEN** a `home` component is placed `top-left`
- **THEN** the Home button's top edge is below the title box's bottom edge, and their left edges are within 2 px

#### Scenario: Title shown before layers settle
- **GIVEN** a configured layer whose service never responds (request interception)
- **WHEN** the app starts
- **THEN** the title box is visible before any component is created

### Requirement: The title box keeps the floating bar's spacing
The title box SHALL sit as far from its surroundings as the floating icon bar sits from the
map's edges (8 px). On wide screens, its top edge SHALL be level with the bar's, and its left
edge SHALL be that distance right of the sidebar, open or collapsed. On phones, it SHALL be that
distance from the map's top and left edges.

#### Scenario: Spacing on a wide screen
- **GIVEN** a 1280×800 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box's top edge is within 1 px of the icon bar's, and the gap between the bar's right edge and the title box is within 1 px of the gap between the map's left edge and the bar

#### Scenario: Spacing on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box's top and left edges are each 8 px, within 1 px, from the map's top and left edges

### Requirement: Long titles fit on narrow screens
The title box SHALL show its title on one line. When the title is wider than the space
available, the box SHALL stay inside the map and cut the title off with an ellipsis. Its
accessible name SHALL still be the full title.

#### Scenario: Long title on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** `app.title` is "Department of Transportation Regional Operations Viewer"
- **THEN** the title box is one line high, its right edge is inside the map, and its accessible name is the full title

### Requirement: The title box can be hidden
`app.titleVisible` SHALL be `true` or `false` and SHALL default to `true`. When it is `false`,
the viewer SHALL show no title box. `app.title` SHALL still set the browser document title. Any
other value SHALL fail validation.

#### Scenario: Hidden
- **WHEN** `app.titleVisible` is `false`
- **THEN** no title box is shown, and the browser tab title is still `app.title`

#### Scenario: Wrong type
- **WHEN** `app.titleVisible` is `"no"`
- **THEN** validation fails with an error at `app.titleVisible` saying it must be `true` or `false`

### Requirement: Theme settings are validated
`app.theme` SHALL be an object with a required `color`, and an optional `opacity` and
`textColor` (P-28). `color` and `textColor` SHALL be hex colors (`#rgb` or `#rrggbb`).
`opacity` SHALL be a number from 0 to 1, and SHALL default to 1. The viewer SHALL report
invalid theme settings by path. It SHALL ignore any other key in `app.theme`, with one console
warning naming it.

#### Scenario: Valid theme
- **WHEN** `app.theme` is `{ "color": "#1f6f8b", "opacity": 0.85 }`
- **THEN** validation passes with no warning

#### Scenario: Color missing
- **WHEN** `app.theme` is `{ "opacity": 0.5 }`
- **THEN** validation fails with an error at `app.theme.color` saying a hex color is required

#### Scenario: Not a hex color
- **WHEN** `app.theme.color` is `"teal"`
- **THEN** validation fails with an error at `app.theme.color` saying a hex color such as `#1f6f8b` is expected

#### Scenario: Opacity out of range
- **WHEN** `app.theme.opacity` is `1.5`
- **THEN** validation fails with an error at `app.theme.opacity` saying a number from 0 to 1 is expected

#### Scenario: Unknown theme key
- **WHEN** `app.theme` has `"font": "Arial"` alongside a valid `color`
- **THEN** validation passes with one warning naming `app.theme.font`

### Requirement: The theme colors the icon bar and the title box
When `app.theme` is set, the sidebar's icon bar and the title box SHALL have `color` as their
background. While no panel is open, both SHALL be at `opacity`. While a panel is open, the icon
bar SHALL be `color` fully opaque, and the title box SHALL stay at `opacity`. The opacity SHALL
apply to the background only: icons and title text SHALL be drawn in the text color at full
opacity. This SHALL hold on wide screens and in the phone bottom bar. Open panels SHALL keep the
default panel colors.

#### Scenario: Themed on a wide screen
- **GIVEN** a 1280×800 viewport and `app.theme` `{ "color": "#1f6f8b", "opacity": 0.85, "textColor": "#ffffff" }`
- **WHEN** the app starts, and then the user opens the Legend panel
- **THEN** before the panel opens, the icon bar's computed background is `rgba(31, 111, 139, 0.85)`; with it open, the icon bar's is `rgb(31, 111, 139)` and the title box's is still `rgba(31, 111, 139, 0.85)`; the title text and the icons are `rgb(255, 255, 255)` with an opacity of 1, and the open panel's background is unchanged from an unthemed viewer

#### Scenario: Themed bottom bar on a phone
- **GIVEN** a 375×667 viewport and the same theme
- **WHEN** the app starts, and then the user opens the Legend panel
- **THEN** the bottom icon bar's computed background is `rgba(31, 111, 139, 0.85)` at first, and `rgb(31, 111, 139)` with the panel open

#### Scenario: Translucent again when the sidebar closes
- **GIVEN** a 1280×800 viewport, the same theme, and the Legend panel open
- **WHEN** the user presses Escape
- **THEN** the icon bar's computed background and edge color are `rgba(31, 111, 139, 0.85)` again

#### Scenario: No theme
- **WHEN** the config has no `app.theme`
- **THEN** the icon bar and the title box use the Calcite default foreground and text colors

### Requirement: The open panel's icon stands out on a themed bar
On a themed icon bar, the icon of the open panel SHALL have a background that differs from the
bar's, so the user can see which panel is open.

#### Scenario: Open panel marked
- **GIVEN** a theme with `color` `#1f6f8b`
- **WHEN** the user opens the Legend panel
- **THEN** the Legend icon's computed background differs from the bar's and from the other icons'

### Requirement: Text color defaults to the higher-contrast choice
When `app.theme` has no `textColor`, the viewer SHALL use white or black, whichever has the
higher WCAG contrast ratio against `color`.

#### Scenario: Dark color
- **WHEN** `app.theme.color` is `#1f6f8b` and `textColor` is absent
- **THEN** the resolved text color is `#ffffff`

#### Scenario: Light color
- **WHEN** `app.theme.color` is `#f5f5f5` and `textColor` is absent
- **THEN** the resolved text color is `#000000`

### Requirement: Low-contrast theme colors are warned about
When the WCAG contrast ratio between the text color and `color` is below 4.5:1, validation
SHALL pass with one warning at `app.theme.textColor` that gives the ratio. The ratio SHALL be
computed against `color` as an opaque color.

#### Scenario: White on light teal
- **WHEN** `app.theme` is `{ "color": "#3a9fc0", "textColor": "#ffffff" }`
- **THEN** validation passes with one warning at `app.theme.textColor` giving a ratio of 3.0:1

#### Scenario: Sufficient contrast
- **WHEN** `app.theme` is `{ "color": "#1f6f8b", "textColor": "#ffffff" }`
- **THEN** validation passes with no warning

### Requirement: The viewer follows the system's light or dark mode by default
When no choice is stored and `app.mode` is absent or `"auto"`, or the user's stored choice is
System, the viewer SHALL be shown in the system's light or dark mode. This SHALL apply to the
page background, the title box, the sidebar's icon bar and panels, notices, and map components.
When the system mode changes while the viewer is open, it SHALL switch to it without a reload.
The basemap SHALL NOT change with the mode.

#### Scenario: Dark system
- **GIVEN** the system is set to dark mode, no choice is stored, and the config has no `app.mode` and no `app.theme`
- **WHEN** the app starts
- **THEN** the page background is `rgb(33, 33, 33)`, the title box's background is `rgb(43, 43, 43)` and its text is `rgb(255, 255, 255)`, and the zoom buttons and an open Legend panel are drawn in Calcite's dark colors

#### Scenario: Light system
- **GIVEN** the system is set to light mode, no choice is stored, and the config has no `app.mode` and no `app.theme`
- **WHEN** the app starts
- **THEN** the page background is `rgb(247, 247, 247)`, the title box's background is `rgb(255, 255, 255)` and its text is `rgb(20, 20, 20)`

#### Scenario: System switches while the viewer is open
- **GIVEN** the system is set to light mode, no choice is stored, the app has started with no `app.mode`, and the Legend panel is open
- **WHEN** the system is switched to dark mode
- **THEN** without a reload, the title box, the icon bar, the open Legend panel and the zoom buttons are drawn in Calcite's dark colors, the panel stays open, and the basemap is unchanged

#### Scenario: Stored System choice overrides a forced app
- **GIVEN** the system is set to light mode, and the user's stored choice is System
- **WHEN** an app with `app.mode` `"dark"` starts
- **THEN** it is shown in light mode

### Requirement: `app.mode` sets the starting mode
`app.mode` SHALL be `"auto"`, `"light"` or `"dark"`, and SHALL default to `"auto"`. When no
choice is stored, `"light"` or `"dark"` SHALL show the viewer in that mode whatever the system
mode is, and it SHALL NOT change when the system mode changes. A stored choice SHALL take
precedence over `app.mode`. Any other value SHALL fail validation with an error at `app.mode`
that lists the allowed values.

#### Scenario: Dark on a light system
- **GIVEN** the system is set to light mode and no choice is stored
- **WHEN** the app starts with `app.mode` `"dark"`
- **THEN** the page background is `rgb(33, 33, 33)` and the title box's background is `rgb(43, 43, 43)`

#### Scenario: Light on a dark system
- **GIVEN** the system is set to dark mode and no choice is stored
- **WHEN** the app starts with `app.mode` `"light"`, and then the system is switched to light and back to dark
- **THEN** the page background is `rgb(247, 247, 247)` throughout

#### Scenario: Stored choice beats app.mode
- **GIVEN** the user's stored choice is Light
- **WHEN** an app with `app.mode` `"dark"` starts
- **THEN** it is shown in light mode

#### Scenario: Each app has its own mode
- **GIVEN** the system is set to light mode, no choice is stored, and the Apps panel lists an app whose config has `app.mode` `"dark"`
- **WHEN** the user opens that app from the Apps panel
- **THEN** the opened app is shown in dark mode

#### Scenario: Not an allowed value
- **WHEN** `app.mode` is `"night"`
- **THEN** validation fails with an error at `app.mode` saying it must be `"auto"`, `"light"` or `"dark"`

#### Scenario: Wrong type
- **WHEN** `app.mode` is `true`
- **THEN** validation fails with an error at `app.mode` saying it must be `"auto"`, `"light"` or `"dark"`

### Requirement: The page is in the chosen or system mode before the config loads
Before the config has loaded, the page SHALL be shown in the user's stored choice, or in the
system's mode when none is stored, including any notice shown because the config couldn't be
loaded or is invalid. When no choice is stored and `app.mode` forces a mode, the viewer SHALL
apply it before the title box, the icon bar and the map are shown.

#### Scenario: Config error on a dark system
- **GIVEN** the system is set to dark mode and no choice is stored
- **WHEN** the app starts with a config that fails validation
- **THEN** the page background is `rgb(33, 33, 33)` and the error notice is drawn in Calcite's dark colors

#### Scenario: Stored choice before the config loads
- **GIVEN** the system is set to light mode, the user's stored choice is Dark, and the config loads slowly
- **WHEN** the page loads
- **THEN** the page is never shown in light colors

#### Scenario: Forced mode before the first frame
- **GIVEN** the system is set to light mode and no choice is stored
- **WHEN** the app starts with `app.mode` `"dark"`
- **THEN** the title box and the icon bar are never shown in light colors

### Requirement: Theme colors are the same in both modes
When `app.theme` is set, the icon bar and the title box SHALL have the same background and text
colors in light and dark mode, and the open panel's icon SHALL be marked the same way. Open
panels SHALL use the current mode's panel colors.

#### Scenario: Themed in dark mode
- **GIVEN** a 1280×800 viewport, the system set to dark mode, and `app.theme` `{ "color": "#1f6f8b", "opacity": 0.85, "textColor": "#ffffff" }`
- **WHEN** the app starts, and then the user opens the Legend panel
- **THEN** before the panel opens, the icon bar's and the title box's computed backgrounds are `rgba(31, 111, 139, 0.85)`; with it open, the icon bar's is `rgb(31, 111, 139)`; the title text and icons are `rgb(255, 255, 255)`; and the open panel's background is Calcite's dark foreground, `rgb(43, 43, 43)`

### Requirement: The user's choice is remembered for the whole viewer site
The user's Appearance choice SHALL be stored in the browser for the viewer site: every app the
site serves SHALL be shown in it, after reloads and in new tabs, until the user changes or
forgets it. Two viewer deployments at different paths on one host SHALL keep separate choices.
A stored value the viewer doesn't recognize SHALL be ignored.

#### Scenario: Across apps and reloads
- **GIVEN** the catalog lists `default` and `parks`, neither sets `app.mode`, and the system is set to light mode
- **WHEN** the user selects Dark in the `default` app, opens `parks`, then reloads the page
- **THEN** `parks` is shown in dark mode, before and after the reload

#### Scenario: Unrecognized stored value
- **GIVEN** the stored choice has been edited by hand to `"sepia"`
- **WHEN** the page loads
- **THEN** the viewer is shown in the app's default mode, and the Appearance control shows that default

### Requirement: The page shows a grid behind the map
The whole page SHALL show a grid wherever nothing covers it: thin lines every 16 px and
stronger lines every 80 px, both 1 px wide, starting at the page's top-left corner. The
grid SHALL be drawn over the page background color, which is unchanged. It SHALL stay still
while the map pans. It SHALL show in the map area wherever the map draws nothing, and on the
page before the map appears.

#### Scenario: Grid on the config-error screen
- **GIVEN** the system is set to light mode and no choice is stored
- **WHEN** the app starts with a config that fails validation
- **THEN** away from the notice, the page has 1 px lines at every 16 px across and down from its top-left corner, and the lines at every 80 px are stronger than the others

#### Scenario: Grid behind the map before tiles load
- **GIVEN** basemap tile requests are blocked
- **WHEN** the app starts with the shipped config
- **THEN** the map area shows the grid, and the title box, the icon bar and the map components are drawn over it as usual

#### Scenario: Grid stays still while the map pans
- **GIVEN** basemap tile requests are blocked and the app has started
- **WHEN** the user drags the map
- **THEN** the grid lines stay where they were on the page

#### Scenario: Page background color is unchanged
- **GIVEN** the system is set to dark mode and no choice is stored
- **WHEN** the app starts with the shipped config
- **THEN** the page background color is `rgb(33, 33, 33)`, and between grid lines the page is drawn in that color

### Requirement: The grid follows the light or dark mode
In light mode the grid lines SHALL be darker than the page background, and in dark mode
lighter. The grid SHALL follow the mode the viewer is shown in, whether that comes from the
system, `app.mode` or the user's stored choice, and SHALL switch with it without a reload.
In both modes the lines SHALL stay faint: the 16 px lines differ from the background by less
than the 80 px lines do.

#### Scenario: Light mode grid
- **GIVEN** the system is set to light mode and no choice is stored
- **WHEN** the app starts with a config that fails validation
- **THEN** a point between grid lines is `rgb(247, 247, 247)`, a point on a 16 px line is darker, and a point on an 80 px line is darker still

#### Scenario: Dark mode grid
- **GIVEN** the system is set to dark mode and no choice is stored
- **WHEN** the app starts with a config that fails validation
- **THEN** a point between grid lines is `rgb(33, 33, 33)`, a point on a 16 px line is lighter, and a point on an 80 px line is lighter still

#### Scenario: Grid switches with the system
- **GIVEN** the system is set to light mode, no choice is stored, and basemap tile requests are blocked
- **WHEN** the app has started with no `app.mode` and the system is switched to dark mode
- **THEN** without a reload, the grid lines in the map area are lighter than the page background instead of darker

#### Scenario: Grid follows the Appearance setting
- **GIVEN** the system is set to light mode and basemap tile requests are blocked
- **WHEN** the user chooses Dark under Appearance in Settings
- **THEN** without a reload, the page background is `rgb(33, 33, 33)` and the grid lines are lighter than it
