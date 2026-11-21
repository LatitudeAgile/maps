# Spec Delta

## MODIFIED Requirements

### Requirement: Unrecognized top-level settings are ignored with a warning
The viewer SHALL recognize the top-level settings `app`, `portal`, `map`, `services`, `layers`,
`components`, `geocoding`, `mapMenu`, `debug`, and `request`. For any other top-level setting, it
SHALL log one console warning that names the setting, and SHALL continue starting.

#### Scenario: All recognized settings present
- **WHEN** the config sets every recognized top-level setting with valid values
- **THEN** the viewer starts normally and logs no config warning

#### Scenario: Unknown setting
- **WHEN** the config includes `"colour": "blue"` at the top level
- **THEN** the viewer starts normally and logs one warning naming `colour`

#### Scenario: Map menu setting
- **WHEN** the config includes `"mapMenu": false`
- **THEN** the viewer starts normally and logs no config warning
