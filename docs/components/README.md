# Writing your own components

The viewer builds its map UI from each app's `components` config. Besides the built-in types,
such as `legend` and `measure`, it takes component types you write. Each one is a folder under
`extensions/`, and you configure it like any built-in type: in a sidebar panel, in a map corner,
behind an expand button, or with no UI at all.

```
extensions/
  hello-world/            <- the template that ships with the viewer
  buffalo-river/          <- a full example, used by the Buffalo River sample app
  tracks/                 <- a GPX track library, also in the Buffalo River sample app
  trail-report/           <- one of yours
    component.ts          the manifest: name, options, icon, where it can go
    index.ts              defines the custom element
    TrailReport.ts        the element itself
    README.md             what it does, and a config entry to paste
```

The folder is the whole component. The build finds every folder under `extensions/` on its own,
so adding one needs no edit anywhere else, and deleting it removes the type. To share a
component, copy its folder into another copy of the viewer.

## Where to start

1. **Fork the viewer** and work in your fork. Your components live in its `extensions/` folder,
   and you pull upstream to update the viewer. See [Your fork](sharing.md#your-fork).
2. **Create a component** with the scaffolder, which asks what you need and writes a folder that
   already works:

   ```bash
   npm run new:component
   ```

   [Getting started](getting-started.md) walks through it, and through copying `hello-world`
   by hand instead.
3. **Read the template.** [`extensions/hello-world/`](../../extensions/hello-world/) finds the
   map in a corner or a panel, in 2D or 3D, follows it as it moves, and cleans up when removed.
4. **Then read a full example.** [`extensions/buffalo-river/`](../../extensions/buffalo-river/)
   is a complete component built only on the viewer API. It adds layers to a 3D scene, loads
   live data from a service with Retry when it fails, takes clicks on one layer, opens its own
   panel, shows a second page in the panel, and keeps settings per app. Its README says where in
   the code to find each one. The Buffalo River sample app (`?app=buffalo-river`) uses it.

## How a component works

```
public/apps/<app>.json                 extensions/trail-report/component.ts
  components: [                          apiVersion, tag, load, options,
    { "id": "trails",          ------>   defaults, panel, placements ...
      "type": "trail-report",                 |
      "options": { ... } }                    | the viewer checks the options,
  ]                                           | loads the element on first use,
                                              v and places it
                                       <viewer-trail-report> in a corner,
                                       a sidebar panel, an expand, or hidden
```

- **The type name is the folder name.** `extensions/trail-report/` is used as
  `"type": "trail-report"`.
- **The manifest** describes the type: which options it takes and their kinds, their defaults,
  its panel heading and icon, where it can be placed, and which views it works in. See
  [manifest.md](manifest.md).
- **Options are checked** before anything is created. A wrong value fails with a clear error
  at its path, such as `components[2].options.minLength`. See [option-kinds.md](option-kinds.md).
- **The element loads on first use.** An app that doesn't use your type never downloads it.
- **Viewer features come from `"viewer"`**: finding the map, panel open and close events, a
  per-app storage key. See [viewer-api.md](viewer-api.md).

## Guides

- [Finding the map](guides/finding-the-map.md): in a corner or a panel, in 2D or 3D, and
  cleaning up.
- [Container events](guides/container-events.md): knowing when your panel or expand opens and
  closes, and asking to be opened.
- [Saving state](guides/saving-state.md): keeping the user's data per app in the browser.
- [API keys](guides/api-keys.md): using the build's key only where it's needed.
- [Look and feel](guides/look-and-feel.md): Calcite components and tokens, light and dark mode,
  and how a component looks in a map corner.

## Sharing

[sharing.md](sharing.md) covers working in a fork, what goes in a folder, the API version, and
why the viewer can skip a folder, with a fix for each reason.
