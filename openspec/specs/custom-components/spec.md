# custom-components Specification

## Purpose

Defines how developers add their own component types to the viewer: registering a type so it is
configured, validated, and placed like a built-in one, the hello-world component that serves as
a working template, and the guide that explains how to write a component.

## Requirements

### Requirement: Developers can add their own component types
A developer SHALL be able to add a component type by adding a folder under `extensions/` that
holds the type's source and its manifest, with no change to any file outside that folder. A
custom type SHALL be configured like a built-in one, by `type`, `placement`, `options`, `panel`
and `expand`, with the same validation and placements (P-38). A type whose manifest says it
accepts `expand` SHALL be told when its expand opens and closes, as in a sidebar panel.

#### Scenario: Custom type in a corner and in a panel
- **GIVEN** `extensions/hello-world/` is in the build
- **WHEN** the config places one `hello-world` component `top-right` and another in `panel`
- **THEN** the first shows in the map's top-right corner, the second gets a sidebar icon and panel with the type's default heading and icon, and both show the map's center

#### Scenario: Custom type behind an expand button
- **GIVEN** `extensions/hello-world/` is in the build, and its manifest says it accepts `expand`
- **WHEN** the config places a `hello-world` component `top-right` with `"expand": true`, and the user presses its button
- **THEN** the button shows the type's default icon, and the component opens next to it showing the map's center

#### Scenario: Custom type options are validated
- **WHEN** a `hello-world` component has `"options": { "greeting": 5 }`
- **THEN** validation fails with an error at `components[0].options.greeting` saying a string is expected

#### Scenario: Unregistered custom type
- **WHEN** a component entry has `"type": "my-widget"` and there is no `extensions/my-widget/` folder or built-in type of that name
- **THEN** validation fails with an error at `components[0].type` that lists the available types, including `hello-world`

#### Scenario: A copied folder works with no other edit
- **GIVEN** a developer copies another developer's `extensions/trail-report/` folder into their own checkout and changes no other file
- **WHEN** they add `{ "id": "trails", "type": "trail-report" }` to an app's `components` and run `npm run dev`
- **THEN** the app shows the Trail report panel in the sidebar

### Requirement: The hello-world component is a working template
The repository SHALL include a `hello-world` component type in `extensions/hello-world/`, a
template to copy, that uses only the viewer API for viewer features. It SHALL show its
`greeting` option (default "Hello, world") and the map's current center and scale, updating as
the map moves. It SHALL find the map in a corner or the sidebar, in 2D or 3D, and SHALL stop
following the map when removed from the page.

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

#### Scenario: Uses only the viewer API
- **WHEN** the files in `extensions/hello-world/` are read
- **THEN** each import is from `"viewer"`, from an `@arcgis/` or `@esri/` package, or from a file in the same folder

### Requirement: A guide explains how to write a component
The developer documentation in `docs/components/` SHALL explain how to create a component
with the scaffolder and how to copy `hello-world` by hand. It SHALL explain how to declare that a
type accepts `expand`, and that the open and close events come from an expand as they do from a
sidebar panel. The template SHALL use Calcite components and design tokens only, so a copy
starts within the project's UI rules.

#### Scenario: Guide matches the template
- **WHEN** a developer follows `docs/components/getting-started.md` to copy `hello-world` by hand as `my-component`, changing only files inside the copy
- **THEN** the copy builds, passes typecheck, and shows in a sidebar panel

#### Scenario: Guide matches the scaffolder
- **WHEN** a developer follows `docs/components/getting-started.md` to create `my-component` with `npm run new:component`
- **THEN** each question the guide shows is the one the scaffolder asks, and the result shows in a sidebar panel

#### Scenario: Guide covers expand
- **WHEN** a developer follows the guide to place `my-component` in a corner expand
- **THEN** the copy opens from its button, and its open and close listeners run when the expand opens and closes

### Requirement: An extension's type name is its folder's name
A folder `extensions/<name>/` with a valid manifest SHALL provide the component type `<name>`. A
folder name SHALL be lowercase letters, digits and hyphens, starting with a letter. Removing the
folder and rebuilding SHALL remove the type. A folder whose name starts with a dot SHALL be
ignored without a message.

#### Scenario: Name from the folder
- **GIVEN** a valid folder `extensions/trail-report/`
- **WHEN** a component entry has `"type": "trail-report"`
- **THEN** validation passes and the component is created

#### Scenario: Folder removed
- **GIVEN** `extensions/trail-report/` is deleted and the viewer is rebuilt
- **WHEN** a component entry has `"type": "trail-report"`
- **THEN** validation fails with an error at its `type` that lists the available types, without `trail-report`

#### Scenario: Hidden folders are ignored
- **GIVEN** a folder `extensions/.drafts/` with no manifest, and the dev server running
- **WHEN** an app opens
- **THEN** the app works as before, the console has no message about `.drafts`, and `.drafts` isn't among the available types

### Requirement: A folder with a problem is skipped
The viewer SHALL skip an extension folder that has no manifest or an invalid one, whose name is
not valid, whose name is a built-in type's, or whose element tag another type uses. It SHALL
keep starting, log one message naming the folder and the problem, and fail validation of a
config entry of that type with that reason.

#### Scenario: Clash with a built-in
- **GIVEN** a folder `extensions/legend/` with a valid manifest
- **WHEN** an app with a `legend` component opens
- **THEN** the built-in legend is shown, and the console has one message saying `extensions/legend/` was skipped because `legend` is a built-in type

#### Scenario: Invalid manifest
- **GIVEN** a folder `extensions/trail-report/` whose manifest has no `tag`
- **WHEN** an app with a `trail-report` component opens
- **THEN** the config error notice shows an error at that entry's `type` saying `extensions/trail-report/` was skipped and that its manifest has no `tag`

#### Scenario: Folder without a manifest
- **GIVEN** a folder `extensions/trail-report/` with a `Component.ts` but no `component.ts`
- **WHEN** the viewer starts with an app that doesn't use it
- **THEN** the app works as before, and the console has one message saying `extensions/trail-report/` has no `component.ts`

#### Scenario: Two folders with one tag
- **GIVEN** folders `extensions/trails-a/` and `extensions/trails-b/` whose manifests both name the tag `viewer-trails`
- **WHEN** the viewer starts
- **THEN** `trails-a` is available, and `trails-b` is skipped with a message saying `viewer-trails` is already used by `trails-a`

### Requirement: An extension states the viewer API version it was written for
A manifest SHALL state the viewer API version it was written for. The viewer SHALL skip a folder
whose version it doesn't support, as for any other problem, saying which version the folder
states and which the viewer supports.

#### Scenario: Supported version
- **GIVEN** `extensions/hello-world/` states the viewer's current API version
- **WHEN** an app with a `hello-world` component opens
- **THEN** the component is shown

#### Scenario: Unsupported version
- **GIVEN** a folder `extensions/trail-report/` whose manifest states API version 99
- **WHEN** an app with a `trail-report` component opens
- **THEN** the config error notice shows an error at that entry's `type` saying the folder was written for viewer API 99 and this viewer supports version 1

#### Scenario: No version
- **GIVEN** a folder `extensions/trail-report/` whose manifest states no API version
- **WHEN** an app with a `trail-report` component opens
- **THEN** the config error notice shows an error at that entry's `type` saying the manifest has no API version

### Requirement: Extensions use viewer features through the viewer API
The viewer SHALL offer extension code one import, `"viewer"`, that provides: finding the map
element from a component in a corner or a panel, in 2D or 3D; the container open, close and
request-open events; a browser-storage key per app; the manifest's definition and types; and
the API version. An incompatible change to it SHALL come with a new API version.

#### Scenario: Map found from a panel and a corner
- **GIVEN** a component in `extensions/` that finds the map element through the viewer API
- **WHEN** it is placed once in `panel` and once `top-right`, in a 2D app and then in a 3D app
- **THEN** each instance shows the map's center

#### Scenario: Saved data is kept per app
- **GIVEN** a component in `extensions/` that saves a note under the viewer API's storage key for the name `trail-report`
- **WHEN** the user saves a note in `?app=default` and then opens `?app=survey-tools`
- **THEN** the note isn't shown in `survey-tools`, and it is shown again on returning to `?app=default`

### Requirement: The developer documentation covers the whole extension contract
`docs/components/` SHALL describe every manifest field, every option kind, and every export of
the viewer API, with an example of each. It SHALL include guides to finding the map, container
events, saving state, using the API key, and look and feel, and a sharing guide covering
the recommended setup (a fork of the viewer), folder contents, the API version, and why a folder
can be skipped.

#### Scenario: Every manifest field is documented
- **WHEN** a developer looks up any field the manifest accepts
- **THEN** `docs/components/manifest.md` says what it does, whether it is required, its default, and shows an example

#### Scenario: Every skip reason is explained
- **WHEN** the viewer logs that a folder was skipped
- **THEN** `docs/components/sharing.md` has a troubleshooting entry for that reason that says how to fix it

#### Scenario: Recommended setup is documented
- **WHEN** a developer opens `docs/components/README.md` to start their own components
- **THEN** it points them to forking the viewer, and `docs/components/sharing.md` explains adding components under `extensions/` in the fork and pulling upstream updates
