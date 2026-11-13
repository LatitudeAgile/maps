// Defines <{{tag}}> once. The manifest (component.ts) loads this module on first use.
import { {{Name}} } from "./{{Name}}.ts";

if (!customElements.get("{{tag}}")) customElements.define("{{tag}}", {{Name}});
