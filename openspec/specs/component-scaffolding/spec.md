# component-scaffolding Specification

## Purpose

Lets a developer start a new extension component by answering a few questions, getting a folder
under `extensions/` that already builds and shows in the viewer, shaped by the answers.

## Requirements

### Requirement: The scaffolder asks what the component needs
`npm run new:component` SHALL ask, in order: the name, panel heading, Calcite icon, allowed
placements, corner look, whether it opens from an expand, supported views, its options (each with
name, kind and default), whether it follows its container opening and closing, saves data per
app, or converts options before use, and which app config to add it to. Each question SHALL show
its default, and Enter SHALL accept it.

#### Scenario: Defaults throughout
- **WHEN** a developer runs `npm run new:component`, types `trail-report` as the name, and presses Enter at every other question
- **THEN** `extensions/trail-report/` is created for a type with the heading "Trail report", the `code` icon, panel and corner placements, the panel look in corners, expand support, 2D and 3D, no options, and no other features, and no app config is changed

#### Scenario: Questions that don't apply are skipped
- **WHEN** the developer answers that the component goes in the sidebar panel only
- **THEN** the scaffolder doesn't ask about the corner look or expand

#### Scenario: Adding options
- **WHEN** the developer adds an option `minLength` of kind `number` with default `5`, then an empty name
- **THEN** the scaffolder stops asking for options, and the new type accepts `minLength`, defaults it to 5, and fails validation for `"minLength": "long"`

#### Scenario: Unknown icon
- **WHEN** the developer types an icon name that isn't a Calcite icon
- **THEN** the scaffolder says so and asks for the icon again

### Requirement: The scaffolder checks the name
The scaffolder SHALL accept a name only if it is lowercase letters, digits and hyphens starting
with a letter, is not a built-in type, and has no folder in `extensions/` yet. For any other name
it SHALL say why and ask again.

#### Scenario: Built-in name
- **WHEN** the developer types `legend` as the name
- **THEN** the scaffolder says `legend` is a built-in type and asks for the name again

#### Scenario: Existing folder
- **GIVEN** `extensions/trail-report/` exists
- **WHEN** the developer types `trail-report` as the name
- **THEN** the scaffolder says the folder exists and asks for the name again, and the folder is unchanged

#### Scenario: Not kebab-case
- **WHEN** the developer types `TrailReport` as the name
- **THEN** the scaffolder says names are lowercase words joined by hyphens, suggests `trail-report`, and asks again

### Requirement: The scaffolder writes a folder that works
The scaffolder SHALL write `extensions/<name>/` with a manifest, an element file, the file that
defines the element, and a README with a config entry to paste. The result SHALL pass typecheck
without edits, and SHALL show in each placement it allows, in each view it supports.

#### Scenario: Builds and shows
- **GIVEN** `trail-report` was created with the defaults
- **WHEN** the developer runs `npm run check`, adds the README's config entry to an app placed in `panel` and another placed `top-right` with `"expand": true`, and opens the app on the dev server
- **THEN** typecheck passes, the panel shows the component's heading, and the corner button opens it

#### Scenario: README tells what to do next
- **WHEN** the developer opens `extensions/trail-report/README.md`
- **THEN** it names the type, lists its options with their kinds and defaults, and shows a config entry for it

#### Scenario: Prints the next steps
- **WHEN** the scaffolder finishes
- **THEN** it lists the files it wrote and the commands to check and run the component

### Requirement: The answers shape the generated code
The generated folder SHALL contain working code for each feature the developer asked for and none
for features they declined: following the container, saving data per app, and converting options.
Each feature's code SHALL be commented so the developer knows where to add their own logic.

#### Scenario: Follows its container
- **GIVEN** `trail-report` was created with "follows its container" answered yes and placed in `panel`
- **WHEN** the user opens and closes its panel
- **THEN** the component shows that it is open, then closed

#### Scenario: Saves data per app
- **GIVEN** `trail-report` was created with "saves data per app" answered yes
- **WHEN** the user changes the component's saved value and reloads the page
- **THEN** the component shows the value it saved, and another app doesn't

#### Scenario: Nothing extra
- **GIVEN** `trail-report` was created with every feature answered no
- **WHEN** the developer reads its files
- **THEN** they contain no container listeners, no storage code and no option-conversion hook

### Requirement: The scaffolder can add the component to an app
When asked to, the scaffolder SHALL add one entry for the new component to the end of an
app's `components` list, in a sidebar panel when the type allows one and otherwise top-right. It SHALL list the apps in `public/apps/` to
choose from, and SHALL leave the rest of the file's content unchanged.

#### Scenario: Added to an app
- **WHEN** the developer chooses `survey-tools` at the last question
- **THEN** `public/apps/survey-tools.json` ends its `components` list with `{ "id": "trail-report", "type": "trail-report" }`, its other settings are unchanged, and `?app=survey-tools` shows the Trail report panel

#### Scenario: Id already used
- **GIVEN** `survey-tools` already has a component with id `trail-report`
- **WHEN** the developer chooses `survey-tools`
- **THEN** the new entry's id is `trail-report-2`

#### Scenario: Not added
- **WHEN** the developer chooses no app
- **THEN** no file in `public/apps/` changes, and the scaffolder prints the config entry to add

### Requirement: Flags answer the questions without prompts
Each question SHALL have a command-line flag. With `--yes`, the scaffolder SHALL use the default
for any question no flag answers, and SHALL ask nothing. A missing name with `--yes`, or an invalid
flag value, SHALL be an error that names the flag, and nothing SHALL be written. `--help` SHALL
list the flags.

#### Scenario: Fully non-interactive
- **WHEN** a developer runs `npm run new:component -- --name trail-report --views 2d --option minLength:number=5 --yes`
- **THEN** `extensions/trail-report/` is created for a 2D-only type with a `minLength` number option defaulting to 5, without any question asked

#### Scenario: Invalid flag
- **WHEN** a developer runs `npm run new:component -- --name trail-report --views 4d --yes`
- **THEN** the scaffolder exits with an error saying `--views` accepts `2d`, `3d` or `both`, and `extensions/trail-report/` doesn't exist

#### Scenario: Help
- **WHEN** a developer runs `npm run new:component -- --help`
- **THEN** it lists every flag with its accepted values and default, and writes nothing

### Requirement: The scaffolder never overwrites or leaves half a folder
The scaffolder SHALL write nothing until every question is answered, SHALL never replace an
existing file, and SHALL write nothing if it is cancelled or fails before finishing. It SHALL run
the same on Windows, macOS and Linux.

#### Scenario: Cancelled
- **WHEN** the developer presses Ctrl+C at the options question
- **THEN** the scaffolder exits, and no folder or app config was changed

#### Scenario: On Windows
- **WHEN** a developer runs `npm run new:component` in PowerShell on Windows
- **THEN** it asks the same questions and writes the same files, with the same line endings, as on macOS
