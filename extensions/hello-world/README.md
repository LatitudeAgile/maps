# hello-world

A template for your own component types. It shows a greeting from config and the map's center
and scale, updating as the map moves, in a map corner, behind an expand button, or in a sidebar
panel, in 2D and 3D. No app uses it until you add it to one.

To make your own, run `npm run new:component`, or copy this folder. See
[Getting started](../../docs/components/getting-started.md).

## Options

| Option | Kind | Default | What it does |
|---|---|---|---|
| `greeting` | `"string"` | `"Hello, world"` | The heading it shows. |

## Config

```json
{ "id": "hello", "type": "hello-world", "options": { "greeting": "Hi from the team" } }
```

In a map corner, behind a button:

```json
{ "id": "hello", "type": "hello-world", "placement": "top-right", "expand": true }
```

## Files

| File | What it holds |
|---|---|
| `component.ts` | The manifest: tag, options, defaults, panel heading and icon, expand support, corner look. |
| `index.ts` | Defines the element once; the manifest's `load` imports it. |
| `HelloWorld.ts` | The custom element: options as properties, finding the map, following it, cleanup. |
| `format.ts` | Pure logic, kept apart from the element. |
