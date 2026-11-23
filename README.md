# arcgis-sidebar-viewer

A config-driven web map viewer with a tabbed sidebar, built on the
[ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/) 5.x
web components and [Calcite](https://developers.arcgis.com/calcite-design-system/).

> **Status:** early development. The viewer shows a config-driven map with layers, Home, Locate
> and zoom buttons at the bottom right, and a collapsible sidebar with Search, Directions,
> Layers, Legend, Basemaps, Sketch, and Print panels. Optional organization sign-in is still to come. Planned work is tracked as [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in
> [`openspec/`](openspec/).

## Requirements

- Node.js 22.12 or later
- Optional: an ArcGIS API key for ArcGIS basemaps (see [API key](#api-key)). The viewer works
  fully without one, on OpenStreetMap and Esri's free imagery hybrid.

## Develop

```bash
npm install
npm run dev       # start the Vite dev server
npm run build     # type-check and build to dist/
npm run preview   # serve the production build
npm run check     # type-check
```

## Configure

The map, its layers, and its components (including sidebar panels) come from
`public/apps/default.json`, which is copied to `dist/apps/default.json` and can be edited
after deployment without rebuilding. Every setting is described in
[docs/configuration.md](docs/configuration.md).

The shipped config includes a **sample layer** (a public Esri demo service) so the sidebar's
Legend has something to show. Replace it with your own layers before deploying.

**Apps:** each file in `public/apps/` is an app, opened with `?app=<name>`, and
`public/apps/index.json` lists the apps users can switch between from the sidebar's Apps
button. The shipped `index.json` and its other apps are **samples**: replace them with your own
apps, or delete `index.json` for a single-app viewer. See [Apps](docs/configuration.md#apps).

- `field-notes.json`: a smaller app for searching and marking up the map.
- `web-map.json`: opens a public web map made in Map Viewer, with one layer of its own added on
  top, and print, measure and coordinates behind buttons in the map's top-right corner, next to
  a fullscreen button. See [Web maps and web scenes](docs/configuration.md#web-maps-and-web-scenes)
  and the expand buttons under [Components](docs/configuration.md#components).
- `city-scene.json`: a 3D scene of San Francisco's buildings, built from the config, with
  measuring behind a button. See [3D scenes](docs/configuration.md#3d-scenes).
- `redlands-parks.json`: a public web map of Redlands parks, opening on its saved bookmarks,
  with a legend behind a button in the same corner and a scale bar.
- `survey-tools.json`: measuring in metric from the sidebar, bookmarks for places around Denver
  set in the config, a live coordinate readout in five formats, a scale bar in miles and
  kilometers, and a map-only fullscreen button.
- `half-dome.json`: Half Dome in 3D on world terrain, for measuring heights and distances, with
  coordinates behind a second button in the same corner, and bookmarks with tilt and heading
  for Yosemite's landmarks.

## Write your own component

Add your own component types and configure them like the built-in ones. Each is a folder under
`extensions/`: the build finds it, so adding one needs no other edit, and sharing one means
copying the folder. Fork the viewer, then run `npm run new:component`, which asks what your
component needs and writes a folder that already works, or copy the `hello-world` template.
[docs/components/](docs/components/README.md) covers getting started, the manifest, the viewer
API, guides, and sharing.

## API key

ArcGIS basemap styles such as `arcgis/streets`, Esri's world route service for Directions, and
optional Places search need an API key. The viewer reads one at build time from
`VITE_ARCGIS_API_KEY` and sends it **only** to the basemap styles service, to Esri's route
service for Directions, and, when `geocoding.places` is configured, to the Places service. It
never sends it to a geocoder.

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
4. Under **Privileges**, check only **Location services** > **Basemaps** and **Routing**, plus
   **Places** if you configure Places search. Routing is for the Directions panel; a key
   without it still shows ArcGIS basemaps, but Directions can't load Esri's route service.
   Places requests are billed per request that returns results.
5. Set **Referrer URLs** to the sites that will serve the viewer, for example
   `http://localhost:5173`, `http://localhost:4173`, and your production URL. A key in a
   browser app is visible to anyone who opens it; referrers stop other sites from using it.

   The key then works only from those origins, ports included. If 5173 is already in use,
   `npm run dev` moves to the next free port (5174, ...), where ArcGIS basemaps and location
   services fail with 401 errors. Free port 5173, or add the other port's URL to the key's
   referrers.
6. Save, then choose **Generate the API key** and copy it. It is shown only once.
7. Copy `.env.example` to `.env.local` (gitignored) and set the key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   VITE_ARCGIS_API_KEY=your-key-here
   ```

8. Restart `npm run dev`, or rebuild with `npm run build`. The key is baked into the build,
   so rebuild after changing it.

Never commit a key, and never put one in an app's config (`apps/*.json`): the config is served to every
visitor and the viewer refuses to start if it finds an `apiKey`, `token`, or `clientSecret`
in it.

### Without a key

Running without a key is supported. If `map.basemap` is a `provider/style` ID and no key is
configured, the viewer uses `map.fallbackBasemap` (OpenStreetMap by default) without a notice,
writes one line to the browser console, and sends no request to the basemap styles service.

The same fallback applies when a key is configured but the basemap styles service refuses it,
for example because the key is invalid, has expired, lacks the basemap styles privilege, or is
restricted to other sites. The map shows `map.fallbackBasemap` instead of staying empty, and
the browser console names the basemap that failed, so check the key if you see that warning.

The sidebar panels work without a key too, with one exception:
- **Search** always uses Esri's public geocoder, `geocode.arcgis.com`, which needs no key.
- **Basemaps** offers the five free basemaps (`osm`, `hybrid`, `satellite`, `light`, `dark`);
  the ArcGIS styles appear only with a key.
- **Directions** is left out: Esri's world route service needs a key with the Routing
  privilege. Point `routeServiceUrl` at a route service that needs none to keep it.

OpenStreetMap's public tile servers have a
[usage policy](https://operations.osmfoundation.org/policies/tiles/) that does not allow
heavy use. For a busy keyless deployment, set `map.fallbackBasemap` to `hybrid`, or configure
a key.

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
