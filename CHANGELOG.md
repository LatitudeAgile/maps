# Changelog

Notable changes to the viewer, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is a `v*` tag, which deploys to
<https://maps.latitudeagile.com>. See [Releasing](README.md#releasing).

## [Unreleased]

## [0.2.0] - 2026-11-26

### Added

- A key to the river's level colours in the Buffalo River panel, with what each band means and a
  marker at the selected trip's level.
- A `local-print` component, Local print, that prints 2D maps and 3D scenes in the browser with
  no print service: a framed print area, saved as a Letter PDF with a title, legend, scale and
  credits (a GeoPDF when the map is to scale) or as a JPEG of the map alone. The Buffalo River
  app has it.
- Each component type's code, and the PDF library, is fetched only by apps that use it.
- A map menu, in every app: right-click the map, press and hold it on a touch screen, or press
  Shift+F10 on it, for What's here? (the nearest address), Copy coordinates and Center here.
  Directions adds Directions from here, Directions to here and Add stop here. A `mapMenu` setting
  chooses the entries and their order, adds link items such as Street View, and
  `"mapMenu": false` turns the menu off. Extensions add their own items with the viewer API's
  `addMapMenuItems`, as hello-world's "Say hello here" shows. The Field Notes app adds a Street
  View link, and the Buffalo River app a what3words link.

### Changed

- The deploy workflow uses the Node 24 releases of its GitHub Actions.
- Tag pushes fail before deploying unless the tag matches `package.json`'s version and this
  changelog has a section for it.

### Fixed

- In the dev server, an extension's `"viewer"` import could load a second copy of the viewer
  API, depending on the drive letter's case on Windows.
- In the Buffalo River app, a right-click on an access point no longer changes the trip.

## [0.1.1] - 2026-11-22

### Fixed

- ArcGIS basemaps and Directions on the live site. The deployed API key had expired, so the
  viewer fell back to OpenStreetMap.

## [0.1.0] - 2026-11-22

First release, deployed to <https://maps.latitudeagile.com> by GitHub Pages.

### Added

- A config-driven map: layers, basemap, and components come from JSON files in `public/apps/`,
  which can be edited after deployment without rebuilding.
- A collapsible sidebar with Search, Directions, Layers, Legend, Basemaps, Sketch, and Print
  panels.
- Map controls: Home, Locate, tracking, zoom, and a basemap toggle, with a keyless hybrid
  basemap when no API key is set.
- Corner expand buttons for measuring, fullscreen, a scale bar, bookmarks, and a coordinate
  readout.
- Web maps and web scenes from ArcGIS Online, and 3D scenes built from the config.
- Apps: several configs in one viewer, opened with `?app=<name>` and listed in an Apps panel.
- Light and dark modes, with the user's choice remembered in their browser.
- Drop-in components: folders under `extensions/` that the build finds, with
  `npm run new:component` to scaffold one. Ships with `hello-world`, `tracks`, and
  `buffalo-river`.
- Sample apps: Field Notes, Web Map, City Scene, Redlands Parks, Survey Tools, Half Dome, and
  Buffalo River.

[Unreleased]: https://github.com/LatitudeAgile/maps/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/LatitudeAgile/maps/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/LatitudeAgile/maps/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LatitudeAgile/maps/releases/tag/v0.1.0
