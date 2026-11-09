// Defines <viewer-sketch>, the Sketch panel (map-sketches). Loaded by the registry on first use.
import { SketchPanel } from "./SketchPanel.ts";

if (!customElements.get("viewer-sketch")) customElements.define("viewer-sketch", SketchPanel);
