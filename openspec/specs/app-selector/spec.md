# app-selector Specification

## Purpose

Lets one deployment offer several configs as apps, and lets users browse them in an Apps and
settings panel in the sidebar and switch from one to another. The same panel holds the Settings
section, where users choose the viewer's appearance; with no other apps it is a Settings panel.

## Requirements

### Requirement: The app catalog lists apps by app name
The viewer SHALL read an optional app catalog from `apps/index.json`, resolved against the
app's base URL. The catalog SHALL be an object whose `apps` setting is a list of app names,
in the order the apps are offered. Each name SHALL follow the `?app=` name rule. The viewer
SHALL skip an invalid or repeated name with one console warning naming it, and SHALL keep the
others.

#### Scenario: Catalog order
- **WHEN** `apps/index.json` is `{ "apps": ["default", "parks", "county"] }` and the Apps panel is opened
- **THEN** the panel lists the three apps in that order

#### Scenario: Invalid and repeated names
- **WHEN** the catalog is `{ "apps": ["default", "../secrets", "parks", "parks"] }`
- **THEN** the panel lists default and parks once each, no request is made for `../secrets`, and the console shows one warning naming `../secrets` and one naming the repeated `parks`

### Requirement: A missing or unreadable catalog changes nothing else
When `apps/index.json` returns HTTP 404, the viewer SHALL show no apps list and log nothing.
When the catalog can't be fetched for another reason, isn't valid JSON, or has no `apps` list,
the viewer SHALL show no apps list and log one console warning that names the catalog URL and
the reason. In every case the viewer SHALL start as it does without a catalog, with the
Settings button when settings are shown.

#### Scenario: No catalog
- **WHEN** the deployment has no `apps/index.json`
- **THEN** the viewer starts normally with the Settings button, no apps list, and no console warning about the catalog

#### Scenario: Malformed catalog
- **WHEN** `apps/index.json` contains a trailing comma
- **THEN** the viewer starts normally with the Settings button and no apps list, and the console shows one warning naming the catalog URL and saying it is not valid JSON

### Requirement: The Apps and settings button is shown in every app
The sidebar's icon bar SHALL show one button after every panel component's icon: at the bottom
of the bar on wide screens and at the left end of the phone bottom bar. When the apps list is
shown, the button SHALL have the `apps` icon and be labelled "Apps and settings", or "Apps" when
settings are hidden. When only settings are shown, it SHALL have the `gear` icon and be labelled
"Settings". The button SHALL be in place from the first paint of the bar.

#### Scenario: Apps button on a wide screen
- **GIVEN** the catalog lists `default` and `parks`, and the `default` app has three panel components
- **WHEN** the page is opened at 1280×800
- **THEN** the icon bar shows the three panel icons, then a button with the `apps` icon labelled "Apps and settings" at the bottom of the bar

#### Scenario: Apps button on a phone
- **WHEN** the same page is opened at 375×667
- **THEN** the "Apps and settings" button is at the left end of the bottom bar, and the first panel icon is still rightmost

#### Scenario: Only the current app listed
- **WHEN** the catalog is `{ "apps": ["default"] }` and the `default` app is opened
- **THEN** the button has the `gear` icon and is labelled "Settings"

#### Scenario: No catalog
- **WHEN** the deployment has no `apps/index.json`
- **THEN** the button has the `gear` icon and is labelled "Settings"

#### Scenario: Current app not in the catalog
- **WHEN** the catalog lists `default` and `parks`, and the page is opened with `?app=kiosk`
- **THEN** the "Apps and settings" button is shown, and the panel lists default and parks, neither marked current

### Requirement: An app can hide the apps list or the settings
`app.selectorVisible` and `app.settingsVisible` SHALL each be `true` or `false`, and SHALL
default to `true`. `app.selectorVisible: false` SHALL hide the apps list in that app.
`app.settingsVisible: false` SHALL hide the Settings section. With neither the apps list nor the
Settings section shown, the viewer SHALL show no button. Any other value SHALL fail validation
with an error at the setting's path.

#### Scenario: Button hidden
- **GIVEN** the catalog lists `default` and `parks`
- **WHEN** the `parks` config sets `"selectorVisible": false` in `app` and is opened
- **THEN** the button has the `gear` icon, is labelled "Settings", and its panel has no apps list

#### Scenario: Settings hidden
- **GIVEN** the catalog lists `default` and `parks`
- **WHEN** the `parks` config sets `"settingsVisible": false` in `app` and is opened
- **THEN** the button has the `apps` icon, is labelled "Apps", and its panel has the apps list and no Settings section

#### Scenario: Both hidden
- **WHEN** a config sets `"selectorVisible": false` and `"settingsVisible": false` in `app`
- **THEN** no button is shown after the panel icons

#### Scenario: Settings hidden with no other apps
- **GIVEN** the deployment has no `apps/index.json`
- **WHEN** the config sets `"settingsVisible": false` in `app`
- **THEN** no button is shown after the panel icons

#### Scenario: Wrong type
- **WHEN** the config has `"app": { "selectorVisible": "no" }`
- **THEN** validation fails with an error at `app.selectorVisible` saying it must be `true` or `false`

#### Scenario: Wrong type for settings
- **WHEN** the config has `"app": { "settingsVisible": 0 }`
- **THEN** validation fails with an error at `app.settingsVisible` saying it must be `true` or `false`

### Requirement: App listing settings are validated
`app.summary` SHALL be a non-empty string, `app.description` a string, and `app.icon` a
non-empty string. All three SHALL be optional. When the opened config has an invalid value for
one of them, validation SHALL fail with an error that names the setting by its path. Icon names
SHALL NOT be checked against Calcite's icon set.

#### Scenario: Invalid summary
- **WHEN** the opened config has `"app": { "summary": 12 }`
- **THEN** no map is created and the page shows an error naming `app.summary` as a non-empty string

#### Scenario: Valid listing settings
- **WHEN** the opened config sets `app.summary`, `app.description` and `app.icon` to strings
- **THEN** validation passes and the viewer starts normally

### Requirement: The Apps panel behaves like a sidebar panel
Activating the button SHALL open a panel headed with the button's label. It SHALL open, switch,
close and collapse as panel components' panels do: by its button, its close button, Escape, or
another panel's icon. The button SHALL be part of the icon bar's single Tab stop and arrow-key
order, SHALL have its label as its accessible name, and SHALL expose whether its panel is open.

#### Scenario: Open and switch
- **GIVEN** the "Apps and settings" button is shown
- **WHEN** the user activates it, then activates the Legend icon
- **THEN** a panel headed "Apps and settings" opens, then the Legend panel replaces it

#### Scenario: Escape
- **GIVEN** the Apps and settings panel is open
- **WHEN** the user presses Escape
- **THEN** the sidebar collapses and focus is on the "Apps and settings" button

#### Scenario: Keyboard
- **GIVEN** the icon bar is focused on a wide screen
- **WHEN** the user presses the Down arrow until the last icon is focused
- **THEN** focus reaches the button, a screen reader announces "Apps and settings" and that it is collapsed, and Enter opens its panel

#### Scenario: Settings only
- **GIVEN** the Settings button is shown
- **WHEN** the user activates it
- **THEN** a panel headed "Settings" opens with the Settings section and no apps list

### Requirement: The Apps panel lists the catalog's apps
The Apps panel SHALL show one row per catalog app, in catalog order. Each row SHALL show the
app's icon tile, its `app.title`, and its `app.summary` when it has one. The current app's row
SHALL be marked "Current" and SHALL have no Open action. Every other readable app's row SHALL
have an Open action whose accessible name includes the app's title.

#### Scenario: Rows
- **GIVEN** the catalog lists `default` and `parks`, and `parks.json` sets `app.title` "Parks & Trails" and `app.summary` "Trailheads and routes"
- **WHEN** the user opens the Apps panel from the `default` app
- **THEN** the default row shows its title and "Current", and the parks row shows "Parks & Trails", "Trailheads and routes" and an Open action

#### Scenario: No summary
- **WHEN** a listed app's config has an `app.title` but no `app.summary`
- **THEN** its row shows its title alone, on one line

### Requirement: App icons are tiles in the app's theme color
Each app's icon SHALL be its `app.icon` glyph, or `map` when it has none, drawn on a square tile
with rounded corners. The tile's background SHALL be the app's `app.theme.color`, and the glyph
SHALL be in the app's `app.theme.textColor`, or white or black, whichever has the higher contrast
with the color. An app with no theme SHALL get a neutral tile in the panel's own colors.

#### Scenario: Themed tile
- **WHEN** a listed app has `"app": { "icon": "tree", "theme": { "color": "#2e7d32" } }`
- **THEN** its tile is green with a white tree glyph

#### Scenario: Default tile
- **WHEN** a listed app's `app` block has neither `icon` nor `theme`
- **THEN** its tile shows the `map` glyph on a neutral background

### Requirement: Listings load without slowing startup
The viewer SHALL NOT request other apps' configs until the map, layers and components have
finished starting, or the Apps panel is opened, whichever comes first. It SHALL then request
them all at once, each at most once per page load. The current app's row SHALL use the config
already loaded. A row whose config hasn't arrived SHALL show the app name and that it is loading.

#### Scenario: No requests during startup
- **GIVEN** the catalog lists five apps and a layer takes 10 s to settle
- **WHEN** the page loads and the Apps panel isn't opened
- **THEN** no listed config other than the current one is requested until the layer settles and the components are ready

#### Scenario: Opened early
- **GIVEN** the same page, before the layer settles
- **WHEN** the user opens the Apps panel
- **THEN** the other configs are requested then, their rows show as loading, and each row fills in place when its config arrives, without the rows changing order

### Requirement: An app that can't be read is shown as unavailable
When a listed config can't be fetched, isn't valid JSON, or has no non-empty `app.title`, its
row SHALL show the app name and "Unavailable", with no Open action. The viewer SHALL log one
console warning naming its URL and the reason. A listed app SHALL NOT be unavailable for invalid
settings outside its `app.title`; its invalid listing values SHALL be treated as absent.

#### Scenario: Config missing
- **WHEN** the catalog lists `roads` and `apps/roads.json` returns HTTP 404
- **THEN** the roads row shows "roads" and "Unavailable" with no Open action, and the console shows a warning with the `apps/roads.json` URL and the 404 status

#### Scenario: Other settings invalid
- **WHEN** a listed config has a valid `app.title` and `app.summary`, but `map.zoom` is `"five"`
- **THEN** its row shows its title, summary and an Open action

#### Scenario: Invalid listing value
- **WHEN** a listed config has a valid `app.title` and `"summary": 12`
- **THEN** its row shows its title alone

### Requirement: An app's row opens its details
Activating a row, other than its Open action, SHALL show that app's detail page in the panel.
The page SHALL have a back button and show a larger icon tile, the title, the summary and the
full `app.description` as plain text, with each blank line starting a new paragraph. Back SHALL
return to the list with focus on that row. Reopening the panel SHALL show the list.

#### Scenario: Detail page
- **GIVEN** `parks.json` has an `app.description` of two paragraphs separated by a blank line
- **WHEN** the user activates the parks row
- **THEN** the panel shows the parks detail page with its tile, title, summary, an Open button and the description as two paragraphs

#### Scenario: Markup shown as text
- **WHEN** a listed app's `app.description` is `<b>Bold</b>`
- **THEN** its detail page shows the text `<b>Bold</b>`, not bold text

#### Scenario: Back
- **GIVEN** the parks detail page is shown
- **WHEN** the user activates the back button
- **THEN** the list is shown and focus is on the parks row

#### Scenario: Unavailable details
- **WHEN** the user activates the row of an unavailable app
- **THEN** its detail page shows the app name, says the app can't be opened, gives the reason and the config URL, and has no Open button

#### Scenario: Current app details
- **WHEN** the user activates the current app's row
- **THEN** its detail page says it is the app in use and has no Open button

### Requirement: Opening an app loads its config
Opening an app, from its row or its detail page, SHALL load the page with `?app=<name>`,
or with no query for the `default` app, and SHALL add a browser history entry. The
browser's Back button SHALL then return to the previous app.

#### Scenario: Open from a row
- **GIVEN** the `default` app is open
- **WHEN** the user activates the parks row's Open action
- **THEN** the page loads with `?app=parks` and shows the parks map

#### Scenario: Back to the previous app
- **GIVEN** the user opened parks from the `default` app
- **WHEN** the user presses the browser's Back button
- **THEN** the page returns to the `default` app, with no `app` parameter in the URL

### Requirement: An app's link can be copied
Every readable app's detail page SHALL have a Copy link button that copies the app's absolute
URL, the same URL Open loads, and SHALL confirm that the link was copied. When the browser
doesn't allow copying to the clipboard, the button SHALL NOT be shown.

#### Scenario: Copy link
- **WHEN** the user activates Copy link on the parks detail page
- **THEN** the clipboard holds the viewer's absolute URL with `?app=parks`, and the page confirms the link was copied

### Requirement: Many apps can be filtered
When the catalog lists more than 6 apps, the Apps list SHALL show a filter box that narrows the
rows by title and summary as the user types, and SHALL say when no app matches. With 6 or fewer
apps, it SHALL show no filter box.

#### Scenario: Filter
- **GIVEN** the catalog lists 8 apps, one with the summary "Trailheads and routes"
- **WHEN** the user types "trail" in the filter box
- **THEN** only the rows whose title or summary contains "trail" are shown

#### Scenario: Few apps
- **WHEN** the catalog lists 3 apps
- **THEN** the Apps list has no filter box

### Requirement: The Apps panel works when the map fails
The button and its panel SHALL work when the map can't be created or layers or components fail,
so the user can still switch to another app and change settings.

#### Scenario: Map fails
- **GIVEN** the catalog lists `default` and `parks`, and the `default` app's map can't be created
- **WHEN** the user opens the Apps and settings panel
- **THEN** the panel lists both apps, opening parks loads the parks map, and choosing Dark in the Settings section turns the page dark

### Requirement: The Settings section offers an Appearance choice
The Settings section SHALL come after the apps list, when there is one, and SHALL have an
Appearance control with three choices: System, Light and Dark. The selected choice SHALL be the
user's stored choice, or the app's `app.mode` when none is stored. The control SHALL be
operable by keyboard and SHALL have "Appearance" as its accessible name.

#### Scenario: Nothing stored
- **GIVEN** no choice is stored and the config has no `app.mode`
- **WHEN** the user opens the Settings panel
- **THEN** the Appearance control shows System selected

#### Scenario: App default shown
- **GIVEN** no choice is stored and the config has `app.mode` `"dark"`
- **WHEN** the user opens the Settings panel
- **THEN** the Appearance control shows Dark selected

#### Scenario: Keyboard
- **GIVEN** the Settings panel is open and the Appearance control is focused with System selected
- **WHEN** the user presses the Right arrow
- **THEN** Light is selected, and the viewer is shown in light mode

### Requirement: Choosing an appearance applies it at once
Selecting a choice in the Appearance control SHALL show the viewer in that mode at once, without
a reload, with the panel staying open. Selecting System SHALL follow the system's mode, live.

#### Scenario: Dark
- **GIVEN** the system is set to light mode and the Settings panel is open
- **WHEN** the user selects Dark
- **THEN** the page background turns `rgb(33, 33, 33)` and the open panel is drawn in Calcite's dark colors, with the panel still open

#### Scenario: System
- **GIVEN** the user has selected Light, and the system is set to dark mode
- **WHEN** the user selects System
- **THEN** the viewer is shown in dark mode, and switches to light when the system does

### Requirement: The user can return to each app's default
Once a choice is stored, the Settings section SHALL show a "Use each app's default" link. It
SHALL forget the stored choice, show the viewer in the app's `app.mode` (or the system's mode
when `app.mode` is `"auto"` or absent), and update the Appearance control to match. With no
choice stored, the link SHALL NOT be shown.

#### Scenario: Reset
- **GIVEN** the config has `app.mode` `"dark"`, and the user has selected Light
- **WHEN** the user activates "Use each app's default"
- **THEN** the viewer is shown in dark mode, the control shows Dark, and the link is no longer shown

#### Scenario: Reset applies to every app
- **GIVEN** the user selected Dark in one app, then reset it in another
- **WHEN** the user opens the first app again
- **THEN** it is shown in its own `app.mode`, or the system's mode when it has none

### Requirement: Settings work without browser storage
When the browser doesn't allow the viewer to store data, the Appearance control SHALL still
change the mode for the current page, and the viewer SHALL show no notice about it. The choice
SHALL NOT be remembered after a reload.

#### Scenario: Storage blocked
- **GIVEN** site data is blocked for the viewer's origin
- **WHEN** the user selects Dark, then reloads the page
- **THEN** the viewer turns dark at once, no notice is shown, and after the reload it is shown in the app's default mode

### Requirement: The filter box narrows only the apps list
When the apps list has a filter box, typing in it SHALL narrow only the app rows. The Settings
section SHALL stay shown whatever the filter matches.

#### Scenario: Filter with settings
- **GIVEN** the catalog lists 8 apps
- **WHEN** the user types "zzz" in the filter box
- **THEN** the apps list says no app matches, and the Settings section with its Appearance control is still shown
