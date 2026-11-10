# hello-world

A template for your own component types. It shows a greeting from config and the map's
center and scale, updating as the map moves, in a map corner or a sidebar panel.

To make your own, follow [docs/custom-components.md](../../../../docs/custom-components.md).

| File | What it holds |
|---|---|
| `HelloWorld.ts` | The custom element: options as properties, finding the map, cleanup. |
| `format.ts` | Pure logic, kept apart from the element. |
| `index.ts` | Defines the element once; the registry entry imports it. |
