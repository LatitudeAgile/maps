// The manifest: what the viewer needs to know about the hello-world type. The type's name is this
// folder's name. See docs/components/manifest.md.
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "viewer-hello-world",
  // Loaded the first time an app uses the type; an app that doesn't never downloads it.
  load: () => import("./index.ts"),
  options: { greeting: "string" },
  defaults: { greeting: "Hello, world" },
  panel: { heading: "Hello", icon: "code" },
  expandable: true,
  cornerStyle: "panel",
});
