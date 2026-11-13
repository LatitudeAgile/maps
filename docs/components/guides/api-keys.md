# API keys

The viewer can be built with an ArcGIS API key, from `VITE_ARCGIS_API_KEY` (see
[API key](../../../README.md#api-key)). It works without one: anonymous use is the baseline. The
viewer sends the key only to the location services that need it: basemap styles, Esri's route
service, and Places. Your component should do the same.

## Reading the key

The key reaches your component only through a [`configure`](../manifest.md#configure) hook, as
`context.apiKey`. It's `undefined` when the build has no key.

```ts
import { defineComponentType, type ComponentContext, type ConfigurableElement } from "viewer";

export default defineComponentType({
  // ...
  options: { routeServiceUrl: "url" },
  configure: (element: ConfigurableElement, options: Readonly<Record<string, unknown>>, { apiKey }: ComponentContext) => {
    element.routeServiceUrl = options.routeServiceUrl;
    // Only an ArcGIS location service gets the key, and only as this component's own setting.
    if (apiKey && isArcGISLocationService(options.routeServiceUrl as string)) element.apiKey = apiKey;
  },
});

function isArcGISLocationService(url: string): boolean {
  return new URL(url).hostname.endsWith(".arcgis.com");
}
```

## Rules

- **Send it only where it's needed,** and only to ArcGIS location services. Never send it to a
  geocoder, a feature service, a print service, or anything outside ArcGIS: anyone running that
  service could read it.
- **Set it on your component or request, never globally.** Don't set `esriConfig.apiKey`: that
  would send the key with every request the app makes. Pass it to the one component property or
  request that needs it, such as an SDK component's `apiKey`, or a request's `query.token`.
- **Don't store or log it.** The viewer redacts it from its own error reports. Don't put it in
  `localStorage`, in a URL your component shows, or in `console` output.
- **Never in a config.** An app's config is served to everyone, so the viewer refuses to start
  when a config has an `apiKey`, `token` or `clientSecret` anywhere in it. A component that
  needs a key gets the build's key through `configure`, not from its options.
- **ArcGIS Enterprise:** location services don't accept ArcGIS Enterprise API keys or Enterprise
  logins. A component that calls them needs an ArcGIS Location Platform or ArcGIS Online key.

## Without a key

If your component can't work without a key, or only some of its options need one, give the
manifest a [`keyless`](../manifest.md#keyless) hook. It runs before anything is created, only in
builds without a key:

```ts
keyless: (options) =>
  typeof options.routeServiceUrl === "string" && options.routeServiceUrl.includes(".arcgis.com")
    ? { leaveOut: "Esri's route service needs an API key" }
    : { keep: { ...options } },
```

- `{ leaveOut: reason }` leaves the component out of the app. Its panel icon isn't shown, and
  the console gets a warning with the reason. It sends no request.
- `{ keep: options }` keeps it, with the options you return. Use it to trim options, for example
  dropping basemap styles from a list.

Without a `keyless` hook, the component is kept as configured in a build without a key. Make
sure it then fails gracefully, rather than opening a sign-in dialog.

The built-in `directions` and `basemap-gallery` types do both: see `src/components/directions.ts`
and `src/components/basemapGallery.ts`.
