# arcgis-sidebar-viewer

A config-driven web map viewer with a tabbed sidebar, built on the
[ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/) 5.x
web components and [Calcite](https://developers.arcgis.com/calcite-design-system/).

This project replaces [dojo-sidebar](https://github.com/DavidSpriggs/dojo-sidebar),
which was built on the retired ArcGIS API for JavaScript 3.x and Dojo. It is a rewrite,
not an in-place upgrade. dojo-sidebar is kept unchanged as a reference.

> **Status:** early migration. The app currently runs the unmodified Esri Vite template.
> Planned work is tracked as [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in
> [`openspec/`](openspec/).

## Requirements

- Node.js 20 or later
- For basemaps, search, and directions: an ArcGIS access token (setup arrives with the
  authentication change)

## Develop

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

## Spec-driven workflow

Requirements live in `openspec/specs/`. Each unit of work is proposed as a change in
`openspec/changes/`, reviewed, implemented, and then archived:

```bash
openspec list            # active changes
openspec show <change>   # read a proposal
openspec validate --all  # check spec and change formatting
```

## License

MIT. See [LICENSE](LICENSE).
