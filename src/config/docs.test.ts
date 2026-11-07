import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { CREDENTIAL_KEYS, KNOWN_SECTIONS } from "./types.ts";

const doc = readFileSync(new URL("../../docs/configuration.md", import.meta.url), "utf8");

// Every setting validateConfig checks. Keep in sync with validate.ts.
const SETTINGS = [
  ...KNOWN_SECTIONS,
  "app.title",
  "portal.url",
  "map.basemap",
  "map.fallbackBasemap",
  "map.center",
  "map.center[0]",
  "map.center[1]",
  "map.zoom",
  "map.scale",
  "services.<name>",
];

test.each(SETTINGS)("docs/configuration.md documents %s", (setting) => {
  expect(doc).toContain(`\`${setting}\``);
});

test.each(CREDENTIAL_KEYS)("docs/configuration.md names the forbidden key %s", (key) => {
  expect(doc).toContain(`\`${key}\``);
});
