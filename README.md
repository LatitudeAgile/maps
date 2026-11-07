# arcgis-sidebar-viewer

A config-driven web map viewer with a tabbed sidebar, built on the
[ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/) 5.x
web components and [Calcite](https://developers.arcgis.com/calcite-design-system/).

This project replaces [dojo-sidebar](https://github.com/DavidSpriggs/dojo-sidebar),
which was built on the retired ArcGIS API for JavaScript 3.x and Dojo. It is a rewrite,
not an in-place upgrade. dojo-sidebar is kept unchanged as a reference.

> **Status:** early migration. The viewer shows a config-driven map with zoom buttons; the
> sidebar, layers, and widgets are still to come. Planned work is tracked as [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in
> [`openspec/`](openspec/).

## Requirements

- Node.js 20 or later
- Optional: an ArcGIS API key for ArcGIS basemaps (see [API key](#api-key)). Without one
  the viewer runs on an OpenStreetMap fallback basemap.

## Develop

```bash
npm install
npm run dev       # start the Vite dev server
npm run build     # type-check and build to dist/
npm run preview   # serve the production build
npm test          # unit tests (Vitest)
npm run check     # type-check + unit tests
npm run test:e2e  # browser tests (Playwright) against a production build
```

Before the first `npm run test:e2e`, install the test browser once:
`npx playwright install chromium`.

## Configure

The map's basemap, center, and zoom come from `public/config/viewer.json`, which is copied
to `dist/config/viewer.json` and can be edited after deployment without rebuilding. Every
setting is described in [docs/configuration.md](docs/configuration.md).

## API key

ArcGIS basemap styles such as `arcgis/streets` need an API key. The viewer reads one at
build time from `VITE_ARCGIS_API_KEY` and sends it **only** to the basemap styles service.

1. Sign in to your portal:
   - **ArcGIS Location Platform** (the free tier is enough): sign in at
     [location.arcgis.com](https://location.arcgis.com) and click **My portal**.
   - **ArcGIS Online organization** (for example `yourorg.maps.arcgis.com`): you need a
     Creator user type or higher and a role with **General privileges** > **Content** >
     **Generate API keys** and **Assign privileges to OAuth 2.0 applications**. If you don't
     see **Developer credentials** in the next step, ask an administrator for these. Basemap
     usage is billed to the organization.
2. Click **Content** > **My content** > **New item** > **Developer credentials** >
   **API key credentials**, then **Next**.
3. Choose **Public application**, then **No item access**.
4. Under **Privileges**, check only **Location services** > **Basemaps**.
5. Set **Referrer URLs** to the sites that will serve the viewer, for example
   `http://localhost:5173`, `http://localhost:4173`, and your production URL. A key in a
   browser app is visible to anyone who opens it; referrers stop other sites from using it.
6. Save, then choose **Generate the API key** and copy it. It is shown only once.
7. Copy `.env.example` to `.env.local` (gitignored) and set the key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   VITE_ARCGIS_API_KEY=your-key-here
   ```

8. Restart `npm run dev`, or rebuild with `npm run build`. The key is baked into the build,
   so rebuild after changing it.

Never commit a key, and never put one in `config/viewer.json`: the config is served to every
visitor and the viewer refuses to start if it finds an `apiKey`, `token`, or `clientSecret`
in it.

### Without a key

If `map.basemap` is a `provider/style` ID and no key is configured, the viewer uses
`map.fallbackBasemap` (OpenStreetMap by default), shows a notice saying so, and sends no
request to the basemap styles service. OpenStreetMap's public tile servers have a
[usage policy](https://operations.osmfoundation.org/policies/tiles/) that does not allow
heavy use: the fallback is for demos and local development only. Configure a key for any
real deployment.

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
