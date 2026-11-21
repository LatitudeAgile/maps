# Design

## Context

See proposal.md (Why) for motivation, and `specs/map-printing/spec.md` and
`specs/map-components/spec.md` for behavior.

What's there today:
- **`print`** is `arcgis-print`, registered with `views: ["2d"]` because it reports a
  `sceneViewError` in a scene. It stays as it is.
- **Built-in types with their own code** (`sketch`, `measure`) are custom elements under
  `src/components/<type>/`. The registry loads each with `load: () => import("./<type>/index.ts")`.
  The registry imports only small option modules from them (`sketch/palette.ts`,
  `measure/options.ts`), and `bookmarks` loads its configure code through a dynamic import as
  well.
- **Extensions:** the `viewer-extensions` virtual module imports each extension's manifest
  (`component.ts`) into the main bundle. Each manifest's `load` dynamically imports the
  extension's code.
- **The build already splits by type.** In today's `dist/assets/`, `bookmarks-*.js`,
  `sketch-*.js`, `arcgis-print-*.js`, `hello-world-*.js` and `buffalo-river-*.js` are separate
  files. The entry chunk holds only their registry entries and manifests.
- **Open and close:** a component learns its panel or expand opened or closed through the
  `PANEL_OPEN` and `PANEL_CLOSE` events (`src/sidebar/panelEvents.ts`, re-exported by the viewer
  API).
- **The source** is StewardshipOS (Electron and Vue):
  - `src/print/mapPage.ts`: Letter geometry, map shapes taken from Esri's ANSI A frames, a
    0.4 in margin, 300 DPI, the scale bar;
  - `src/print/mapLegend.ts`: legend and credits, specific to its ward layer;
  - `electron/main/geopdf.ts`: pdf-lib, adding the GEO measure dictionary to a PDF that
    Chromium printed;
  - `HouseholdMap.vue`: the print area, `takeScreenshot` and the corners from `view.toMap`;
  - `MapPrintPanel.vue`: the controls.

## Goals / Non-Goals

**Goals:**
- One print type that behaves the same in 2D and 3D, with no server.
- Keep the page geometry, scale bar and GeoPDF dictionary as ported code, so prints match
  StewardshipOS's.
- Load nothing for printing until an app uses `print-map`, and no PDF code until the first PDF.

**Non-Goals:**
- Paper other than Letter. The page geometry is keyed by paper, so A4 is a data addition later.
- North arrow, inset maps, several pages, or user-designed layouts.
- A print preview window. Export downloads the file; the browser's PDF viewer is the preview.
- A scale for tilted scenes. A perspective view has no single scale.
- Changing `print`, or printing through a print service from `print-map`.

## Decisions

### D1. A new type, `print-map`, next to `print`

`print-map` is its own type: panel heading "Print map", `print` icon, views `2d` and `3d`.
Placements are `panel` plus the corners, with `expandable: true`, `cornerStyle: "panel"` and
`expandMode: "floating"`, as `measure` has. Options:
- `title`: `string`;
- `orientation`: `{ oneOf: ["landscape", "portrait"] }`, default `landscape`;
- `format`: `{ oneOf: ["pdf", "jpg"] }`, default `pdf`.

*Alternative:* a `mode` option on `print`. That was rejected because the two share no options,
no views and no code. An option would make `print`'s view support depend on its options, which
the registry can't express.

### D2. Module layout and where the build splits it

```
registry.ts ──load()──> printMap/index.ts            chunk: printMap-*.js
                          defines <viewer-print-map>
                          PrintMapPanel.ts  (Calcite UI, open/close, export flow)
                          page.ts           (ported mapPage.ts: geometry, scale bar)
                          frame.ts          (print-area overlay)
                          capture.ts        (takeScreenshot, corners, scale)
                          legend.ts         (legend rows and credits)
                          ──import() on first PDF──> printMap/pdf.ts   chunk: pdf-*.js + pdf-lib
                                                       layout drawing, GeoPDF dictionary
```

`pdf.ts` is the only module that imports `pdf-lib`. `PrintMapPanel.ts` reaches it only through
`await import("./pdf.ts")`, and imports from it only types (`import type`). A JPEG export never
loads it. The registry imports nothing from `printMap/` but the `load` function.

*Alternative:* load pdf-lib with the panel. That was rejected because the spec asks for one
action's code to load with that action, and pdf-lib (about 500 KB unminified) would double what
opening the panel costs.

### D3. Keeping every type split (all types, not just print)

No build settings change: Rolldown already gives each dynamic `import()` its own chunk, and the
requirement holds today. What breaks it is a static import from code that's always loaded (the
registry, the sidebar, the viewer API, an extension manifest) into a type's module. So:
- **Rule:** the registry may import from a type's folder only small option modules that import
  nothing else, as `sketch/palette.ts` and `measure/options.ts` do. A type's code, and its
  libraries, load only through its `load` or `configure` dynamic imports.
- **Extension manifests** import only `"viewer"`, and keep their code behind `load`. That's
  already how the template and `buffalo-river` work; `docs/components/manifest.md` gets one
  sentence saying it is why.
- **Check:** after `npm run build`, open apps through `npm run preview` and compare the network
  list with the spec's scenarios. Also check that each type has its own file in `dist/assets/`,
  and that `pdf-lib` code appears only in the PDF chunk (search the files for a `pdf-lib`
  string such as `PDFDocument`).

*Alternative:* `build.rollupOptions.output.manualChunks` naming a chunk per type. Rejected: it
adds config to keep in step with the registry, and it can force shared SDK modules into the
wrong chunk. The default splitting already does the job.

### D4. The PDF is drawn with pdf-lib in the browser

`pdf.ts` builds the page directly:
1. A Letter page in points.
2. The map JPEG at the frame position from `page.ts`.
3. Text in the standard Helvetica font.
4. The legend swatches as PNGs.
5. The scale bar as rectangles and lines.
6. When the map is to scale (D7), the GEO measure dictionary from StewardshipOS's
   `addGeoViewport`, written over the map image's box.

The code knows where it drew the image, so the content-stream parser in `geopdf.ts`
(`mapImageBox`) isn't needed, and neither is its Node `Buffer`.

Helvetica covers only Western European characters (WinAnsi). Any line with a character it can't
encode, such as a non-Latin title, layer name or credit, is drawn as a 300 DPI image of that
text, rendered on a canvas in the page's font. Such a line can't be selected in the PDF, but it
reads correctly.

*Alternatives:*
- **`window.print()` with a print stylesheet.** Rejected: no GeoPDF, no control of margins or
  file name, and a print dialog instead of a file.
- **jsPDF.** Rejected: pdf-lib is what StewardshipOS's GeoPDF code uses, and one library does
  both jobs.
- **Embedding a full font (fontkit).** Rejected: about 1 MB more for a case the image fallback
  covers.

### D5. Capture with `takeScreenshot`

At export, `capture.ts` calls
`view.takeScreenshot({ area, width, height, format: "jpg", quality: 92 })`:
- `area` is the frame's rectangle in view pixels;
- `width` and `height` are the map frame's size in inches times 300, so 3000 by 1875 for
  landscape and 2250 by 2400 for portrait.

The SDK renders at that size, which works in `MapView` and `SceneView` alike. The same picture
is the JPEG output (spec: Map image) and the PDF's map. Popups and Calcite UI aren't in the
picture; sketches and highlights are, because they're drawn in the view.

### D6. The print area is an overlay sized from the view's padding

`frame.ts` adds an overlay over the view's container while the component is open, between
`PANEL_OPEN` and `PANEL_CLOSE`:
- it has `pointer-events: none`, so the map underneath still pans and zooms;
- the frame is a transparent box whose large spread `box-shadow` dims everything outside it.

The frame is the largest rectangle of the page's map shape (10:6.25 or 7.5:8) that fits in the
view less its padding (the open sidebar) and a 16 px inset, centered there, as in StewardshipOS.
It's recomputed when the view's size or padding changes, or the orientation changes. Colors
come from Calcite tokens. The dim is lighter than a modal's: `--calcite-color-transparent-scrim`
is 85% opaque, which hides the map. It is mixed down with `color-mix()` to about 40%, so the
surroundings stay readable for framing. The exact amount is set by eye in the browser, in light
and dark modes.

### D7. Scale, location and tilt

- **Corners:** the frame's four corners go through `view.toMap`. In 3D that's the ground under
  each corner. Then they're projected to longitude and latitude.
- **Scale:** the ground distance across the middle of the frame (great-circle, as in
  `distanceMeters`) divided by the map's printed width gives meters per inch. `scaleBars` turns
  that into the 1:N ratio and a miles bar about 1.5 in long.
- **To scale:** a 2D view always is, rotated or not, since the corners carry the rotation. A 3D
  view is when `camera.tilt <= 2`. Otherwise:
  - the page says "Not to scale";
  - there's no ratio, bar or GEO dictionary;
  - while the panel is open it shows a warning notice, which follows a watch on `camera.tilt`.

  If any corner misses the ground (`toMap` returns null), the print is treated as tilted.
- **GeoPDF projection:** Web Mercator (102100/3857) uses StewardshipOS's Esri WKT, kept because
  Acrobat reads it. WGS84 uses a GEOGCS WKT. Any other spatial reference uses its `wkt` when it
  has one; otherwise the GEO dictionary is left out and the page keeps its scale.

### D8. Legend from the layers' renderers

`legend.ts` walks `view.map.layers` from top to bottom, as the layer list shows them, and goes
into groups. It keeps layers that meet all of these:
- visible, with visible parent groups;
- within their scale range at the view's scale;
- `legendEnabled !== false` and `listMode !== "hide"`, which leaves out the viewer's own
  location and sketch layers.

What each renderer gives:
- **`simple`:** one row.
- **`unique-value`:** one row per `uniqueValueInfos` entry, with its label, plus the default
  symbol if it has one.
- **`class-breaks`:** one row per `classBreakInfos` entry.
- **Others** (heatmap, dot density, imagery, tiles, scene layers): the title alone.

Swatches come from `symbolUtils.renderPreviewHTML` (`@arcgis/core/symbols/support/symbolUtils.js`,
a core module, not a widget). It renders 2D, CIM, picture and 3D symbols. The result (an SVG,
an image or a canvas) is drawn to a canvas and saved as a PNG at 300 DPI.

The legend area has fixed columns and rows: landscape has 4 columns of 3 rows, portrait 3 of
4, as in `mapPage.ts`. When the rows don't fit, the last cell says "and N more".

### D9. Credits

The credits are the `copyright` of the basemap's base and reference layers, the ground's
elevation layers in 3D, and the visible operational layers. Each is cut to 100 characters at a
word, with HTML removed (StewardshipOS's `shortCredit`). Duplicates are dropped, the rest are
joined with " · ", and "Powered by Esri" ends the line, as on the map.

### D10. Export flow and errors

Export does the following:
1. Disable the button and set it to loading.
2. Capture (D5).
3. For a PDF, build the legend (D8) and credits (D9), then `await import("./pdf.ts")` and draw.
4. Save the result as a Blob through a temporary `<a download>` link.
5. Re-enable the button.

The file name is the title, or the app's title when it's empty, with characters Windows forbids
in file names replaced by `-`, plus `.pdf` or `.jpg`.

If any step throws, a `calcite-notice` in the component says "The map couldn't be printed.",
with "A layer's server doesn't allow its images to be copied." added when the error is a
`SecurityError` (a tainted canvas). The choices stay as they were.

## Risks / Trade-offs

- **[Risk] Large captures fail on low-memory devices** (a 3000 by 1875 render in a 3D scene).
  → The failure shows D10's notice and the app keeps working. A lower-DPI retry can be added
  later without changing the spec's outcome on desktops.
- **[Risk] A perspective scene isn't truly orthographic, even looking straight down.** Scale
  drifts with terrain height across the frame. → The GeoPDF uses the four ground corners and
  the spec allows 50 m. At the zooms people print, the error is well under that. Tilted views
  print without a scale (D7).
- **[Risk] pdf-lib 1.17.1 is the last release, from 2021.** → It's stable and used only to
  write. The PDF code is in one module (`pdf.ts`), so it can be swapped.
- **[Risk] A static import added later pulls a type into the main bundle,** and nothing fails.
  → D3's rule is written next to the registry, and its check is a task in this change. Any
  change that adds a type repeats that check.
- **[Trade-off] Text drawn as images** (D4) can't be selected or searched in the PDF.
- **[Trade-off] Only Letter paper** for now.
