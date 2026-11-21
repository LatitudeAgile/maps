# Tracks

The `tracks` component type: a library of GPX files from your device, shown on the map. Open
the GPX files you've recorded on a phone or GPS unit, or planned in an app, and turn any number
of them on. In a 3D scene, lines are draped on the ground and waypoints stand on it, so the
terrain never hides them, whatever elevations the file recorded.

Each track has a name and notes you can change, a color, and stats worked out from the file:

- the distance;
- the elevation gain and loss, when the file has elevations;
- the date, duration and moving time, when it has times.

You can zoom to a track, download its original file, or delete it.

The tracks that are on the map are listed in a "Tracks" group in the layer list and the legend.
Turning one on or off there does the same in the panel.

## Where the library is kept

In this browser only. Files are read on your device and never uploaded.

- **Shared by every app:** the library is the same in every app on the site (an IndexedDB
  database named `viewer:tracks`). A file opened in one app is listed in all of them.
- **Visibility is per app:** which tracks are on is kept for each app on its own, under
  `appStorageKey("tracks")`. A new app starts with none on.
- **Storage can be lost:** browsers may clear site data under disk pressure, and a private window
  clears it when it closes. When a browser refuses to keep the library at all, as with site data
  blocked, tracks still show for the rest of the visit, and the panel says they won't be kept.
- **Open tabs don't update each other:** a change made in one tab shows in another after a
  reload.

## Options

| Option | Kind | Default | What it does |
|---|---|---|---|
| `units` | `oneOf(imperial\|metric)` | `"imperial"` | Miles and feet, or kilometers and meters. |

## Config

Add this entry to an app's `components` in `public/apps/<app>.json`:

```json
{ "id": "tracks", "type": "tracks" }
```

In metric units:

```json
{ "id": "tracks", "type": "tracks", "options": { "units": "metric" } }
```

To keep the "Tracks" group open in the layer list, give the app's layer list
`"options": { "openGroups": true }`.

## Where it works

- **Placements:** sidebar panel only
- **Views:** 2D maps and 3D scenes

## Files

| File | What it holds |
|---|---|
| `component.ts` | The manifest: tag, the `units` option, panel heading and icon, placements. |
| `index.ts` | Defines the element once; the manifest's `load` imports it. |
| `Tracks.ts` | The custom element: the list, opening files, which tracks are on, going to them. |
| `details.ts` | A track's detail view: name, notes, color, stats, Zoom to, Download, Delete. |
| `layers.ts` | The "Tracks" group, and each track's lines and waypoints. |
| `gpx.ts` | Reads GPX 1.0 and 1.1. Plain code, with no SDK imports. |
| `stats.ts` | Distance, gain and loss, and times. Plain code, with no SDK imports. |
| `format.ts` | Stats as text, in the configured units. |
| `library.ts` | The library in IndexedDB, falling back to memory. |
| `visibility.ts` | Which tracks are on in this app. |
| `palette.ts` | The track colors, and which one a new track gets. |
| `hash.ts` | A content hash, for spotting a file that's already in the library. |
