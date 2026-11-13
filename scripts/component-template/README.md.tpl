# {{heading}}

The `{{name}}` component type. Replace this line with what it does and who it's for.

Made with `npm run new:component`. See
[Getting started](../../docs/components/getting-started.md) for what to change next.

## Options

{{optionsTable}}

## Config

Add this entry to an app's `components` in `public/apps/<app>.json`:

```json
{{configEntry}}
```
<!--#if expand-->

In a map corner, behind a button:

```json
{{expandEntry}}
```
<!--#endif-->

## Where it works

- **Placements:** {{placementsText}}
- **Views:** {{viewsText}}

## Files

| File | What it holds |
|---|---|
| `component.ts` | The manifest: tag, options, defaults, panel heading and icon, placements and views. |
| `index.ts` | Defines the element once; the manifest's `load` imports it. |
| `{{Name}}.ts` | The custom element. |
