// The manifest for the tracks component type. The type's name is this folder's name.
// See docs/components/manifest.md.
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "viewer-tracks",
  // Loaded the first time an app uses the type; an app that doesn't never downloads it.
  load: () => import("./index.ts"),
  options: { units: { oneOf: ["imperial", "metric"] } },
  defaults: { units: "imperial" },
  panel: { heading: "Tracks", icon: "walking-distance" },
  placements: ["panel"],
});
