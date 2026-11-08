# notices Specification

## Purpose

Rules every in-page notice follows, whatever it reports: errors, warnings, and anything added
later. Users can always dismiss a notice, and a notice never hides the viewer's own title.

## Requirements

### Requirement: Every notice can be closed
Every in-page notice SHALL have a close button. Closing a notice SHALL remove it from the page.
The same notice SHALL appear again only if its cause happens again, or when the page is
reloaded. This SHALL apply to errors as well as warnings, including the notice shown when the
config is invalid or unreadable and the notice shown when the map fails.

#### Scenario: Invalid config notice
- **GIVEN** the config has `map.center` `[-98.5, 120]`
- **WHEN** the user presses the error notice's close button
- **THEN** the notice is removed, and no map is created (Playwright)

#### Scenario: Map failure notice
- **GIVEN** all requests for the basemap are blocked, and the map-failure notice is shown
- **WHEN** the user presses its close button
- **THEN** the notice is removed (Playwright, request blocking)

#### Scenario: Layer warning
- **GIVEN** one configured layer returns HTTP 404, and the layer warning is shown
- **WHEN** the user presses its close button
- **THEN** the notice is removed, and the map and its other layers keep working (Playwright, route interception)

#### Scenario: Close from the keyboard
- **GIVEN** the invalid-config notice is shown
- **WHEN** the user moves focus to its close button with Tab and presses Enter
- **THEN** the notice is removed (Playwright)

### Requirement: Notices do not cover the title box
When the title box is shown, in-page notices SHALL NOT overlap it at any viewport width. When
the title box is hidden, notices SHALL keep their usual place at the top of the map.

#### Scenario: Notice and title on a phone
- **GIVEN** a 375×667 viewport and a configured layer that returns HTTP 404
- **WHEN** the layer warning is shown
- **THEN** the notice's top edge is below the title box's bottom edge (Playwright, comparing bounding boxes)

#### Scenario: Notice and title on a wide screen
- **GIVEN** a 1280×800 viewport, a long `app.title`, and a configured layer that returns HTTP 404
- **WHEN** the layer warning is shown
- **THEN** the notice and the title box do not overlap (Playwright, comparing bounding boxes)

#### Scenario: Title hidden
- **GIVEN** a 375×667 viewport, `app.titleVisible` `false`, and a configured layer that returns HTTP 404
- **WHEN** the layer warning is shown
- **THEN** the notice's top edge is within 16 px of the map's top edge (Playwright)
