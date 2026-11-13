# Getting started

This guide makes a component type called `trail-report`, shows it in a sidebar panel, a map
corner and an expand button, and points to what to change next. It uses the scaffolder, then
shows how to start by copying `hello-world` instead.

## Before you start

Work in your fork of the viewer (see [Your fork](sharing.md#your-fork)). Install and start it:

```bash
npm install
npm run dev
```

Keep the dev server running. It picks up new folders under `extensions/` and reloads the page.

## 1. Create the component

Run the scaffolder from the repository's root folder, in a second terminal:

```bash
npm run new:component
```

It asks what the component needs. Press Enter to take the default shown in brackets. Here is a
run that names the component `trail-report`, uses the `walking` icon, adds one option, and asks
for the panel open and close events:

```
Name (lowercase words joined by hyphens, such as trail-report): trail-report
Panel heading [Trail report]:
Calcite icon (see developers.arcgis.com/calcite-design-system/icons) [code]: walking
Where can it go?  (1) sidebar panel  (2) map corners  (3) both  [3]
How does it look in a map corner?  (1) button  (2) panel  (3) none  [2]
Can it open from an expand button in a corner? [Y/n]
Which views?  (1) 2D maps  (2) 3D scenes  (3) both  [3]
Option name (Enter when there are no more options): minLength
  Kind of minLength?  (1) string  (2) number  (3) boolean  (4) scale  (5) url  (6) basemap  (7) basemap[]  (8) layer  (9) layer[]  (10) layer-info[]  (11) color[]  (12) bookmark[]  (13) oneOf  (14) integer  (15) listOf  [1] number
  Default (Enter for none): 5
Option name (Enter when there are no more options):
Does it need to...
  know when its panel or expand opens and closes? [y/N] y
  save the user's data per app? [y/N] n
  convert its options before use (a configure hook)? [y/N] n
Add it to an app?
  (0) no
  (1) city-scene (City Scene)
  (2) default (ArcGIS Sidebar)
  ...
[0] 0
```

What the questions decide:

| Question | What it sets |
|---|---|
| Name | The folder, `extensions/trail-report/`, and the type's name in configs. It also sets the element's tag, `viewer-trail-report`, and its class, `TrailReport`. Built-in names and existing folders are refused. |
| Panel heading, Calcite icon | The sidebar heading and icon, which an expand button uses too. Unknown icon names are refused; see [Calcite icons](https://developers.arcgis.com/calcite-design-system/icons/). |
| Where can it go? | The manifest's [`placements`](manifest.md#placements). |
| How does it look in a map corner? | The manifest's [`cornerStyle`](manifest.md#cornerstyle). Only asked if it can go in corners. |
| Can it open from an expand button? | The manifest's [`expandable`](manifest.md#expandable). Only asked if it can go in corners. |
| Which views? | The manifest's [`views`](manifest.md#views). |
| Options | One per name, each with a [kind](option-kinds.md) and an optional default. Press Enter at the name to finish. For `oneOf` and `listOf` it asks for the values, and for `integer` the range. |
| Does it need to... | Each "yes" adds working, commented code: listeners for the [container events](guides/container-events.md), a note kept [per app](guides/saving-state.md), or a [`configure`](manifest.md#configure) hook. Each "no" leaves that code out. |
| Add it to an app? | Adds an entry for it at the end of that app's `components` in `public/apps/<app>.json`, without changing the rest of the file. With "no", it prints the entry to add yourself. |

Nothing is written until you've answered every question. Press Ctrl+C to stop without writing
anything. The scaffolder never replaces an existing file.

When it's done, it lists what it wrote:

```
Created extensions/trail-report/:
  component.ts
  index.ts
  TrailReport.ts
  README.md

To use it, add this entry to an app's components in public/apps/<app>.json:
  { "id": "trail-report", "type": "trail-report" }
```

| File | What it holds |
|---|---|
| `component.ts` | The [manifest](manifest.md): tag, how to load the element, options and defaults, panel heading and icon, placements, views, expand support and corner look. |
| `index.ts` | Defines the element. The manifest's `load` imports it the first time an app uses the type. |
| `TrailReport.ts` | The element. It finds the map, shows the map's scale and each option's value, and here also whether its panel is open. Every place to change is marked `// Your code:`. |
| `README.md` | The type's name, its options with their kinds and defaults, and config entries to paste. |

Check that it compiles:

```bash
npm run check
```

### Without the questions

Every question has a flag, and `--yes` takes the default for the rest. This makes the same
component without asking anything:

```bash
npm run new:component -- --name trail-report --icon walking --option minLength:number=5 --follows --yes
```

`npm run new:component -- --help` lists every flag.

## 2. See it in the viewer

### In a sidebar panel

Open an app's config, such as `public/apps/default.json`, and add the entry to the end of its
`components`:

```json
{ "id": "trail-report", "type": "trail-report" }
```

Save, then open `http://localhost:5173/?app=default`. The sidebar has a new icon, a person
walking. Press it: the Trail report panel opens, showing the map's scale, `minLength` 5, and
"Panel: Open". Close the panel, and it says "Closed".

To give the option another value, set it in the entry:

```json
{ "id": "trail-report", "type": "trail-report", "options": { "minLength": 8 } }
```

A wrong value, such as `"minLength": "long"`, stops the app with an error that names the setting:
`components[10].options.minLength: Expected a number.` (10 is the entry's position in the list,
counting from 0).

### In a map corner

Give the entry a corner placement:

```json
{ "id": "trail-report", "type": "trail-report", "placement": "top-right" }
```

It shows in the map's top-right corner, with a shadow and a panel's width.

### Behind an expand button

Add `"expand": true`:

```json
{ "id": "trail-report", "type": "trail-report", "placement": "top-right", "expand": true }
```

The corner shows a button with the walking icon. Press it to open the component next to the
button; it says "Panel: Open" while it's open. Press the button again or Escape to close it.

Try it at phone size too (375 px wide, in your browser's device toolbar). The expand opens as a
sheet there. In a 3D app, such as `?app=city-scene`, check that it finds the scene.

## 3. Make it yours

Start in `TrailReport.ts`. The example rows show how things work; replace them with your
component's content.

- **Options:** each option has a getter and a setter. The viewer sets them from config before
  adding the element to the page. React to new values where the setter says `// Your code:`.
  To add an option later, add it to `options` (and `defaults`) in `component.ts`, then add a
  property for it to the element. See [option-kinds.md](option-kinds.md).
- **The map:** `#follow` waits for the view and watches its scale. Watch what your component
  needs instead. See [Finding the map](guides/finding-the-map.md).
- **Opening and closing:** `#containerChanged` runs when the panel or expand opens or closes.
  See [Container events](guides/container-events.md).
- **Look:** use Calcite components and tokens only. See [Look and feel](guides/look-and-feel.md).
- **The README:** describe what the component does, and each option.

After each change, the dev server reloads the page. Run `npm run check` before you commit.

## Starting from hello-world instead

You can also copy the template by hand. Everything you change is inside the copy.

1. Copy `extensions/hello-world/` to `extensions/my-component/`. The folder's name is the type's
   name, so use lowercase words joined by hyphens.
2. In the copy, rename `HelloWorld.ts` to `MyComponent.ts`. In it, rename the class
   `HelloWorld` to `MyComponent`, and change the entry at the bottom to
   `"viewer-my-component": MyComponent;`.
3. In `index.ts`, import `MyComponent` from `./MyComponent.ts`, and define it as
   `viewer-my-component` in both places:

   ```ts
   import { MyComponent } from "./MyComponent.ts";

   if (!customElements.get("viewer-my-component")) customElements.define("viewer-my-component", MyComponent);
   ```

4. In `component.ts`, set `tag: "viewer-my-component"`, and give it its own heading:
   `panel: { heading: "My component", icon: "code" }`.
5. Keep `format.ts` for your own logic, or delete it and its import.
6. Run `npm run check`, then add `{ "id": "mine", "type": "my-component" }` to an app's
   `components`. The sidebar shows a panel headed "My component".

To know when its panel or expand opens and closes, add listeners in `MyComponent.ts`. Import the
event names from `"viewer"`, next to `findViewElement`:

```ts
import { findViewElement, PANEL_CLOSE, PANEL_OPEN, type ViewElement } from "viewer";
```

and add them at the end of the constructor:

```ts
this.addEventListener(PANEL_OPEN, () => console.log("my-component opened"));
this.addEventListener(PANEL_CLOSE, () => console.log("my-component closed"));
```

Place it behind an expand button with
`{ "id": "mine", "type": "my-component", "placement": "top-right", "expand": true }`. Opening and
closing the expand logs both messages, as opening and closing a sidebar panel does. See
[Container events](guides/container-events.md).

## Next

- [The manifest](manifest.md), every field.
- [The viewer API](viewer-api.md), what `"viewer"` offers.
- [Sharing](sharing.md), working in a fork, and fixing a folder the viewer skips.
