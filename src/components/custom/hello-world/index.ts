// Defines the element once. The registry entry loads this module on first use.
import { HelloWorld } from "./HelloWorld.ts";

if (!customElements.get("viewer-hello-world")) customElements.define("viewer-hello-world", HelloWorld);
