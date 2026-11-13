// The manifest for the {{name}} component type. The type's name is this folder's name.
// See docs/components/manifest.md.
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "{{tag}}",
  // Loaded the first time an app uses the type; an app that doesn't never downloads it.
  load: () => import("./index.ts"),
  options: {{optionsObject}},
{{defaultsLine}}
  panel: { heading: "{{headingJs}}", icon: "{{icon}}" },
{{placementsLine}}
{{viewsLine}}
//#if expand
  expandable: true,
//#endif
{{cornerStyleLine}}
//#if configure
  // Converts the options before they reach the element. Options arrive as validated config
  // values: a layer option is the layer's id, so use map.findLayerById(id). The third argument,
  // the context, also has the map element, the API key and the app (see docs/components/manifest.md).
  configure: (element, options) => {
    // Your code: convert options here, for example building an SDK object from a URL.
    for (const [name, value] of Object.entries(options)) element[name] = value;
  },
//#endif
});
