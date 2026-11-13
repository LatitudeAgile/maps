// Defines <viewer-measure>, the measure component (map-measurements). Loaded by the registry on first use.
import { Measure } from "./Measure.ts";

if (!customElements.get("viewer-measure")) customElements.define("viewer-measure", Measure);
