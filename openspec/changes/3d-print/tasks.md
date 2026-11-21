# Tasks

Browser checks run on the dev server (`npm run dev`) at 1280x800 unless stated, and the load
checks in group 6 also run on `npm run preview`. Scratch app files used for checks go in
`public/apps/` and are deleted afterward, not committed. The source to port is in
`D:\git\StewardshipOS` (`src/print/`, `electron/main/geopdf.ts`, and the print parts of
`src/components/HouseholdMap.vue` and `MapPrintPanel.vue`). Anything that differs from the
design goes in `notes.md` in this change.

## 1. Type, panel and options (design D1, D2)

- [ ] 1.1 Add the `print-map` registry entry from D1, with `load: () => import("./printMap/index.ts")` and no other import from `printMap/`. Add `printMap/index.ts` and an empty `PrintMapPanel.ts` element `<viewer-print-map>`. Verify with `npm run check`, and that a scratch 2D app and a scratch 3D app each show a Print map panel.
- [ ] 1.2 Build the controls in `PrintMapPanel.ts` with Calcite:
  - a title input;
  - Landscape and Portrait;
  - PDF layout and Map image;
  - an Export button;
  - a notice area.

  Start them from the `title` (else the app's title), `orientation` and `format` options. Verify in the browser the scenarios "Defaults" and "Configured", and "Invalid orientation" in the config error screen.
- [ ] 1.3 Check the corner placement. Verify the scenario "In a corner" with `bottom-left` and `"expand": true`, and that the expand opens clear of the map's edge.

## 2. Print area (design D6)

- [ ] 2.1 Port the page geometry and scale bar from `mapPage.ts` into `printMap/page.ts`, unchanged except for types. Verify with `npm run check`, and that `mapPage(true)` gives a map 10 by 6.25 in and `mapPage(false)` 7.5 by 8 (log them in the browser console).
- [ ] 2.2 Add `printMap/frame.ts`: the overlay over the view on `PANEL_OPEN`, removed on `PANEL_CLOSE`, sized from the view's padding and size, redrawn on orientation change, with `pointer-events: none`. Set the dim amount by eye in light and dark modes. Verify the scenarios "Frame while open", "Portrait frame" and "Frame gone when closed", in the panel and in a corner expand, and in 2D and 3D.

## 3. Capture and image export (design D5, D10)

- [ ] 3.1 Add `printMap/capture.ts`: `takeScreenshot` of the frame's area at 300 DPI as a JPEG. Wire Export for "Map image": busy state, the download through a temporary link, and the file name rule. Verify in the browser:
  - the scenario "Map image" (check the file's pixel size);
  - "File name";
  - "Busy";
  - that the downloaded picture matches the frame, in 2D and in the Buffalo River scene.
- [ ] 3.2 Add the error notice from D10. Verify the scenario "Capture fails" with a scratch app holding a layer served without CORS headers (or by making `takeScreenshot` throw a `SecurityError` from the console). Check that the choices are kept and that Export works after the layer is turned off.

## 4. Legend, scale and credits (design D7, D8, D9)

- [ ] 4.1 Add the corners and scale to `capture.ts`: the four `toMap` corners, the meters per inch across the middle, and the to-scale test (2D, or `camera.tilt <= 2`, with every corner on the ground). Add the panel's tilt notice, which follows a watch on `camera.tilt`. Verify in the browser that the notice shows at tilt 60 and goes at tilt 0 in the Buffalo River app, and that the logged ratio for a 2D view agrees with the `scale-bar` component within 2%.
- [ ] 4.2 Add `printMap/legend.ts`: walk the layers, apply the renderer rules, render swatches with `symbolUtils.renderPreviewHTML` into 300 DPI PNGs, and fit rows to the legend grid with "and N more". Verify by logging its rows in the browser: in the Buffalo River app, Access points and the river's level classes, and not the hidden layers; with Bluffs turned on, Bluffs too; and in redlands-parks, its web map's layers. The PDF checks are in 5.2.
- [ ] 4.3 Add the credits from D9. Verify by logging them: in the Buffalo River app, OpenStreetMap's credit, the elevation credit, the Wilderness Connect credit once the wilderness layers are on, and "Powered by Esri" at the end, with no repeats.

## 5. PDF and GeoPDF (design D4, D7)

- [ ] 5.1 Add `pdf-lib` (1.17.1) to `dependencies`. Add `printMap/pdf.ts`, loaded only by `await import("./pdf.ts")` from the export flow. It draws:
  - the Letter page with 0.4 in margins;
  - the title;
  - the map image;
  - the date;
  - the legend;
  - the ratio and scale bar, or "Not to scale";
  - the credits.

  Lines Helvetica can't encode are drawn as text images. Verify with `npm run check`, and in the browser the scenarios "Page layout", "No title", "Print from a map", "Print from a scene" (no print-service request in the network list) and "Tilted".
- [ ] 5.2 Check the legend on the page. Verify the scenarios "Visible layers only", "Turning a layer on adds it" and "Too many rows", the last with a scratch app of many unique-value classes. Also check a title in a non-Latin script reads correctly.
- [ ] 5.3 Add the GEO measure dictionary from `geopdf.ts` over the drawn image box, with D7's projection choice and no `Buffer`. Verify the scenarios "Located in a map app" and "Straight down": open a 2D and a straight-down 3D PDF in Adobe Acrobat (or Avenza Maps), and compare two picked points with the viewer's coordinates. Also check the "Scale matches the map" scenario on the printed page.
- [ ] 5.4 Document `print-map` in `docs/configuration.md`:
  - the type table row, with its options;
  - a "What printing sends" note, which is nothing;
  - its place in "2D and 3D" and in the expand types list.

  Add a line under P-60 in `docs/migration/dojo-sidebar-parity.md`. Verify the documented config examples pass validation in a scratch app.

## 6. Loading only what's used (design D2, D3)

- [ ] 6.1 Write D3's rule as a comment above the registry's type entries, and add the sentence about manifests to `docs/components/manifest.md`. Verify with `npm run check`.
- [ ] 6.2 Run `npm run build`, then check `dist/assets/`: `print-map`, `sketch`, `measure`, `bookmarks`, `hello-world` and `buffalo-river` each have their own file. `PDFDocument` appears only in the PDF chunk, not in the entry or the `printMap` chunk. Record the file names and sizes in `notes.md`. Verify by listing and searching the files.
- [ ] 6.3 On `npm run preview`, verify in the browser's network list the scenarios "Unused types aren't fetched" (redlands-parks), "Used type fetched when the app starts" (Buffalo River, after 7.1), "PDF library on first PDF" and "Extension types". Fix any static import that pulls a type's code into the entry, and note it in `notes.md`.

## 7. Sample apps

- [ ] 7.1 Add `print-map` to `public/apps/buffalo-river.json` as a sidebar panel after Bookmarks, and to `public/apps/default.json` next to `print`. Update each app's description. Verify both apps open with a Print map panel that exports a PDF, and that the Buffalo River print of Ponca to Kyles has the river, access points, legend and scale.
