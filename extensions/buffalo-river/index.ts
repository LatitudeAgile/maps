// Defines <viewer-buffalo-river> once. The manifest (component.ts) loads this module on first use.
import { BuffaloRiver } from "./BuffaloRiver.ts";

if (!customElements.get("viewer-buffalo-river")) customElements.define("viewer-buffalo-river", BuffaloRiver);
