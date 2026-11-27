// Defines <viewer-local-print>, the Local print component (map-printing). Loaded by the registry on first use.
import { LocalPrintPanel } from "./LocalPrintPanel.ts";

if (!customElements.get("viewer-local-print")) customElements.define("viewer-local-print", LocalPrintPanel);
