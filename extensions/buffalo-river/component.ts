// The manifest for the buffalo-river component type. The type's name is this folder's name.
// See docs/components/manifest.md.
import { API_VERSION, defineComponentType } from "viewer";

export default defineComponentType({
  apiVersion: API_VERSION,
  tag: "viewer-buffalo-river",
  // Loaded the first time an app uses the type; an app that doesn't never downloads it.
  load: () => import("./index.ts"),
  options: {},
  panel: { heading: "Buffalo River", icon: "water-drop" },
  placements: ["panel"],
  views: ["3d"],
});
