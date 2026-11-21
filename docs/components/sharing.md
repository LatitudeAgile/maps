# Sharing components

A component is a folder under `extensions/`. Sharing one means copying that folder into another
copy of the viewer. Nothing else needs to change there: the build finds the folder, and an app
uses it by adding an entry to its `components`.

## Your fork

The recommended setup is a fork of the viewer.

1. Fork this repository and clone your fork.
2. Add your components under `extensions/`, with the scaffolder (`npm run new:component`) or by
   copying a folder. Commit them to your fork, along with your apps in `public/apps/`.
3. To update the viewer, pull from upstream:

   ```bash
   git remote add upstream <the viewer's repository URL>   # once
   git pull upstream main
   ```

Upstream changes land in `src/`, `docs/`, `scripts/` and the template
`extensions/hello-world/`. Your folders are yours alone, so a merge rarely touches them. Conflicts
you may see:

- **`package.json`, `package-lock.json`:** if you added dependencies. Keep both sides, then run
  `npm install`.
- **Sample apps in `public/apps/`:** if you edited the samples. Prefer adding your own app files
  and removing the samples from `public/apps/index.json`, rather than editing them.
- **`extensions/hello-world/`:** if you changed the template. Leave it as it is, and copy it
  instead.

After a pull, run `npm run check` and start the viewer. If the viewer's API version changed, the
console says which folders were skipped and why: see [The API version](#the-api-version).

Cloning a separate repository of components inside `extensions/` isn't supported: the viewer
only looks one folder deep, and a component's dependencies have to come from the viewer's own
`package.json`.

## What goes in a folder

```
extensions/trail-report/
  component.ts      required: the manifest
  index.ts          defines the element; the manifest's load imports it
  TrailReport.ts    the element
  README.md         what it does, its options, and a config entry to paste
  *.ts              any other code it needs
```

- **Imports only from `"viewer"`, `@arcgis/` and `@esri/` packages, and files in its own
  folder.** Then the folder works in any copy of the viewer. Never import from `src/` directly:
  see [The viewer API](viewer-api.md).
- **A README** that says what the component does, lists its options with their kinds and
  defaults, and shows a config entry. The scaffolder writes one.
- **No secrets.** Don't put API keys or tokens in a component. It gets the build's key through
  `configure`; see [API keys](guides/api-keys.md).
- **Other npm packages:** a package from anywhere else has to be added to the viewer's
  `package.json` (`npm install <package>`). The folder then works only in a viewer that has that
  package too. Say so in its README, so whoever adds the folder runs the same install. Code that's
  small enough can live in the folder instead: `buffalo-river` works out sunrise and sunset in
  its own `sun.ts` rather than adding a package.

The folder's name is the type's name in configs, so pick one that won't clash: a built-in type's
name, such as `legend`, is refused. If two people share components with the same name, rename one
folder; nothing inside it has to change, except its `tag` if both use the same one.

## The API version

Every manifest states the viewer API version it was written for, in `apiVersion`. The viewer
supports one version, `API_VERSION` in `"viewer"`, and skips a folder written for another.

The version changes only when a release removes or changes something in `"viewer"` in a way
that could break a component. Adding to the API doesn't change it. When it changes, the release
notes say what changed. To update a component:

1. Read what changed, and update your code.
2. Set `apiVersion` to the new version, or use `API_VERSION`.
3. Run `npm run check`, then try the component in a panel and a corner.

## Troubleshooting

When the viewer skips a folder, it logs a warning in the browser console on every start:

```
Viewer extensions: extensions/<folder>/ was skipped: <reason>.
```

An app that uses the skipped type also fails to start, with the same message in its error
notice at the entry's `type`. The viewer keeps working for apps that don't use it.

### it has no component.ts

The folder has no manifest. Add a `component.ts` that default-exports
`defineComponentType({ ... })`; see [manifest.md](manifest.md). If the folder isn't a component,
for example drafts or shared notes, rename it to start with a dot (`.drafts`): the viewer ignores
folders whose names start with a dot.

### it has no component.ts (it has Component.ts; the name must be all lowercase)

The manifest's file name has the wrong letter case. Rename it to `component.ts`. On Windows,
rename it in two steps (`component.tmp`, then `component.ts`), or git may not notice the change.

### "\<folder>" isn't a valid type name; use lowercase letters, digits and hyphens, starting with a letter

The folder's name is the type's name in configs, and must be lowercase words joined by hyphens,
such as `trail-report`. Rename the folder, and the `type` in any configs that use it.

### \<name> is a built-in type

A built-in type already has this name, such as `legend`. The built-in type is used, and your
folder is skipped. Rename the folder.

### its component.ts has no default export

`component.ts` must end with `export default defineComponentType({ ... })`. A named export, such
as `export const manifest = ...`, isn't found.

### its component.ts default export isn't a manifest object; export defineComponentType({ ... })

The default export is something other than the manifest object, such as a class or a function.
Export the object that `defineComponentType` returns.

### its manifest has no apiVersion

Add `apiVersion: API_VERSION` (imported from `"viewer"`), or the version number you wrote it for.

### it was written for viewer API \<n>, and this viewer supports version \<m>

The folder was written for another version of the viewer. If its version is older, update it
as described in [The API version](#the-api-version). If it's newer, update your viewer:
see [Your fork](#your-fork).

### its manifest has no tag

Add `tag`, the custom element name your `index.ts` defines, such as `"viewer-trail-report"`.

### its tag "\<tag>" isn't a valid custom element name; use lowercase letters with a hyphen, such as "viewer-my-component"

Custom element names must be lowercase, start with a letter, and contain a hyphen. Use
`viewer-<folder name>`, and change it in `index.ts` too.

### its tag \<tag> starts with "arcgis-" or "calcite-", which belong to Esri's components

Those prefixes are for the ArcGIS Maps SDK's and Calcite's own elements. Use `viewer-<folder name>`.

### its tag \<tag> is already used by \<another folder or a built-in type>

Two types can't define the same element. Folders are checked in alphabetical order, and the
first one keeps the tag. Give this folder's element its own tag, in the manifest and in
`index.ts`.

### its manifest has no load function

Add `load: () => import("./index.ts")`, where `index.ts` defines the element.

### its manifest has no panel heading and icon

Add `panel: { heading: "Trail report", icon: "walking" }`. The icon is a
[Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name.

### its manifest's panel.heading isn't a non-empty string, or its manifest's panel.icon isn't a non-empty string

Set both `panel.heading` and `panel.icon` to non-empty text.

### its manifest has no options object; use options: {} for none

Add `options`, even if empty.

### its option \<name> has an unknown kind

The option's kind isn't one the viewer knows, for example `"text"` instead of `"string"`. The
message lists the known kinds; see [option-kinds.md](option-kinds.md).

### its option \<name> has an { integer } kind without a [min, max] range of whole numbers

Write the range as two whole numbers, smallest first: `{ integer: [1, 10] }`.

### its option \<name> has a { oneOf } kind without a non-empty list of strings

The same for `{ listOf }`. Give the allowed values as a list of strings:
`{ oneOf: ["miles", "kilometers"] }`.

### its manifest's defaults isn't an object

`defaults` maps option names to values: `defaults: { minLength: 5 }`.

### its manifest's placements must be a non-empty list of: ...

The same for `views`. Each entry must be one of the listed values, such as
`placements: ["panel", "top-right"]` or `views: ["2d"]`. Leave the field out to allow all.

### its manifest's expandable must be true, or left out

Use `expandable: true`, or remove it.

### its manifest's expandMode must be one of: auto, floating, drawer

The same for `cornerStyle` (`button`, `panel`). Use one of the listed values, or remove the field.

### its manifest's configure isn't a function

The same for `keyless`. Each must be a function, or left out; see [manifest.md](manifest.md#configure).

## Moving from src/components/custom/

Before drop-in folders, a custom type lived under `src/components/custom/<name>/` with an entry
in `COMPONENT_TYPES` in `src/components/registry.ts`. To move one:

1. Move the folder to `extensions/<name>/`, where `<name>` is the type name the registry used.
2. Add `component.ts` with the registry entry's fields: `tag`, `load`, `options`, `defaults`,
   `panel`, and any of `placements`, `views`, `expandable`, `expandMode`, `configure` and
   `keyless`. Add `apiVersion: API_VERSION`, and `cornerStyle` if it goes in corners. Change
   `load` to `() => import("./index.ts")`.
3. Replace imports from `src/` (`../../../map/viewElement.ts`,
   `../../../sidebar/panelEvents.ts` and the like) with imports from `"viewer"`. If you used
   `configName` from `src/config/load.ts` for a storage key, use `appStorageKey` instead; see
   [Saving state](guides/saving-state.md).
4. Delete the entry from `registry.ts`.
5. Run `npm run check`, and open an app that uses the type.
