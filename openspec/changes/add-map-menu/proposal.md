# Proposal

## Why

CMV, the 4.x viewer this project grew alongside, had a map right-click menu that its widgets added
items to: identify, get the address here, Street View, what3words, and a Directions submenu
(directions from here, to here, add a stop). People used it as the quickest way to act on a spot
on the map. The new viewer has nothing like it: every action starts from a panel. The viewer API
and the config engine are now stable enough for components, extensions and app config to add to
a shared menu. This isn't a dojo-sidebar parity item: dojo-sidebar never had a map menu.

## What Changes

- **Map menu (new).** Right-clicking the map, or a long press on touch, opens a menu of actions for
  that spot. A keyboard shortcut on the focused map opens it at the map's center. In 2D and 3D, it
  opens only on a click, never at the end of a right-drag that rotates or tilts the map. It uses
  Calcite components, with items in labeled groups and no submenus.
- **Built-in items (new), shown without any config:**
  - **What's here?** finds the address nearest the spot with the keyless World Geocoding Service and
    shows it in a popup at the spot. Its service can be set in config.
  - **Copy coordinates** copies the spot's latitude and longitude, as decimal degrees, to the
    clipboard, and says so in a notice. A `format` option in config can choose DMS, degrees and
    decimal minutes, MGRS, USNG or UTM instead.
  - **Center here** centers the map on the spot.
- **Directions items (new).** A `directions` component adds "Directions from here", "Directions to
  here" and "Add stop here". Each opens the Directions panel and sets that stop.
- **Link items (new), from config only.** An item with a label and a URL template such as
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}` opens that page for the
  spot in a new tab. It covers CMV's Street View and what3words items with no code.
- **`mapMenu` config (new).** Without it, the menu shows the built-in items and then each
  component's items, in component order. A `mapMenu` list chooses which entries appear and in what
  order, holds item options and link items, and `false` turns the menu off.
- **Viewer API (changed).** Extensions add their own menu items through `"viewer"`, with the same
  mechanism the Directions items use. Adding an export doesn't need a new API version.
- **hello-world (changed).** The template adds one menu item, so a copy shows how it's done.
- **Not in this change:** identify or popup items, "Add bookmark here", sketch or measure items,
  "use my location" items, choosing single items of a component in `mapMenu`, and submenus. Each
  can be a later change.

## Capabilities

### New Capabilities

- `map-menu`: the map menu. Covers how it opens by mouse, touch and keyboard and when it doesn't, its
  look and keyboard use, the built-in items (What's here?, Copy coordinates and its formats, Center
  here), the Directions items, link items, the `mapMenu` setting and its validation, and how
  component and extension items appear and go away.

### Modified Capabilities

- `viewer-config`: `mapMenu` joins the recognized top-level settings.
- `custom-components`: the viewer API also lets an extension add map menu items, and the
  hello-world template adds one.

## Impact

- **New:** a map menu module under `src/map/` (opening, context, rendering), the built-in items,
  and `mapMenu` validation under `src/config/`.
- **Changed:** `src/components/api.ts` (new export), `src/components/directions.ts` (registers its
  items), the config types and validation, `extensions/hello-world/`, and `docs/components/`
  (viewer API page and a short guide to adding menu items).
- **Sample apps:** one sample app gets a `mapMenu` with a Street View link item, to show link items
  and ordering. The others keep the default menu.
- **SDK modules:** `rest/locator` for What's here?, and `geometry/coordinateFormatter` for the
  non-default copy formats, loaded only when one is configured. No `widgets/` imports.
- **External services:** What's here? sends the clicked spot to the configured geocoding service
  (by default `geocode.arcgis.com`, which reverse-geocodes without a key: probed 2026-11-21). Link
  items send the spot's coordinates to the site they open, only when the user picks them.
- **Dependencies:** none added.
- **Users:** every app gets the default menu. The browser's own context menu no longer appears over
  the map, unless an app sets `"mapMenu": false`.
