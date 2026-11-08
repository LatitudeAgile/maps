import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { COMPONENT_TYPES } from "../components/registry.ts";
import { CREDENTIAL_KEYS, KNOWN_SECTIONS } from "./types.ts";

const doc = readFileSync(new URL("../../docs/configuration.md", import.meta.url), "utf8");

// Every setting validateConfig checks. Keep in sync with validate.ts.
const SETTINGS = [
  ...KNOWN_SECTIONS,
  "app.title",
  "app.titleVisible",
  "app.theme",
  "app.theme.color",
  "app.theme.opacity",
  "app.theme.textColor",
  "portal.url",
  "map.basemap",
  "map.fallbackBasemap",
  "map.center",
  "map.center[0]",
  "map.center[1]",
  "map.zoom",
  "map.scale",
  "services.<name>",
  "layers[].id",
  "layers[].type",
  "layers[].url",
  "layers[].portalItem.id",
  "layers[].title",
  "layers[].visible",
  "layers[].opacity",
  "layers[].popupEnabled",
  "layers[].showSublayers",
  "layers[].hideSublayers",
  "layers[].options",
  "layers[].hooks.preLoad",
  "layers[].hooks.onLoad",
  "components[].id",
  "components[].type",
  "components[].placement",
  "components[].options",
  "components[].panel",
  "components[].panel.heading",
  "components[].panel.icon",
  "geocoding.geocoders",
  "geocoding.geocoders[].url",
  "geocoding.geocoders[].name",
  "geocoding.geocoders[].placeholder",
  "geocoding.places",
  "geocoding.places.radius",
  "geocoding.places.categories",
  "geocoding.places.name",
  "request.proxyUrl",
  "request.proxyRules",
  "request.proxyRules[].urlPrefix",
  "request.proxyRules[].proxyUrl",
];

test.each(SETTINGS)("docs/configuration.md documents %s", (setting) => {
  expect(doc).toContain(`\`${setting}\``);
});

test.each(CREDENTIAL_KEYS)("docs/configuration.md names the forbidden key %s", (key) => {
  expect(doc).toContain(`\`${key}\``);
});

// Every registered component type and each of its options is documented.
test.each(Object.entries(COMPONENT_TYPES).flatMap(([type, t]) => [type, ...Object.keys(t.options)]))(
  "docs/configuration.md documents component type or option %s",
  (name) => {
    expect(doc).toContain(`\`${name}\``);
  },
);
