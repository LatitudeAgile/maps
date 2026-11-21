# Design

## Context

See proposal.md (Why) for motivation and `specs/map-menu/spec.md` for behavior.

What the viewer and the SDK already give this change:
- **CMV's menu** (`D:\git\cmv-app-4x`, read-only reference) was one dijit `Menu` on the view's root,
  handed to each widget whose options said `mapViewRightClickMenu: true`. Each widget saved the
  clicked point itself, through three different events (`click` with `button == 2`,
  `pointer-down`, `mousedown`), so items could act on different points, and nothing removed an
  item when its widget went away. This design keeps the shared menu and fixes those two problems.
- **SDK 5.2 events** (from the installed typings): `arcgisViewClick` carries `button` (2 is a
  right-click), `pointerType` (since 5.2), `x`, `y` and `mapPoint`. `arcgisViewHold` exists for a
  press and hold.
- **Calcite 5.2.1**: `calcite-dropdown` positions itself from a `referenceElement`, which may be a
  virtual element (`VirtualElement | Element`, from Calcite's floating-ui types). Its `trigger`
  slot is deprecated since 5.1. `calcite-dropdown-group` takes a `groupTitle`.
- **Component elements** carry `data-component-id` (`src/components/createComponents.ts`), so the
  menu can match a registered element to its config entry and heading. A panel's component is
  created and connected whether or not its panel is open, so its items exist from startup.
- **`requestPanelOpen`** (`src/sidebar/panelEvents.ts`) opens the panel or expand that holds an
  element. Directions holds its `RouteLayer` on the element (`src/components/directions.ts`).
- **Geocoding**: `DEFAULT_GEOCODER_URL` (`geocode.arcgis.com`) answered a keyless
  `reverseGeocode` on 2026-11-21, as it does suggestions and searches.
- **Coordinates**: `geometry/coordinateFormatter` is a core module in 5.2, not deprecated, with
  `toLatitudeLongitude` (`dd`, `ddm`, `dms`), `toMgrs`, `toUsng` and `toUtm`. It loads
  WebAssembly through `load()` and expects a point in a geographic coordinate system.
- **Notices** (`src/ui/notices.ts`) have the kinds `danger` and `warning` only.

## Goals / Non-Goals

**Goals:**
- Work out the spot once per opening and give every item the same spot.
- Let built-in components and extensions add items the same way, through one registry.
- Load nothing extra for the default menu: the locator, the coordinate formatter and the
  projection code load the first time an item needs them.
- Keep the menu's code out of every component, apart from the call that registers its items.

**Non-Goals:**
- Hit testing (which feature was clicked). No item in this change needs it, and it costs a
  request per layer in some views. An item that needs it can call `view.hitTest` from the
  context's `view`.
- Choosing single items of a component in `mapMenu` (`directions.add-stop`), and submenus.
- Exporting the drawing-tool hold (D9) through the viewer API. No extension draws on the map yet.

## Decisions

### D1. Modules

```
src/map/menu/
  openMenu.ts     listens on the view element: right-click, hold, keyboard (D2); builds the context (D3)
  registry.ts     groups added by components and extensions, keyed by element (D5)
  renderMenu.ts   one calcite-dropdown per view element, filled per opening (D4)
  contents.ts     config + registry + context -> groups to show (D6)
  builtInItems.ts whats-here, copy-coordinates, center-here (D7)
  coordinates.ts  point -> text in a format; loads the formatter and projection lazily (D7)
  linkItems.ts    URL template filling (D10)
  hold.ts         the drawing-tool hold (D9)
src/config/mapMenu.ts  validation and normalization of `mapMenu` (D6)
```

`createMap` starts the menu once the view is ready, unless `mapMenu` is `false`. The registry is
app-wide: an app has one view element, and components in the sidebar sit outside it, so they
can't register against the view element they're nested in.

### D2. Opening from the view's click, not the DOM's contextmenu

- **Mouse:** `arcgisViewClick` with `button === 2`. The view emits `click` only for a press and
  release without a drag, so a right-drag that rotates or tilts never opens the menu. The DOM
  `contextmenu` event is used only to call `preventDefault()` on the view element, so the
  browser's menu doesn't appear. On Windows, `contextmenu` fires on mouse-up, after a drag too,
  which is why it can't be the trigger.
- **Touch and pen:** `arcgisViewHold` when `pointerType !== "mouse"`. A held mouse button is left
  alone.
- **Keyboard:** a `keydown` listener on the view element for the `ContextMenu` key and Shift+F10.
  The spot is the view's center (`view.center`, or in 3D `view.toMap` at the middle of the view
  minus its padding, so the spot isn't under the sidebar). Both keys also fire a `contextmenu`
  event, already cancelled by the first rule.
- No `mapPoint` (the sky in 3D) means no menu.

Alternative considered: `contextmenu` as the trigger, with a movement threshold between
`pointerdown` and `contextmenu`. It needs its own drag tracking and differs by OS; the view's
click event has already solved that.

**Unverified:** that `arcgisViewClick` with `button === 2` doesn't fire after a right-drag in a
`SceneView`, and that `arcgisViewHold` fires for touch on the phones in use. Check both in the
browser before building on it. If the click does fire after a rotate, fall back to the threshold.

### D3. The context

Each opening builds one frozen context, passed to every item's `appliesTo` and `run`:

```ts
interface MapMenuContext {
  readonly mapPoint: Point;          // in the view's spatial reference
  readonly latitude: number;         // WGS84, worked out once (D7)
  readonly longitude: number;
  readonly screenPoint: { x: number; y: number };  // view coordinates
  readonly view: MapView | SceneView;
  readonly element: ViewElement;
}
```

This replaces CMV's per-widget saved points: every item sees the same spot.

### D4. Rendering with calcite-dropdown and a virtual reference

One `calcite-dropdown` per view element, appended to the view element so it inherits the color
mode. Its `referenceElement` is a virtual element whose `getBoundingClientRect()` is a zero-size
rect at the click point. `overlayPositioning="fixed"`, `placement="bottom-start"`, and
`flipPlacements` handle the edges. Each opening replaces its children with one
`calcite-dropdown-group` per group (`groupTitle` set for component groups) holding
`calcite-dropdown-item`s with `iconStart`. The dropdown gives arrow-key movement, Enter, Escape,
outside-click close and close on select.

To keep the menu off the phone's sidebar bar, the floating-ui boundary is limited to the map
minus its insets (`src/sidebar/insets.ts`). If Calcite doesn't take a boundary, the virtual rect
is clamped before opening instead.

The dropdown closes on `arcgisViewChange` (the map moved) and before a new opening.

Alternative considered: `calcite-popover` holding a `calcite-list`. It positions the same way,
but list items aren't menu items to a screen reader, and keyboard movement would be ours to
write. `calcite-menu` is for site navigation, with a fixed bar.

**Unverified:** that the dropdown opens and positions with only a virtual `referenceElement` and
`open = true`, with no trigger. Check in the browser before building on it.

### D5. The registry and the viewer API

```ts
// exported from "viewer"
export interface MapMenuItem {
  id: string;                       // unique within the component
  label: string;
  icon?: string;                    // a Calcite icon name
  appliesTo?(context: MapMenuContext): boolean;
  run(context: MapMenuContext): void | Promise<void>;
}
export function addMapMenuItems(element: HTMLElement, items: readonly MapMenuItem[]): () => void;
export type { MapMenuContext, MapMenuItem };
```

- Calling it again for the same element replaces that element's items. The returned function
  removes them.
- At each opening, an element that isn't `isConnected` is skipped and dropped from the registry.
  An extension that forgets to remove its items when it leaves the page therefore never shows
  stale items.
- The group's heading is the component's heading: its `panel.heading` from config, or the type's
  default panel heading, found through `data-component-id`.
- `appliesTo` that throws counts as `false`, and the error is logged.
- `run` is awaited. On a throw or a rejection, a danger notice names the item (spec: A failing
  item doesn't break the menu).

Adding exports doesn't change `API_VERSION` (see `src/components/api.ts`). The registry module
has no runtime imports from the components registry, so `api.ts` can re-export it without the
cycle its header warns about.

Directions (built-in) calls the same internal function from `configureDirections`. Built-in and
extension items take one path.

### D6. The `mapMenu` setting

Shape:

```jsonc
"mapMenu": false                                    // off
"mapMenu": [
  "whats-here",                                     // built-in, by id
  { "id": "copy-coordinates", "format": "mgrs" },   // built-in with options
  "directions",                                     // a component's id: all its items, as a group
  { "id": "street-view", "label": "Street View",    // link item
    "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}" }
]
```

Validation (`src/config/mapMenu.ts`) runs after `components`, so it knows the component ids:
- `false`, or a non-empty array. Anything else is an error at `mapMenu`.
- A string entry becomes `{ id }`.
- An object with `url` and no built-in or component `id` is a link item (D10). Built-in options
  are checked per item: `whats-here.url` is https, and `copy-coordinates.format` is one of the six
  formats.
- Unknown options on a built-in entry are warned about and dropped, as component options are.
- Duplicate ids are an error. An id that is neither built-in, a component's, nor a link item is a
  warning, and the entry is dropped.
- With no `mapMenu`, normalization yields the default: the three built-ins, then every component
  id in component order. Components that add no items show nothing, so listing them all is
  harmless.

Contents at each opening (`contents.ts`): walk the normalized list. A run of built-in and link
entries forms one unlabeled group. A component entry becomes its own group, from the registry,
filtered by `appliesTo`. Empty groups are dropped. A component left out at startup (keyless,
unsupported view) has no element and no items, so it is skipped without a warning (spec). If
every group is empty, no menu opens.

`mapMenu` is added to the recognized top-level settings and to the config types.

### D7. Built-in items

- **What's here?** (`whats-here`, icon `pin-tear`): `rest/locator.locationToAddress(url,
  { location: mapPoint })`, with `url` from the entry or `DEFAULT_GEOCODER_URL`. No key is
  scoped to it, as for search. It opens the view's popup at the spot, titled with the address's
  `ShortLabel`, with `LongLabel` as content. A "no match" error (HTTP 400, code 500 for no
  address) opens the popup saying no address was found here. Any other failure shows a danger
  notice. The popup is the SDK's, so it docks as other popups do (`src/map/popupDock.ts`).
- **Copy coordinates** (`copy-coordinates`, icon `copy-to-clipboard`): `dd` is built from the
  context's latitude and longitude, `toFixed(6)`, with no WebAssembly. Other formats load
  `coordinateFormatter` once and pass a WGS84 point. `navigator.clipboard.writeText` writes it. A
  new `success` notice kind (Calcite `kind="success"`, closable, `autoClose` at its default
  duration) shows the text. On a refusal, a warning notice shows the text so it can be copied by
  hand.
- **Center here** (`center-here`, icon `zoom-to-object`): `view.goTo({ center: mapPoint })` in
  2D. In 3D, `goTo({ target: mapPoint })`, keeping the camera's tilt and heading. Unverified that
  `target` with a point keeps them; if not, build a camera from the current one moved to the spot.

The context's latitude and longitude come from `mapPoint.latitude`/`longitude` when the view is
Web Mercator or WGS84. Other spatial references load `geometry/operators/projectOperator` once
and project to WGS84 before the menu opens. That's one await on the first opening in such an
app only.

### D8. Directions items

`configureDirections` registers three items on its element:

| id | label | icon | applies | run |
|---|---|---|---|---|
| `from-here` | Directions from here | `beginning` | always | set or replace stop 0 |
| `to-here` | Directions to here | `end` | always | set or replace the last stop (add one if only one) |
| `add-stop` | Add stop here | `add-in-new` | 2+ stops | insert before the last stop |

Each `run` calls `requestPanelOpen(element)` first, then edits `element.layer.stops`, naming the
stop with the coordinates to five places. When the route has a start and an end, it solves.

**Unverified:** whether `arcgis-directions` re-solves and refreshes its list when `layer.stops`
changes, or needs a call. CMV called its own `doRoute`. Check in the browser before building on it. If it
doesn't, solve with `layer.solve()` and `layer.update(result)`, and confirm the stop list in the
panel shows the new stops.

Icon names are to be checked against Calcite's icon set in the browser.

### D9. The drawing-tool hold

`hold.ts` keeps a set of owners. While it isn't empty, a right-click or hold doesn't open the
menu (the browser menu stays suppressed). The built-in sketch and measure modules add themselves
while drawing: sketch on its `arcgisCreate`/`arcgisUpdate` start and complete events (or its
`state` being `active`), and measure while its tool is measuring. It is internal for now (see
Non-Goals).

Alternative considered: querying the DOM for an active `arcgis-sketch` at each opening. It
couples the menu to component tags and misses measure's state.

### D10. Link items

- `id`, `label` (non-empty), `url`, and an optional `icon` (default `launch`).
- Validation fills `{lat}` and `{lon}` with `0` and parses the result. It must be an absolute
  `https:` URL.
- At run, each placeholder is replaced with `encodeURIComponent(value.toFixed(6))`, and
  `window.open(url, "_blank", "noopener")` opens it.
- No other placeholders in this change. `{zoom}` or `{scale}` can be added later without breaking
  configs.

### D11. hello-world and the docs

hello-world registers "Say hello here" (icon `smile`) in `connectedCallback` and removes it in
`disconnectedCallback`. Its `run` requests its panel open and shows the greeting with the spot.
`docs/components/viewer-api.md` documents `addMapMenuItems`, `MapMenuItem` and `MapMenuContext`.
A new `docs/components/guides/map-menu.md` covers adding, `appliesTo`, removal, and how `mapMenu`
orders or leaves out a component's group.

### D12. Sample apps

`field-notes` ("Find a place and mark it up") gets a `mapMenu` with the built-ins, a Street View
link item and its components. It shows link items and ordering. Other sample apps keep the
default menu, so their right-click behavior is the default one.

## Risks / Trade-offs

- [The view's right-click `click` fires after a rotate in 3D] → Checked in the browser first. Fallback:
  a movement threshold between `pointerdown` and `pointerup` (D2).
- [Calcite dropdown doesn't open without a trigger] → Checked in the browser first. Fallback: `calcite-popover`
  with a virtual reference and a `calcite-list` with our own arrow keys (D4).
- [Every app's right-click changes at once] → Expected (proposal, Users). An app can set
  `"mapMenu": false`. Rollback is the same setting, or reverting the change.
- [What's here? sends the spot to `geocode.arcgis.com`, which an offline Enterprise deployment
  can't reach] → Set `whats-here.url` to the organization's own GeocodeServer, or leave the item
  out with a `mapMenu` list. Nothing is sent until the user picks the item.
- [Link items send coordinates to third-party sites] → Only when the user picks one, and only
  ones the app's author configured. The app author owns that choice.
- [A component's items become stale after its element is replaced] → Disconnected elements are
  dropped at each opening (D5).
- [The coordinate formatter's WebAssembly fails to load (old browser, strict CSP)] → The item
  shows a warning notice with decimal degrees instead of failing silently.
- [A long press conflicts with another hold use in the future] → Nothing in the viewer uses hold
  today. Revisit if something does.

## Migration Plan

No data migration. Apps without `mapMenu` get the default menu on the next deploy. Deployers who
want the browser's menu back set `"mapMenu": false`. The change adds viewer API exports without
raising `API_VERSION`, so existing extensions load unchanged.

## Open Questions

- Final icon choices for the items (D7, D8, D11), picked by eye in the browser.
- The exact wording of the What's here? popup when nothing is found, and of the copy notices.
