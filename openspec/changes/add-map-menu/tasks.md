# Tasks

Browser checks run on the dev server (`npm run dev`), at 1280x800 unless stated, driven by a
Playwright script in the session's scratchpad (not the repository). 2D checks use the default app,
and 3D checks use the city-scene app. Touch checks use the browser's phone emulation at 390x844.
Scratch app files used for checks go in `public/apps/` and are deleted afterward, not committed.
Clipboard checks grant the page clipboard permission. Anything that differs from the design goes
in `notes.md` in this change.

## 1. Check the unverified SDK and Calcite behavior (design D2, D4)

- [ ] 1.1 In a throwaway listener on the view element, log `arcgisViewClick` (`button`, `pointerType`, `mapPoint`), `arcgisViewHold` and the DOM `contextmenu` event. Verify in the browser: a right-click logs one click with `button` 2 in 2D and 3D; a right-drag that rotates the 3D camera, and one in 2D, logs no click; a long press under touch emulation logs a hold with `pointerType` `"touch"`; a right-click on the 3D sky logs a click with no `mapPoint`. Record the results in `notes.md`. If a click fires after a drag, plan D2's movement-threshold fallback there before going on.
- [ ] 1.2 In the same scratch code, open a `calcite-dropdown` with one group and two items, with only a virtual `referenceElement` at a clicked point and `open = true`. Verify in the browser: it opens at the point, flips near the bottom-right corner, moves focus with the arrow keys, closes on Escape and on an outside click, and uses dark colors in dark mode. Record the results in `notes.md`, and whether Calcite takes a floating-ui boundary (D4). If it doesn't open without a trigger, plan D4's popover fallback there. Remove the scratch code, and verify with `npm run check`.

## 2. The `mapMenu` setting (`map-menu`, `viewer-config`; design D6)

- [ ] 2.1 Add `src/config/mapMenu.ts` and the config types: `false` or a non-empty list; strings normalized to `{ id }`; built-in options (`whats-here.url`, `copy-coordinates.format`) checked, unknown options warned about and dropped; link items checked (D10); duplicates an error; unknown ids a warning and dropped; the default list when absent. Run it after `components`, and add `mapMenu` to the recognized top-level settings. Verify with `npm run check`, and in the browser with scratch apps: the scenarios "Not https" (What's here?), "Unknown format", "No label", "Not https" (link items), "Built-in item as a string or an object", "Typo", "Duplicate", "Empty list", and the viewer-config scenario "Map menu setting".

## 3. The menu shell (`map-menu`; design D1-D5, D9)

- [ ] 3.1 Add `src/map/menu/registry.ts`, `hold.ts` and `contents.ts`: groups keyed by element, replaced on re-registration and removed by the returned function; disconnected elements dropped at each opening; headings from `data-component-id`; `appliesTo` that throws counts as false and is logged; groups built from the normalized `mapMenu`, empty ones dropped. Verify with `npm run check`.
- [ ] 3.2 Add `openMenu.ts` and `renderMenu.ts`, started from `createMap` once the view is ready unless `mapMenu` is `false`: right-click from `arcgisViewClick` with `button` 2, hold for touch and pen, the ContextMenu key and Shift+F10 at the view's padded center, `contextmenu` cancelled on the view element, no menu without a `mapPoint` or with empty contents, the frozen context (D3) with WGS84 latitude and longitude (projecting lazily for other spatial references), the dropdown from D4 kept inside the map's insets, and closing on select, Escape, outside click, `arcgisViewChange` and a new opening. Until task 4 adds the built-ins, check it with a temporary item. Verify with `npm run check`, and in the browser: the scenarios "Right-click in 2D" (menu opens next to the pointer, no browser menu), "Rotate a scene with the right button", "Long press on a phone", "Escape returns to the map", "Click elsewhere", "Right-click again", "Right-click the sky", "Near the bottom-right corner" (also at 390x844 with the sidebar bar), "Dark mode" and "Turned off".

## 4. Built-in items (`map-menu`; design D7)

- [ ] 4.1 Add the `success` notice kind to `src/ui/notices.ts` (closable, Calcite `autoClose`), and add Copy coordinates with `src/map/menu/coordinates.ts`: `dd` from the context without WebAssembly, other formats through `coordinateFormatter` loaded once, the clipboard write, and the warning notice with the text when it's refused. Verify with `npm run check`, and in the browser: the scenarios "Copy in decimal degrees", "MGRS", "Degrees, minutes and seconds" and "Clipboard refused" (deny the permission); the network tab shows no formatter WebAssembly loaded for `dd`; and the success notice closes with its button.
- [ ] 4.2 Add Center here. Check whether `goTo({ target })` keeps a 3D camera's tilt and heading, and use D7's camera fallback if not. Note the result in `notes.md`. Verify with `npm run check`, and in the browser: the scenario "Center in 2D", and in city-scene that the camera's tilt and heading are unchanged after Center here.
- [ ] 4.3 Add What's here? with `rest/locator`: the configured or default geocoder, no token, a popup at the spot with the address, the "no address found" popup, and a danger notice for other failures. Verify with `npm run check`, and in the browser: the scenarios "Address found", "Nothing found", "Service fails" (block the geocoder's host), "Works without a key" (a build without the key), "Own geocoder" (the request goes to the configured URL with no `token`, seen in the network tab), and "Right-click in 3D". Check that the popup docks on a phone as other popups do. With task 4 done, "Right-click in 2D" lists the three built-ins in order; check it again, and remove the temporary item from 3.2.

## 5. Link items (`map-menu`; design D10)

- [ ] 5.1 Add `src/map/menu/linkItems.ts`: placeholders filled with six decimal places and URL-encoded, opened in a new tab with `noopener`, default icon `launch`. Verify with `npm run check`, and in the browser with a scratch app: the scenario "Street View" (the new tab's URL matches exactly), and "Chosen order" with a link item between built-ins.

## 6. Extension items, the viewer API and hello-world (`map-menu`, `custom-components`; design D5, D11)

- [ ] 6.1 Export `addMapMenuItems`, `MapMenuItem` and `MapMenuContext` from `src/components/api.ts`, keeping `API_VERSION` at 1 and adding no runtime import of the components registry. Run each item's `run` with a danger notice naming the item on a throw or rejection. Document the exports in `docs/components/viewer-api.md` with an example of each. Verify with `npm run check`, and in the browser with a scratch extension whose item throws: the scenario "Item throws"; and that `buffalo-river` and `tracks` load unchanged ("API version unchanged").
- [ ] 6.2 Add "Say hello here" to `extensions/hello-world/`: registered in `connectedCallback`, removed in `disconnectedCallback`; its `run` requests its panel open and shows the greeting with the spot's latitude and longitude to two places. Verify with `npm run check`, and in the browser: the scenarios "Says hello from the map menu", "Extension item", "Element removed" (remove the element from the console), "Map menu item from an extension" in 2D and 3D, and "Uses only the viewer API" (read the folder's imports).
- [ ] 6.3 Write `docs/components/guides/map-menu.md`: adding items, `appliesTo`, removing items when the element leaves, and how an app's `mapMenu` orders or leaves out the component's group. Link it from `docs/components/README.md` and from hello-world's README. Verify by following the guide to add an item to a copy of hello-world in a scratch folder under `extensions/`, which then appears in the menu, and delete the copy. Also verify the scenario "Map menu guide".

## 7. Directions items (`map-menu`; design D8)

- [ ] 7.1 Register From here, To here and Add stop here in `configureDirections`, with Add stop here applying at two or more stops. Each opens the panel with `requestPanelOpen`, then sets its stop. Check whether `arcgis-directions` re-solves and lists stops set on `layer.stops`, and use D8's `solve`/`update` fallback if not. Note the result in `notes.md`. Verify with `npm run check`, and in the browser with a key that has the Routing privilege: the scenarios "Default groups with Directions", "From here, then to here", "Replace the start", "Add a stop" and "No route yet"; and, with a build without a key, "Built without a key" and "Left-out component". Check the item icons by eye and note any change from D8.

## 8. Drawing tools keep their right-click (`map-menu`; design D9)

- [ ] 8.1 Add the sketch and measure modules to the hold while they draw. Verify with `npm run check`, and in the browser: the scenario "Right-click while sketching"; the menu opens again once the polygon is finished or cancelled; and the same while measuring a distance in half-dome (3D) and survey-tools (2D).

## 9. Sample apps (design D12)

- [ ] 9.1 Give `public/apps/field-notes.json` a `mapMenu`: the three built-ins, a Street View link item, then its components' ids in their order. Verify in the browser: the menu shows the built-ins, Street View, then any component groups; Street View opens the panorama URL for the spot; and the app logs no config warning.
- [ ] 9.2 In `extensions/buffalo-river/BuffaloRiver.ts`, make the map click handler act on the left button only (`event.button === 0`), so a right-click on an access point opens the map menu without changing the trip. Verify with `npm run check`, and in the browser in the Buffalo River app: a left click on an access point still starts and completes a trip; a right-click on an access point opens the map menu, and the trip and the open panel stay as they were.

## 10. User docs and changelog

- [ ] 10.1 Document `mapMenu` in `docs/configuration.md`: the default menu, `false`, a list's ids (built-ins, component ids, link items) and their order, the built-in items' options (`whats-here.url`, `copy-coordinates.format` and its six formats), link items and their `{lat}` and `{lon}` placeholders, what What's here? and link items send and where, and the validation errors and warnings. Add `mapMenu` to the list of top-level settings. Verify that each documented example passes validation in a scratch app.
- [ ] 10.2 Add an "Added" entry under `[Unreleased]` in `CHANGELOG.md` for the map menu, its built-in, Directions and link items, the `mapMenu` setting, and the viewer API's `addMapMenuItems`, noting that every app's right-click changes and that `"mapMenu": false` turns it off. Verify by reading it.

## 11. Integration checks

- [ ] 11.1 Run `npm run check` and `npm run build`, and open the built app with `npm run preview`. Verify in the built app: every sample app in the catalog opens with no config warning or console error, the menu opens in each, and Copy coordinates and What's here? work in one 2D and one 3D app.
- [ ] 11.2 At 390x844 under touch emulation, in light and dark mode, with the sidebar's bar showing: open the menu by long press near each edge of the map. Verify that it never sits under the bar or off screen, that picking an item works, and that a pan with one finger never opens the menu.
- [ ] 11.3 Keyboard pass in the default app: Tab to the map, open the menu with the ContextMenu key and with Shift+F10, run each built-in item from the keyboard, and close with Escape. Verify that focus returns to the map each time and that the scenario "Open and pick from the keyboard" holds.

## Workflow follow-up

- Archive the change after review, then check that the new `map-menu` spec and the updated
  `viewer-config` and `custom-components` specs read correctly under `openspec/specs/`.
