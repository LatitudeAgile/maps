# custom-components Specification

## Purpose

Defines how developers add their own component types to the viewer: registering a type so it is
configured, validated, and placed like a built-in one, the hello-world component that serves as
a working template, and the guide that explains how to write a component.

## Requirements

### Requirement: Developers can add their own component types
A developer SHALL be able to add a component type by adding its source and registering it under
a type name, without changing the component stage, validation, or the sidebar. A custom type
SHALL be configured like a built-in one, by `type`, `placement`, `options`, `panel` and
`expand`, with the same validation and placements (P-38). A type registered as accepting
`expand` SHALL be told when its expand opens and closes, as in a sidebar panel.

#### Scenario: Custom type in a corner and in a panel
- **GIVEN** the `hello-world` type is registered
- **WHEN** the config places one `hello-world` component `top-right` and another in `panel`
- **THEN** the first shows in the map's top-right corner, the second gets a sidebar icon and panel with the type's default heading and icon, and both show the map's center

#### Scenario: Custom type behind an expand button
- **GIVEN** the `hello-world` type is registered as accepting `expand`
- **WHEN** the config places a `hello-world` component `top-right` with `"expand": true`, and the user presses its button
- **THEN** the button shows the type's default icon, and the component opens next to it showing the map's center

#### Scenario: Custom type options are validated
- **WHEN** a `hello-world` component has `"options": { "greeting": 5 }`
- **THEN** validation fails with an error at `components[0].options.greeting` saying a string is expected

#### Scenario: Unregistered custom type
- **WHEN** a component entry has `"type": "my-widget"` and no such type is registered
- **THEN** validation fails with an error at `components[0].type` that lists the registered types, including `hello-world`

### Requirement: The hello-world component is a working template
The repository SHALL include a `hello-world` component type that a developer can copy as the
starting point for their own. It SHALL show the text of its `greeting` option (default
"Hello, world"), and the map's current center and scale, which update as the map moves. It SHALL
find the map whether it is placed in a map corner or in the sidebar, in a 2D map or a 3D scene,
and SHALL stop following the map when removed from the page.

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

### Requirement: A guide explains how to write a component
A guide SHALL explain how to copy `hello-world`, rename it, register it, and add options. It SHALL
explain how to register a type as accepting `expand`, and that the open and close events come from
an expand as they do from a sidebar panel. The template SHALL use Calcite components and design
tokens only, so a copy starts within the project's UI rules.

#### Scenario: Guide matches the template
- **WHEN** a developer follows `docs/custom-components.md` to copy `hello-world` as `my-component`
- **THEN** the copy builds, passes typecheck, and shows in a sidebar panel

#### Scenario: Guide covers expand
- **WHEN** a developer follows `docs/custom-components.md` to place `my-component` in a corner expand
- **THEN** the copy opens from its button, and its open and close listeners run when the expand opens and closes
