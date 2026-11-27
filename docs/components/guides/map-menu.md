# Adding map menu items

The map menu opens when the user right-clicks the map, long-presses it on a touch screen, or
presses Shift+F10 or the ContextMenu key with the map focused. It lists actions for that spot:
the viewer's own (What's here?, Copy coordinates, Center here), then one group for each
component that adds items. Your component can add its own, with `addMapMenuItems` from
`"viewer"`.

## Adding an item

Add your items when your element is connected, and remove them when it leaves the page. The
items appear in one group, headed with your component's heading: the config entry's
`panel.heading`, or your manifest's `panel.heading`.

```ts
import { addMapMenuItems, requestPanelOpen, type MapMenuContext } from "viewer";

export class TrailReport extends HTMLElement {
  #removeMenuItems: (() => void) | undefined;

  connectedCallback(): void {
    this.#removeMenuItems = addMapMenuItems(this, [
      {
        id: "report-here",
        label: "Report a problem here",
        icon: "exclamation-mark-triangle",
        run: (context) => this.#report(context),
      },
    ]);
  }

  disconnectedCallback(): void {
    this.#removeMenuItems?.();
    this.#removeMenuItems = undefined;
  }

  #report({ latitude, longitude }: MapMenuContext): void {
    // Open this component's panel or expand, so the user sees what happened.
    requestPanelOpen(this);
    // ...start a report at latitude, longitude
  }
}
```

- `id` only needs to be unique among your own items.
- `icon` is a [Calcite icon](https://developers.arcgis.com/calcite-design-system/icons/) name.
- `run` gets the spot: `mapPoint` (in the view's spatial reference), `latitude` and `longitude`
  (WGS84 degrees), `screenPoint`, `view` and `element`. Every item of one opening gets the same
  spot. It may return a promise.
- If `run` throws or rejects, the viewer closes the menu and shows a notice naming your item. The
  map and the menu keep working.
- Calling `addMapMenuItems` again for the same element replaces its items: use that when your
  items change.

hello-world does this with its "Say hello here" item, in `extensions/hello-world/HelloWorld.ts`.

## Hiding an item where it doesn't apply

Give the item an `appliesTo(context)`. The menu calls it each time it opens, and lists the item
only when it returns `true`. Keep it quick: it runs before the menu shows.

```ts
{
  id: "add-stop",
  label: "Add stop here",
  icon: "add-in-new",
  // Only once there's a route to add a stop to.
  appliesTo: () => this.stops.length >= 2,
  run: (context) => this.#insertStop(context.mapPoint),
}
```

If `appliesTo` throws, the item is left out and the error is logged. When none of your items
apply, your group isn't shown.

## Removing items

The function `addMapMenuItems` returns removes your items. Call it in `disconnectedCallback`, as
above. If your element leaves the page without calling it, the menu drops its items anyway the
next time it opens, so a removed component never leaves items behind.

## How an app orders or leaves out your items

Without a `mapMenu` setting, the menu shows the viewer's items, then each component's group in
the order of the app's `components`. An app's `mapMenu` list chooses what appears and in what
order, and refers to your group by your component's `id` in that app:

```json
"components": [
  { "id": "reports", "type": "trail-report", "placement": "panel" }
],
"mapMenu": ["reports", "copy-coordinates"]
```

That shows your group first, then Copy coordinates, and nothing else. An app that leaves your
`id` out of its list doesn't show your items. `"mapMenu": false` turns the whole menu off. See
[configuration.md](../../configuration.md) for the setting.

## While your component draws on the map

If your component uses right-clicks on the map itself, such as a drawing tool, the menu would
open over it. The viewer's Sketch and Measure keep the menu closed while they draw. That isn't
in the viewer API yet: if your component needs it, ask for it.
