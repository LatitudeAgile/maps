import type { OptionKind, ComponentTypeSchema } from "../components/registry.ts";
import { ID_PATTERN } from "./layers.ts";
import { COMPONENT_PLACEMENTS, isCredentialKey, type ConfigProblem, type ComponentConfig, type ComponentPlacement } from "./types.ts";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN_KEYS = ["id", "type", "placement", "options"];

export interface ComponentValidationContext {
  /** Registered component types and their supported options. */
  types: Readonly<Record<string, ComponentTypeSchema>>;
  /** Ids of the configured layers, for layer-reference options. */
  layerIds: string[];
}

/** Validate the `components` section. Problems are appended to `errors` and `warnings`. */
export function validateComponents(
  raw: unknown,
  context: ComponentValidationContext,
  errors: ConfigProblem[],
  warnings: ConfigProblem[],
): ComponentConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ path: "components", message: "Expected an array of component entries." });
    return [];
  }

  const typeNames = Object.keys(context.types);
  const result: ComponentConfig[] = [];
  const seen = new Map<string, number>();

  raw.forEach((entry: unknown, i) => {
    const at = `components[${i}]`;
    if (!isObject(entry)) {
      errors.push({ path: at, message: "Expected a component entry object." });
      return;
    }
    const before = errors.length;

    for (const key of Object.keys(entry)) {
      if (!KNOWN_KEYS.includes(key) && !isCredentialKey(key)) warnings.push({ path: `${at}.${key}`, message: "Unknown setting; it is ignored." });
    }

    const id = entry.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      errors.push({ path: `${at}.id`, message: "Required. Expected 1 to 64 letters, digits, hyphens, or underscores." });
    } else if (seen.has(id)) {
      errors.push({ path: `${at}.id`, message: `IDs must be unique; "${id}" is also used by components[${seen.get(id)}].` });
    } else {
      seen.set(id, i);
    }

    const type = entry.type;
    const schema = typeof type === "string" && Object.hasOwn(context.types, type) ? context.types[type] : undefined;
    if (!schema) errors.push({ path: `${at}.type`, message: `Expected one of: ${typeNames.join(", ")}.` });

    const placement = entry.placement;
    if (typeof placement !== "string" || !(COMPONENT_PLACEMENTS as readonly string[]).includes(placement)) {
      errors.push({ path: `${at}.placement`, message: `Required. Expected one of: ${COMPONENT_PLACEMENTS.join(", ")}.` });
    }

    const options: Obj = {};
    if (entry.options !== undefined && !isObject(entry.options)) {
      errors.push({ path: `${at}.options`, message: "Expected an object." });
    } else if (isObject(entry.options) && schema) {
      for (const [name, value] of Object.entries(entry.options)) {
        const path = `${at}.options.${name}`;
        if (isCredentialKey(name)) continue; // already reported as a credential
        const kind = Object.hasOwn(schema.options, name) ? schema.options[name] : undefined;
        if (!kind) {
          warnings.push({ path, message: `Not supported by the "${type}" component; it is ignored.` });
          continue;
        }
        if (checkOption(kind, value, path, context.layerIds, errors)) options[name] = value;
      }
    }

    if (errors.length > before) return;
    result.push({ id: id as string, type: type as string, placement: placement as ComponentPlacement, options });
  });

  return result;
}

/** Check one option value against its kind. Returns true when it is valid. */
function checkOption(kind: OptionKind, value: unknown, path: string, layerIds: string[], errors: ConfigProblem[]): boolean {
  const unknownLayer = (id: unknown) => `"${String(id)}" is not a configured layer. Use an id from layers.`;
  switch (kind) {
    case "string":
      if (typeof value === "string") return true;
      errors.push({ path, message: "Expected a string." });
      return false;
    case "number":
      if (typeof value === "number" && Number.isFinite(value)) return true;
      errors.push({ path, message: "Expected a number." });
      return false;
    case "boolean":
      if (typeof value === "boolean") return true;
      errors.push({ path, message: "Expected true or false." });
      return false;
    case "layer":
      if (typeof value === "string" && layerIds.includes(value)) return true;
      errors.push({ path, message: unknownLayer(value) });
      return false;
    case "layer[]": {
      if (!Array.isArray(value)) {
        errors.push({ path, message: "Expected an array of layer ids." });
        return false;
      }
      let ok = true;
      value.forEach((id, j) => {
        if (typeof id !== "string" || !layerIds.includes(id)) {
          errors.push({ path: `${path}[${j}]`, message: unknownLayer(id) });
          ok = false;
        }
      });
      return ok;
    }
  }
}
