# Spec Delta

## MODIFIED Requirements

### Requirement: Extensions use viewer features through the viewer API
The viewer SHALL offer extension code one import, `"viewer"`, that provides: finding the map
element from a component in a corner or a panel, in 2D or 3D; the container open, close and
request-open events; a browser-storage key per app; adding items to the map menu; the manifest's
definition and types; and the API version. An incompatible change to it SHALL come with a new
API version.

#### Scenario: Map found from a panel and a corner
- **GIVEN** a component in `extensions/` that finds the map element through the viewer API
- **WHEN** it is placed once in `panel` and once `top-right`, in a 2D app and then in a 3D app
- **THEN** each instance shows the map's center

#### Scenario: Saved data is kept per app
- **GIVEN** a component in `extensions/` that saves a note under the viewer API's storage key for the name `trail-report`
- **WHEN** the user saves a note in `?app=default` and then opens `?app=survey-tools`
- **THEN** the note isn't shown in `survey-tools`, and it is shown again on returning to `?app=default`

#### Scenario: Map menu item from an extension
- **GIVEN** a component in `extensions/` that adds a map menu item through the viewer API, in an app with no `mapMenu` setting
- **WHEN** the user right-clicks the map, in a 2D app and then in a 3D app
- **THEN** the item is listed in a group headed with the component's heading, and picking it runs its action for the spot clicked

#### Scenario: API version unchanged
- **WHEN** an extension written for API version 1 before the map menu existed is loaded
- **THEN** it is not skipped, and works as before

### Requirement: The hello-world component is a working template
The repository SHALL include a `hello-world` component type in `extensions/hello-world/`, a
template to copy, that uses only the viewer API for viewer features. It SHALL show its
`greeting` option (default "Hello, world") and the map's current center and scale, updating as
the map moves. It SHALL find the map in a corner or the sidebar, in 2D or 3D, and SHALL stop
following the map when removed from the page. It SHALL add a "Say hello here" map menu item that
shows its greeting with the spot's latitude and longitude.

#### Scenario: Greeting from config
- **WHEN** a `hello-world` component has `"options": { "greeting": "Hi from the team" }`
- **THEN** it shows "Hi from the team"

#### Scenario: Default greeting
- **WHEN** a `hello-world` component has no `greeting` option
- **THEN** validation passes, its `greeting` is "Hello, world", and it shows "Hello, world"

#### Scenario: Follows the map
- **GIVEN** a `hello-world` component in a sidebar panel that is open
- **WHEN** the map is panned to longitude -104.99, latitude 39.74
- **THEN** within 2 seconds after the map is stationary, the component shows that center to two decimal places

#### Scenario: Follows a scene
- **GIVEN** a config-built 3D scene with a `hello-world` component placed `top-right` and another in an open sidebar panel
- **WHEN** the scene is panned
- **THEN** within 2 seconds after the scene is stationary, both components show its new center to two decimal places

#### Scenario: Stops following when removed
- **GIVEN** a `hello-world` component is showing the map's center
- **WHEN** the element is removed from the page and the map is then panned
- **THEN** no error is reported and the removed element's text doesn't change

#### Scenario: Says hello from the map menu
- **GIVEN** a `hello-world` component in a sidebar panel
- **WHEN** the user right-clicks the map and picks Say hello here
- **THEN** its panel opens and shows its greeting with the spot's latitude and longitude to two decimal places

#### Scenario: Uses only the viewer API
- **WHEN** the files in `extensions/hello-world/` are read
- **THEN** each import is from `"viewer"`, from an `@arcgis/` or `@esri/` package, or from a file in the same folder

### Requirement: The developer documentation covers the whole extension contract
`docs/components/` SHALL describe every manifest field, every option kind, and every export of
the viewer API, with an example of each. It SHALL include guides to finding the map, container
events, saving state, using the API key, adding map menu items, and look and feel, and a sharing
guide covering the recommended setup (a fork of the viewer), folder contents, the API version,
and why a folder can be skipped.

#### Scenario: Every manifest field is documented
- **WHEN** a developer looks up any field the manifest accepts
- **THEN** `docs/components/manifest.md` says what it does, whether it is required, its default, and shows an example

#### Scenario: Every skip reason is explained
- **WHEN** the viewer logs that a folder was skipped
- **THEN** `docs/components/sharing.md` has a troubleshooting entry for that reason that says how to fix it

#### Scenario: Recommended setup is documented
- **WHEN** a developer opens `docs/components/README.md` to start their own components
- **THEN** it points them to forking the viewer, and `docs/components/sharing.md` explains adding components under `extensions/` in the fork and pulling upstream updates

#### Scenario: Map menu guide
- **WHEN** a developer reads the map menu guide in `docs/components/guides/`
- **THEN** it shows adding an item, hiding it where it doesn't apply, and how an app's `mapMenu` setting orders or leaves out the component's items
