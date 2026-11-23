# Changelog

Notable changes to the viewer, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is a `v*` tag, which deploys to
<https://maps.latitudeagile.com>. See [Releasing](README.md#releasing).

## [Unreleased]

### Changed

- The deploy workflow uses the Node 24 releases of its GitHub Actions.
- Tag pushes fail before deploying unless the tag matches `package.json`'s version and this
  changelog has a section for it.

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

[Unreleased]: https://github.com/LatitudeAgile/maps/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LatitudeAgile/maps/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LatitudeAgile/maps/releases/tag/v0.1.0
