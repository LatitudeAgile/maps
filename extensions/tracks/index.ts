// Defines <viewer-tracks> once. The manifest (component.ts) loads this module on first use.
import { Tracks } from "./Tracks.ts";

if (!customElements.get("viewer-tracks")) customElements.define("viewer-tracks", Tracks);
