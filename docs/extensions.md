# Extensions: layer hooks

A config file can't contain code, but some layers need code: to set a renderer, label
features, or react once data arrives. dojo-sidebar put `preLoad` and `onLoad` functions in its
JavaScript config. Here they live in the viewer's source as named **hooks**, and the config
refers to them by name.

Adding a hook needs a rebuild. Choosing which layers use it does not: that's a config edit.

## When hooks run

- **`preLoad`** runs after the layer object is created and before it is added to the map.
  Use it to change properties that should be in place before anything draws.
- **`onLoad`** runs once, after the layer has loaded, when its fields and service details are
  known.

A hook may be `async`. If a hook throws or its promise rejects, the error is reported on the
app model's error channel (and logged when `debug` is `true`). The layer stays on the map,
and the viewer keeps running.

## Add a hook

1. Write the hook in `src/extensions/hooks.ts`, or in its own file under `src/extensions/`
   that you import there, and register it in the `hooks` object by name:

   ```ts
   import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";

   export const hooks: Record<string, LayerHook> = {
     // Show only open incidents, and say how many there are once the layer has loaded.
     openIncidentsOnly: async (layer, { app, entry }) => {
       const features = layer as FeatureLayer;
       features.definitionExpression = "STATUS = 'Open'";
       const count = await features.queryFeatureCount();
       if (app.view) console.info(`${entry.id}: ${count} open incidents`);
     },
   };
   ```

   The hook receives the layer and a context with:
   - `app`: the app model, with view state, layer and component lookups, and the error channel;
   - `entry`: the layer's validated config entry.

2. Name it in the config:

   ```json
   { "id": "incidents", "type": "feature", "url": "https://...", "hooks": { "onLoad": "openIncidentsOnly" } }
   ```

3. Rebuild (`npm run build`). A config that names a hook the build doesn't have fails
   validation, and the error lists the hooks that are available.

## Tips

- Check `layer.type` before casting if a hook might be used on more than one kind of layer.
- Keep hooks quick. The viewer waits for layers to load (up to 15 seconds) before creating
  components. `onLoad` hooks run after that point if the layer loads late.
- To report a problem without throwing, use
  ``app.errors.report({ source: `layer:${entry.id}`, message: "..." })``.
