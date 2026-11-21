# Spec Delta

## MODIFIED Requirements

### Requirement: Components are created from config
The viewer SHALL create one component for each entry of the `components` config array, using the
entry's `type`. Only registered component types SHALL be accepted. This version registers
twenty-one: `home`, `zoom`, `legend`, `locate`, `track`, `basemap-toggle`, `search`, `directions`,
`layer-list`, `basemap-gallery`, `print`, `sketch`, `compass`, `navigation-toggle`, `measure`,
`fullscreen`, `scale-bar`, `bookmarks`, `coordinate-conversion`, `print-map`, and the `hello-world`
template.

#### Scenario: Home component returns to the initial view
- **GIVEN** the config has a `home` component placed `top-left`
- **WHEN** the user pans and zooms the map and then presses the Home button
- **THEN** the map returns to within 0.01° of the configured center and within 1% of the configured scale

#### Scenario: Unknown component type
- **WHEN** a component entry has `"type": "weather"`
- **THEN** validation fails with an error at `components[0].type` that lists the supported types, including `measure` and `coordinate-conversion`

#### Scenario: Duplicate component ID
- **WHEN** two component entries have the `id` `home`
- **THEN** validation fails with an error at `components[1].id` saying IDs must be unique

## ADDED Requirements

### Requirement: A component type's code is fetched only by apps that use it
The viewer SHALL fetch a component type's code, and the libraries only it needs, when an app
first uses that type, and not before. An app that doesn't use a type SHALL never fetch them.
This SHALL hold for built-in types and for extension types, in the development server and in
the built app. Code that a type needs only for one action SHALL be fetched when that action is
first taken.

#### Scenario: Unused types aren't fetched
- **GIVEN** the built app, served with `npm run preview`
- **WHEN** the redlands-parks app is opened, which has no `print-map`, `sketch`, `measure` or `buffalo-river` component
- **THEN** the browser's network list has no file holding their code, and no PDF library

#### Scenario: Used type fetched when the app starts
- **GIVEN** the built app
- **WHEN** the Buffalo River app is opened
- **THEN** the network list has the files for `print-map`, `measure` and `buffalo-river`, and no file for `sketch` and no PDF library

#### Scenario: PDF library on first PDF
- **GIVEN** the Buffalo River app open, with no PDF made yet
- **WHEN** the user exports a PDF from Print map, and then another
- **THEN** the PDF library is fetched once, at the first export, and a JPEG export before it doesn't fetch it

#### Scenario: Extension types
- **GIVEN** the built app, with the `hello-world` and `buffalo-river` extensions in `extensions/`
- **WHEN** an app that uses neither is opened
- **THEN** no file holding either extension's component code is fetched; only their manifests, which are part of the viewer's own code, are present
