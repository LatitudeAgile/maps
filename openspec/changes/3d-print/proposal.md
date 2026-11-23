# Proposal

## Why

The viewer's only printing is the `print` type, Esri's `arcgis-print`. It sends the map to a
print service and works only in 2D maps: in a scene it reports an error, so 3D apps like the
Buffalo River sample can't print at all. StewardshipOS (`D:\git\StewardshipOS`) has a print tool
that needs no print service. It frames a print area on the map, takes a high-resolution picture
of it in the browser, and lays it out on a Letter page with a title, legend, scale and credits,
as a PDF that map apps can place you on (a GeoPDF). That approach works the same in a scene as in
a map. Porting it gives every app, 2D or 3D, a print option that sends nothing to a server.

Printing also brings a large library (pdf-lib) with it. Today each component type's code is
already built into its own file and fetched only when an app uses that type. No spec says so,
though, and a new type with a heavy dependency is the easiest way to lose it. This change makes
it a requirement for every type.

It adds to `print` without changing it.

## What Changes

- **`print-map` component type (new), built in, for 2D maps and 3D scenes.** In a sidebar panel,
  or in a corner behind an expand button, it has:
  - a title (the app's title at first), Landscape or Portrait (Letter paper), and the output: a
    PDF page layout, or a JPEG of the map alone;
  - an Export button that downloads the file, named after the title;
  - while it's open, a print area on the map in the page's map shape, with the rest of the map
    dimmed. The user frames the print by panning and zooming. The area is gone when it closes.
- **The PDF page** has the title above the map, then the date and a legend below it on the left,
  and the scale (as 1:N and a scale bar) and the map's credits on the right. The map is a
  300 DPI picture of the print area. The PDF records the map's location (GeoPDF), so map apps
  such as Avenza Maps can show the reader's position on it.
- **The legend** is built from the map's visible layers: one row per layer with one symbol, a
  row per class for layers whose symbol varies by value, and the layer's title alone where no
  swatch can be drawn.
- **In a tilted 3D view,** the scale differs across the map, so the page leaves out the scale
  and the location data and says "Not to scale". The panel says so before export.
- **Options:** `title`, `orientation` (`landscape` or `portrait`) and `format` (`pdf` or `jpg`)
  set the starting choices.
- **Every component type's code is fetched only when an app uses it,** and `print-map`'s PDF
  library only when a PDF is made. Built-in types and extension types are both covered.
- `print` is unchanged: it stays Esri's print component, through a print service, 2D only.

## Capabilities

### New Capabilities

- `map-printing`: the `print-map` type: the print area, the page layout, the map image, the
  legend, the scale and credits, GeoPDF, tilted scenes, and its options.

### Modified Capabilities

- `map-components`: the registered types gain `print-map`, and a new requirement says each
  component type's code, built in or from an extension, is fetched only by an app that uses it.

## Impact

- **New:** `src/components/printMap/`, which holds the element, the page geometry, the legend, the
  PDF and GeoPDF writer, and the print-area overlay.
- **Changed:**
  - `src/components/registry.ts` (the `print-map` entry);
  - `docs/configuration.md` (the type, its options, and "2D and 3D");
  - `public/apps/buffalo-river.json` (adds `print-map`, 3D);
  - `public/apps/default.json` (adds `print-map` next to `print`, 2D).
- **Dependency:** `pdf-lib` (MIT), loaded only when a PDF is made.
- **Build:** no build setting changes are expected. Each type's `load` already uses dynamic
  `import()`, which Vite (Rolldown) builds into its own files. The new requirement is checked by
  looking at what the browser fetches.
- **Ported from:**
  - StewardshipOS `src/print/mapPage.ts` (page geometry and scale bar);
  - StewardshipOS `src/print/mapLegend.ts` (legend and credits, made general);
  - StewardshipOS `electron/main/geopdf.ts` (the GeoPDF dictionary);
  - the print parts of StewardshipOS `HouseholdMap.vue` (print area and capture).

  Electron's print-to-PDF and its preview windows are replaced by a PDF written in the browser.
