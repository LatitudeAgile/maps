# branding Specification

## Purpose

Lets deployers brand the viewer: a floating title box that shows the app's name, and a theme
color for the title box and the sidebar's icon bar.

## Requirements

### Requirement: The title box shows the app title
The viewer SHALL show `app.title` in a floating box in the top-left corner of the map, at every
viewport width, as soon as the map is created (P-27). The box SHALL have the same corner radius
as the sidebar's icon bar. Its accessible name SHALL be the full title. Map components placed
`top-left` SHALL appear below it, lined up with it.

#### Scenario: Custom title on a wide screen
- **GIVEN** a 1280×800 viewport
- **WHEN** the app starts with `app.title` "Corporate Maps"
- **THEN** a box reading "Corporate Maps" is shown at the top of the map, its left edge right of the sidebar's icon bar (Playwright)

#### Scenario: Title on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box is shown in the top-left corner of the map, clear of the bottom icon bar (Playwright)

#### Scenario: Top-left components sit below the title
- **WHEN** a `home` component is placed `top-left`
- **THEN** the Home button's top edge is below the title box's bottom edge, and their left edges are within 2 px (Playwright)

#### Scenario: Title shown before layers settle
- **GIVEN** a configured layer whose service never responds (request interception)
- **WHEN** the app starts
- **THEN** the title box is visible before any component is created (Playwright)

### Requirement: The title box keeps the floating bar's spacing
The title box SHALL sit as far from its surroundings as the floating icon bar sits from the
map's edges (8 px). On wide screens, its top edge SHALL be level with the bar's, and its left
edge SHALL be that distance right of the sidebar, open or collapsed. On phones, it SHALL be that
distance from the map's top and left edges.

#### Scenario: Spacing on a wide screen
- **GIVEN** a 1280×800 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box's top edge is within 1 px of the icon bar's, and the gap between the bar's right edge and the title box is within 1 px of the gap between the map's left edge and the bar (Playwright)

#### Scenario: Spacing on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** the app starts with the shipped default config
- **THEN** the title box's top and left edges are each 8 px, within 1 px, from the map's top and left edges (Playwright)

### Requirement: Long titles fit on narrow screens
The title box SHALL show its title on one line. When the title is wider than the space
available, the box SHALL stay inside the map and cut the title off with an ellipsis. Its
accessible name SHALL still be the full title.

#### Scenario: Long title on a phone
- **GIVEN** a 375×667 viewport
- **WHEN** `app.title` is "Department of Transportation Regional Operations Viewer"
- **THEN** the title box is one line high, its right edge is inside the map, and its accessible name is the full title (Playwright, reading the accessibility tree)

### Requirement: The title box can be hidden
`app.titleVisible` SHALL be `true` or `false` and SHALL default to `true`. When it is `false`,
the viewer SHALL show no title box. `app.title` SHALL still set the browser document title. Any
other value SHALL fail validation.

#### Scenario: Hidden
- **WHEN** `app.titleVisible` is `false`
- **THEN** no title box is shown, and the browser tab title is still `app.title` (Playwright)

#### Scenario: Wrong type
- **WHEN** `app.titleVisible` is `"no"`
- **THEN** validation fails with an error at `app.titleVisible` saying it must be `true` or `false` (Vitest)

### Requirement: Theme settings are validated
`app.theme` SHALL be an object with a required `color`, and an optional `opacity` and
`textColor` (P-28). `color` and `textColor` SHALL be hex colors (`#rgb` or `#rrggbb`).
`opacity` SHALL be a number from 0 to 1, and SHALL default to 1. The viewer SHALL report
invalid theme settings by path. It SHALL ignore any other key in `app.theme`, with one console
warning naming it.

#### Scenario: Valid theme
- **WHEN** `app.theme` is `{ "color": "#1f6f8b", "opacity": 0.85 }`
- **THEN** validation passes with no warning (Vitest)

#### Scenario: Color missing
- **WHEN** `app.theme` is `{ "opacity": 0.5 }`
- **THEN** validation fails with an error at `app.theme.color` saying a hex color is required (Vitest)

#### Scenario: Not a hex color
- **WHEN** `app.theme.color` is `"teal"`
- **THEN** validation fails with an error at `app.theme.color` saying a hex color such as `#1f6f8b` is expected (Vitest)

#### Scenario: Opacity out of range
- **WHEN** `app.theme.opacity` is `1.5`
- **THEN** validation fails with an error at `app.theme.opacity` saying a number from 0 to 1 is expected (Vitest)

#### Scenario: Unknown theme key
- **WHEN** `app.theme` has `"font": "Arial"` alongside a valid `color`
- **THEN** validation passes with one warning naming `app.theme.font` (Vitest)

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
- **THEN** before the panel opens, the icon bar's computed background is `rgba(31, 111, 139, 0.85)`; with it open, the icon bar's is `rgb(31, 111, 139)` and the title box's is still `rgba(31, 111, 139, 0.85)`; the title text and the icons are `rgb(255, 255, 255)` with an opacity of 1, and the open panel's background is unchanged from an unthemed viewer (Playwright, reading computed styles)

#### Scenario: Themed bottom bar on a phone
- **GIVEN** a 375×667 viewport and the same theme
- **WHEN** the app starts, and then the user opens the Legend panel
- **THEN** the bottom icon bar's computed background is `rgba(31, 111, 139, 0.85)` at first, and `rgb(31, 111, 139)` with the panel open (Playwright, reading computed styles)

#### Scenario: Translucent again when the sidebar closes
- **GIVEN** a 1280×800 viewport, the same theme, and the Legend panel open
- **WHEN** the user presses Escape
- **THEN** the icon bar's computed background and edge color are `rgba(31, 111, 139, 0.85)` again (Playwright, reading computed styles)

#### Scenario: No theme
- **WHEN** the config has no `app.theme`
- **THEN** the icon bar and the title box use the Calcite default foreground and text colors (Playwright, comparing computed styles with Calcite's `--calcite-color-foreground-1` and `--calcite-color-text-1`)

### Requirement: The open panel's icon stands out on a themed bar
On a themed icon bar, the icon of the open panel SHALL have a background that differs from the
bar's, so the user can see which panel is open.

#### Scenario: Open panel marked
- **GIVEN** a theme with `color` `#1f6f8b`
- **WHEN** the user opens the Legend panel
- **THEN** the Legend icon's computed background differs from the bar's and from the other icons' (Playwright, reading computed styles)

### Requirement: Text color defaults to the higher-contrast choice
When `app.theme` has no `textColor`, the viewer SHALL use white or black, whichever has the
higher WCAG contrast ratio against `color`.

#### Scenario: Dark color
- **WHEN** `app.theme.color` is `#1f6f8b` and `textColor` is absent
- **THEN** the resolved text color is `#ffffff` (Vitest)

#### Scenario: Light color
- **WHEN** `app.theme.color` is `#f5f5f5` and `textColor` is absent
- **THEN** the resolved text color is `#000000` (Vitest)

### Requirement: Low-contrast theme colors are warned about
When the WCAG contrast ratio between the text color and `color` is below 4.5:1, validation
SHALL pass with one warning at `app.theme.textColor` that gives the ratio. The ratio SHALL be
computed against `color` as an opaque color.

#### Scenario: White on light teal
- **WHEN** `app.theme` is `{ "color": "#3a9fc0", "textColor": "#ffffff" }`
- **THEN** validation passes with one warning at `app.theme.textColor` giving a ratio of 3.0:1 (Vitest)

#### Scenario: Sufficient contrast
- **WHEN** `app.theme` is `{ "color": "#1f6f8b", "textColor": "#ffffff" }`
- **THEN** validation passes with no warning (Vitest)
