#!/usr/bin/env node
// npm run new:component: asks what a new component needs and writes extensions/<name>/, a folder
// that builds and shows in the viewer (add-drop-in-extensions D7). Flags answer the same
// questions; --yes takes the default for the rest. Nothing is written until every answer is in,
// an existing file is never replaced, and a cancelled or failed run writes nothing.
// See docs/components/getting-started.md.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = join(ROOT, "extensions");
const APPS = join(ROOT, "public", "apps");
const TEMPLATES = join(ROOT, "scripts", "component-template");

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const OPTION_NAME = /^[a-z][a-zA-Z0-9]*$/;
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right", "top-start", "top-end", "bottom-start", "bottom-end"];
const NAMED_KINDS = ["string", "number", "boolean", "scale", "url", "basemap", "basemap[]", "layer", "layer[]", "layer-info[]", "color[]", "bookmark[]"];
/** Properties every element has: an option with one of these names would replace it. */
const ELEMENT_PROPERTIES = new Set([
  "id", "title", "hidden", "slot", "style", "lang", "dir", "className", "classList", "dataset", "innerHTML", "outerHTML",
  "textContent", "innerText", "tabIndex", "part", "role", "translate", "inert", "draggable", "accessKey", "nonce",
  "autofocus", "shadowRoot", "children", "attributes", "isConnected", "referenceElement", "popover", "spellcheck",
  "contentEditable", "enterKeyHint", "inputMode", "autocapitalize", "localName", "tagName", "namespaceURI", "prefix",
  "baseURI", "nodeName", "nodeType", "nodeValue", "parentNode", "parentElement", "ownerDocument", "constructor",
]);

const HELP = `Create a component type in extensions/<name>/.

Usage: npm run new:component [-- <flags>]

Each flag answers one question; the rest are asked. With --yes, nothing is asked and every
question no flag answers takes its default.

  --name <name>               Type and folder name: lowercase words joined by hyphens,
                              such as trail-report. Required with --yes.
  --heading <text>            Panel heading. Default: the name in sentence case ("Trail report").
  --icon <name>               Calcite icon. Default: code.
  --placements <where>        panel, corners or both. Default: both.
  --corner-style <look>       How it looks in a map corner: button, panel or none. Default: panel.
                              Ignored with --placements panel.
  --expand, --no-expand       Whether it can open from an expand button in a corner. Default: yes.
                              Ignored with --placements panel.
  --views <views>             2d, 3d or both. Default: both.
  --option <name:kind[=default]>
                              An option; repeat for more. Kinds: string, number, boolean,
                              scale, url, basemap, basemap[], layer, layer[], layer-info[],
                              color[], bookmark[], oneOf(a|b), integer(1..10) and
                              listOf(a|b). A default is allowed for
                              string, number, boolean, scale, url, basemap, oneOf and integer.
                              Default: no options.
  --follows                   It needs to know when its panel or expand opens and closes.
  --saves                     It saves the user's data per app in the browser.
  --configure                 It converts its options before use (a configure hook).
  --app <name>                Add it to public/apps/<name>.json. Default: no app.
  --yes, -y                   Ask nothing; use the defaults.
  --help, -h                  Show this help.

See docs/components/getting-started.md.`;

class UsageError extends Error {}

// ---- Input -------------------------------------------------------------------------------------

/** Line input that works for a terminal and for piped answers alike. */
function lineReader() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  const lines = [];
  let waiting;
  let closed = false;
  rl.on("line", (raw) => {
    // PowerShell starts piped input with a byte order mark.
    const line = raw.replace(/^﻿/, "");
    if (!waiting) return void lines.push(line);
    if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
    const resolve = waiting;
    waiting = undefined;
    resolve(line);
  });
  rl.on("close", () => {
    closed = true;
    if (waiting) cancel();
  });
  rl.on("SIGINT", cancel);
  return {
    ask(prompt) {
      process.stdout.write(prompt);
      if (lines.length) {
        const line = lines.shift();
        if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
        return Promise.resolve(line);
      }
      if (closed) cancel();
      return new Promise((resolve) => (waiting = resolve));
    },
    close: () => rl.close(),
  };
}

function cancel() {
  process.stdout.write("\nCancelled. Nothing was written.\n");
  process.exit(130);
}

// ---- Checks ------------------------------------------------------------------------------------

function builtInTypes() {
  return JSON.parse(readFileSync(join(ROOT, "src", "components", "builtInTypes.json"), "utf8")).types;
}

/** Calcite icon names, or undefined when the icon package isn't installed. */
function calciteIcons() {
  const file = join(ROOT, "node_modules", "@esri", "calcite-ui-icons", "docs", "icons.json");
  if (!existsSync(file)) return undefined;
  return new Set(Object.keys(JSON.parse(readFileSync(file, "utf8")).icons));
}

/** "TrailReport", "trail_report" or "Trail Report" -> "trail-report". */
function kebab(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+|-+$/g, "");
}

function nameProblem(name) {
  if (!NAME.test(name)) {
    const suggestion = kebab(name);
    return `Names are lowercase words joined by hyphens, starting with a letter${suggestion && NAME.test(suggestion) ? `, such as ${suggestion}` : ""}.`;
  }
  if (builtInTypes().includes(name)) return `${name} is a built-in type. Choose another name.`;
  if (existsSync(join(EXTENSIONS, name))) return `extensions/${name}/ already exists. Choose another name, or delete that folder first.`;
  return undefined;
}

const sentenceCase = (name) => name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const pascalCase = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/** A kind from text: a named kind, or oneOf(a|b), integer(1..10), listOf(a|b). */
function parseKind(text) {
  if (NAMED_KINDS.includes(text)) return text;
  const valued = /^(oneOf|listOf)\((.+)\)$/.exec(text);
  if (valued) {
    const values = valued[2].split("|").map((v) => v.trim()).filter(Boolean);
    if (!values.length || new Set(values).size !== values.length) throw new UsageError(`${valued[1]} needs a list of different values, such as ${valued[1]}(miles|kilometers).`);
    return { [valued[1]]: values };
  }
  const range = /^integer\((-?\d+)\.\.(-?\d+)\)$/.exec(text);
  if (range) {
    const [min, max] = [Number(range[1]), Number(range[2])];
    if (min > max) throw new UsageError(`integer(${min}..${max}): the first number must not be larger than the second.`);
    return { integer: [min, max] };
  }
  throw new UsageError(`"${text}" isn't a kind. Use one of ${NAMED_KINDS.join(", ")}, oneOf(a|b), integer(1..10) or listOf(a|b).`);
}

const kindText = (kind) =>
  typeof kind === "string" ? kind : "integer" in kind ? `integer(${kind.integer[0]}..${kind.integer[1]})` : `${Object.keys(kind)[0]}(${Object.values(kind)[0].join("|")})`;

const takesDefault = (kind) => ["string", "number", "boolean", "scale", "url", "basemap"].includes(kind) || (typeof kind === "object" && !("listOf" in kind));

/** A default from text, checked the way validation would check the value. */
function parseDefault(kind, text) {
  if (!takesDefault(kind)) throw new UsageError(`A ${kindText(kind)} option can't have a default here; set one in component.ts if you need it.`);
  if (kind === "string") return text;
  if (kind === "boolean") {
    if (/^(true|yes|y)$/i.test(text)) return true;
    if (/^(false|no|n)$/i.test(text)) return false;
    throw new UsageError(`"${text}" isn't true or false.`);
  }
  if (kind === "number" || kind === "scale") {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) throw new UsageError(`"${text}" isn't a number.`);
    if (kind === "scale" && n <= 0) throw new UsageError("A scale must be greater than 0.");
    return n;
  }
  if (kind === "url") {
    let ok = false;
    try {
      ok = new URL(text).protocol === "https:";
    } catch {}
    if (!ok) throw new UsageError(`"${text}" isn't an absolute https URL.`);
    return text;
  }
  if (kind === "basemap") {
    if (!text.trim()) throw new UsageError("A basemap ID can't be empty.");
    return text.trim();
  }
  if ("oneOf" in kind) {
    if (!kind.oneOf.includes(text)) throw new UsageError(`"${text}" isn't one of: ${kind.oneOf.join(", ")}.`);
    return text;
  }
  const n = Number(text);
  const [min, max] = kind.integer;
  if (!Number.isInteger(n) || n < min || n > max) throw new UsageError(`"${text}" isn't a whole number from ${min} to ${max}.`);
  return n;
}

function optionNameProblem(name, options) {
  if (!OPTION_NAME.test(name)) return "Option names start with a lowercase letter and use only letters and digits, such as minLength.";
  if (ELEMENT_PROPERTIES.has(name)) return `${name} is a property every element has. Choose another name.`;
  if (options.some((o) => o.name === name)) return `There's already an option named ${name}.`;
  return undefined;
}

/** --option name:kind[=default] */
function parseOptionFlag(text, options) {
  const match = /^([^:=]+):([^=]+)(?:=(.*))?$/.exec(text);
  if (!match) throw new UsageError(`--option "${text}": use name:kind or name:kind=default, such as minLength:number=5.`);
  const [, name, kindSource, defaultText] = match;
  const problem = optionNameProblem(name, options);
  if (problem) throw new UsageError(`--option "${text}": ${problem}`);
  let kind;
  let value;
  try {
    kind = parseKind(kindSource);
    if (defaultText !== undefined) value = parseDefault(kind, defaultText);
  } catch (err) {
    throw new UsageError(`--option "${text}": ${err.message}`);
  }
  return { name, kind, ...(defaultText !== undefined ? { default: value } : {}) };
}

/** The apps in public/apps/, with their titles. */
function listApps() {
  if (!existsSync(APPS)) return [];
  return readdirSync(APPS)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort()
    .map((file) => {
      let title = "";
      try {
        title = JSON.parse(readFileSync(join(APPS, file), "utf8"))?.app?.title ?? "";
      } catch {}
      return { name: file.slice(0, -5), title };
    });
}

// ---- Answers -----------------------------------------------------------------------------------

const ONE_OF = (flag, value, allowed) => {
  if (value !== undefined && !allowed.includes(value)) throw new UsageError(`${flag} accepts ${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}, not "${value}".`);
  return value;
};

/** Answers given by flags, checked. Unanswered questions are undefined. */
function answersFromFlags(values) {
  const answers = {};
  if (values.name !== undefined) {
    const problem = nameProblem(values.name);
    if (problem) throw new UsageError(`--name: ${problem}`);
    answers.name = values.name;
  }
  if (values.heading !== undefined) {
    if (!values.heading.trim()) throw new UsageError("--heading can't be empty.");
    answers.heading = values.heading.trim();
  }
  if (values.icon !== undefined) {
    const icons = calciteIcons();
    if (icons && !icons.has(values.icon)) throw new UsageError(`--icon: "${values.icon}" isn't a Calcite icon. See https://developers.arcgis.com/calcite-design-system/icons/.`);
    answers.icon = values.icon;
  }
  answers.placements = ONE_OF("--placements", values.placements, ["panel", "corners", "both"]);
  answers.cornerStyle = ONE_OF("--corner-style", values["corner-style"], ["button", "panel", "none"]);
  if (values.expand && values["no-expand"]) throw new UsageError("Use --expand or --no-expand, not both.");
  answers.expand = values.expand ? true : values["no-expand"] ? false : undefined;
  answers.views = ONE_OF("--views", values.views, ["2d", "3d", "both"]);
  if (values.option) {
    answers.options = [];
    for (const text of values.option) answers.options.push(parseOptionFlag(text, answers.options));
  }
  for (const feature of ["follows", "saves", "configure"]) if (values[feature]) answers[feature] = true;
  if (values.app !== undefined) {
    if (!listApps().some((a) => a.name === values.app)) throw new UsageError(`--app: there's no public/apps/${values.app}.json. Apps: ${listApps().map((a) => a.name).join(", ")}.`);
    answers.app = values.app;
  }
  return answers;
}

/** Ask whatever the flags didn't answer. */
async function askRest(answers, input) {
  const choose = async (question, choices, defaultIndex) => {
    for (;;) {
      const list = choices.map((c, i) => `(${i + 1}) ${c}`).join("  ");
      const text = (await input.ask(`${question}  ${list}  [${defaultIndex + 1}] `)).trim();
      if (text === "") return defaultIndex;
      const n = Number(text);
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) return n - 1;
      const byName = choices.findIndex((c) => c.toLowerCase() === text.toLowerCase());
      if (byName >= 0) return byName;
      console.log(`  Type a number from 1 to ${choices.length}.`);
    }
  };
  const yesNo = async (question, defaultYes) => {
    for (;;) {
      const text = (await input.ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
      if (text === "") return defaultYes;
      if (["y", "yes"].includes(text)) return true;
      if (["n", "no"].includes(text)) return false;
      console.log("  Type y or n.");
    }
  };

  while (answers.name === undefined) {
    const name = (await input.ask("Name (lowercase words joined by hyphens, such as trail-report): ")).trim();
    const problem = name ? nameProblem(name) : "A name is required.";
    if (problem) console.log(`  ${problem}`);
    else answers.name = name;
  }
  if (answers.heading === undefined) {
    const fallback = sentenceCase(answers.name);
    answers.heading = (await input.ask(`Panel heading [${fallback}]: `)).trim() || fallback;
  }
  const icons = calciteIcons();
  while (answers.icon === undefined) {
    const icon = (await input.ask("Calcite icon (see developers.arcgis.com/calcite-design-system/icons) [code]: ")).trim() || "code";
    if (icons && !icons.has(icon)) console.log(`  "${icon}" isn't a Calcite icon. Try another, such as code, layer or pin.`);
    else answers.icon = icon;
  }
  if (answers.placements === undefined) answers.placements = ["panel", "corners", "both"][await choose("Where can it go?", ["sidebar panel", "map corners", "both"], 2)];
  const corners = answers.placements !== "panel";
  if (corners && answers.cornerStyle === undefined) answers.cornerStyle = ["button", "panel", "none"][await choose("How does it look in a map corner?", ["button", "panel", "none"], 1)];
  if (corners && answers.expand === undefined) answers.expand = await yesNo("Can it open from an expand button in a corner?", true);
  if (answers.views === undefined) answers.views = ["2d", "3d", "both"][await choose("Which views?", ["2D maps", "3D scenes", "both"], 2)];
  if (answers.options === undefined) {
    answers.options = [];
    const kinds = [...NAMED_KINDS, "oneOf", "integer", "listOf"];
    for (;;) {
      const name = (await input.ask("Option name (Enter when there are no more options): ")).trim();
      if (!name) break;
      const problem = optionNameProblem(name, answers.options);
      if (problem) {
        console.log(`  ${problem}`);
        continue;
      }
      const kindName = kinds[await choose(`  Kind of ${name}?`, kinds, 0)];
      let kind = kindName;
      while (kind === "oneOf" || kind === "listOf" || kind === "integer") {
        const prompt = kindName === "integer" ? "  Range, as min..max (such as 1..10): " : "  Allowed values, separated by | (such as miles|kilometers): ";
        try {
          kind = parseKind(`${kindName}(${(await input.ask(prompt)).trim()})`);
        } catch (err) {
          console.log(`  ${err.message}`);
        }
      }
      const option = { name, kind };
      while (takesDefault(kind)) {
        const text = await input.ask("  Default (Enter for none): ");
        if (text === "") break;
        try {
          option.default = parseDefault(kind, kind === "string" ? text : text.trim());
          break;
        } catch (err) {
          console.log(`  ${err.message}`);
        }
      }
      answers.options.push(option);
    }
  }
  console.log("Does it need to...");
  if (answers.follows === undefined) answers.follows = await yesNo("  know when its panel or expand opens and closes?", false);
  if (answers.saves === undefined) answers.saves = await yesNo("  save the user's data per app?", false);
  if (answers.configure === undefined) answers.configure = await yesNo("  convert its options before use (a configure hook)?", false);
  if (answers.app === undefined) {
    const apps = listApps();
    const choices = ["no", ...apps.map((a) => `${a.name}${a.title ? ` (${a.title})` : ""}`)];
    const list = choices.map((c, i) => `  (${i}) ${c}`).join("\n");
    for (;;) {
      const text = (await input.ask(`Add it to an app?\n${list}\n[0] `)).trim();
      const n = text === "" ? 0 : Number(text);
      if (Number.isInteger(n) && n >= 0 && n < choices.length) {
        answers.app = n === 0 ? null : apps[n - 1].name;
        break;
      }
      const byName = apps.find((a) => a.name === text);
      if (byName) {
        answers.app = byName.name;
        break;
      }
      console.log(`  Type a number from 0 to ${choices.length - 1}.`);
    }
  }
  return answers;
}

/** Defaults for everything --yes leaves unanswered. */
function withDefaults(answers) {
  if (answers.name === undefined) throw new UsageError("--yes needs --name, such as --name trail-report.");
  const placements = answers.placements ?? "both";
  return {
    name: answers.name,
    heading: answers.heading ?? sentenceCase(answers.name),
    icon: answers.icon ?? "code",
    placements,
    cornerStyle: placements === "panel" ? "none" : (answers.cornerStyle ?? "panel"),
    expand: placements === "panel" ? false : (answers.expand ?? true),
    views: answers.views ?? "both",
    options: answers.options ?? [],
    follows: answers.follows ?? false,
    saves: answers.saves ?? false,
    configure: answers.configure ?? false,
    app: answers.app ?? null,
  };
}

// ---- Rendering ---------------------------------------------------------------------------------

/** The TypeScript type an element property gets for a kind, and the type imports it needs. */
function tsType(kind) {
  if (typeof kind === "object") {
    if ("integer" in kind) return { type: "number" };
    const union = Object.values(kind)[0].map((v) => JSON.stringify(v)).join(" | ");
    return { type: "oneOf" in kind ? union : `(${union})[]` };
  }
  return (
    {
      string: { type: "string" },
      number: { type: "number" },
      boolean: { type: "boolean" },
      scale: { type: "number" },
      url: { type: "string" },
      basemap: { type: "Basemap | string", imports: ["Basemap"] },
      "basemap[]": { type: "string[]" },
      layer: { type: "Layer", imports: ["Layer"] },
      "layer[]": { type: "Layer[]", imports: ["Layer"] },
      "layer-info[]": { type: "{ layer: Layer; title?: string }[]", imports: ["Layer"] },
      "color[]": { type: "{ name: string; color: string }[]" },
      "bookmark[]": { type: "{ name: string; center: [number, number]; zoom?: number; scale?: number; tilt?: number; heading?: number }[]" },
    }[kind]
  );
}

/** A kind as TypeScript source: "number", or { oneOf: ["a", "b"] }. */
const kindCode = (kind) => (typeof kind === "string" ? JSON.stringify(kind) : `{ ${Object.keys(kind)[0]}: [${Object.values(kind)[0].map((v) => JSON.stringify(v)).join(", ")}] }`);

/** An object literal at the manifest's indentation: on one line when short, else one entry per line. */
function objectCode(entries) {
  if (!entries.length) return "{}";
  const line = `{ ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")} }`;
  return line.length <= 80 ? line : `{\n${entries.map(([k, v]) => `    ${k}: ${v},`).join("\n")}\n  }`;
}

const TYPE_IMPORTS = { Basemap: 'import type Basemap from "@arcgis/core/Basemap.js";', Layer: 'import type Layer from "@arcgis/core/layers/Layer.js";' };

/** The config entry for the type: in a panel when it can go there, else top-right. */
function configEntry(a, expand = false) {
  const entry = { id: a.name, type: a.name };
  if (a.placements === "corners" || expand) entry.placement = "top-right";
  if ((a.placements === "corners" || expand) && a.expand) entry.expand = true;
  return entry;
}

const entryText = (entry) => `{ ${Object.entries(entry).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;

function render(a) {
  const Name = pascalCase(a.name);
  const tag = `viewer-${a.name}`;
  const options = a.options;
  const withDefault = options.filter((o) => "default" in o);
  const typeImports = [...new Set(options.flatMap((o) => tsType(o.kind).imports ?? []))].sort().map((t) => TYPE_IMPORTS[t]);
  const fields = {
    name: a.name,
    Name,
    tag,
    heading: a.heading,
    headingJs: JSON.stringify(a.heading).slice(1, -1),
    icon: a.icon,
    typeImports: typeImports.join("\n"),
    viewerImports: [...(a.saves ? ["appStorageKey"] : []), "findViewElement", ...(a.follows ? ["PANEL_CLOSE", "PANEL_OPEN"] : []), "type ViewElement"].join(", "),
    optionsObject: objectCode(options.map((o) => [o.name, kindCode(o.kind)])),
    defaultsLine: withDefault.length ? `  defaults: ${objectCode(withDefault.map((o) => [o.name, JSON.stringify(o.default)]))},` : "",
    placementsLine: a.placements === "panel" ? '  placements: ["panel"],' : a.placements === "corners" ? `  placements: [${CORNERS.map((c) => JSON.stringify(c)).join(", ")}],` : "",
    viewsLine: a.views === "both" ? "" : `  views: ["${a.views}"],`,
    cornerStyleLine: a.cornerStyle && a.cornerStyle !== "none" ? `  cornerStyle: "${a.cornerStyle}",` : "",
    optionFields: options.map((o) => `  #${o.name}: ${tsType(o.kind).type} | undefined;`).join("\n"),
    optionRows: options.map((o) => `    this.#row(list, "${o.name}").textContent = describe(undefined);`).join("\n"),
    optionAccessors: options
      .map(
        (o) => `
  /** The \`${o.name}\` option (${kindText(o.kind)}). The viewer sets it from config. */
  get ${o.name}(): ${tsType(o.kind).type} | undefined {
    return this.#${o.name};
  }
  set ${o.name}(value: ${tsType(o.kind).type} | undefined) {
    this.#${o.name} = value;
    // Your code: react to the new value.
    this.#rows.get("${o.name}")!.textContent = describe(value);
  }`,
      )
      .join("\n"),
    optionsTable: options.length
      ? ["| Option | Kind | Default | What it does |", "|---|---|---|---|", ...options.map((o) => `| \`${o.name}\` | \`${kindText(o.kind).replace(/\|/g, "\\|")}\` | ${"default" in o ? `\`${JSON.stringify(o.default)}\`` : "none"} | Describe it here. |`)].join("\n")
      : "This type has no options.",
    configEntry: entryText(configEntry(a)),
    expandEntry: entryText(configEntry(a, true)),
    placementsText: { panel: "sidebar panel only", corners: "map corners only", both: "sidebar panel, map corners, or none (no UI)" }[a.placements] + (a.expand ? "; it can open from an expand button in a corner" : ""),
    viewsText: { "2d": "2D maps only", "3d": "3D scenes only", both: "2D maps and 3D scenes" }[a.views],
  };
  const flags = { options: options.length > 0, follows: a.follows, saves: a.saves, configure: a.configure, expand: a.expand, corner: a.placements !== "panel" };
  const files = {
    "component.ts": "component.ts.tpl",
    "index.ts": "index.ts.tpl",
    [`${Name}.ts`]: "Element.ts.tpl",
    "README.md": "README.md.tpl",
  };
  return Object.fromEntries(Object.entries(files).map(([out, tpl]) => [out, fill(readFileSync(join(TEMPLATES, tpl), "utf8"), fields, flags)]));
}

/** Keep or drop #if blocks, then fill {{fields}}. A line holding only a field that's empty is dropped. */
function fill(template, fields, flags) {
  const out = [];
  const stack = [];
  for (const line of template.replace(/\r\n/g, "\n").split("\n")) {
    const open = /^\s*(?:\/\/#if|<!--#if) (!?)(\w+)\s*(?:-->)?\s*$/.exec(line);
    if (open) {
      stack.push(Boolean(flags[open[2]]) !== (open[1] === "!"));
      continue;
    }
    if (/^\s*(?:\/\/#endif|<!--#endif-->)\s*$/.test(line)) {
      stack.pop();
      continue;
    }
    if (stack.includes(false)) continue;
    const only = /^\s*\{\{(\w+)\}\}\s*$/.exec(line);
    if (only && fields[only[1]] === "") continue;
    out.push(line.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in fields)) throw new Error(`Template field {{${key}}} has no value.`);
      return fields[key];
    }));
  }
  return out.join("\n");
}

// ---- Adding to an app --------------------------------------------------------------------------

/**
 * The app config's text with `entry` added at the end of its top-level components list, on one
 * line with the indentation of the entry before it. The rest of the text is unchanged.
 */
function addToApp(text, entry) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  // Scan the top-level object for "components": [ ... ], skipping strings.
  let depth = 0;
  let i = 0;
  let key;
  let lastString;
  let array;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      lastString = text.slice(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === ":" && depth === 1) key = lastString;
    if (c === "{" || c === "[") {
      depth++;
      if (c === "[" && depth === 2 && key === "components") {
        array = { start: i };
        break;
      }
    }
    if (c === "}" || c === "]") depth--;
    if (c === ",") key = undefined;
    i++;
  }
  const entryText = JSON.stringify(entry).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }");
  const lineStart = (pos) => text.lastIndexOf("\n", pos - 1) + 1;
  const indentAt = (pos) => /^[ \t]*/.exec(text.slice(lineStart(pos)))[0];

  if (!array) {
    // No components list: add one before the closing brace.
    const close = text.lastIndexOf("}");
    const before = text.slice(0, close).replace(/\s*$/, "");
    return `${before},${eol}  "components": [${eol}    ${entryText}${eol}  ]${eol}${text.slice(close)}`;
  }
  // Find the list's end and its last element, at the list's own depth.
  let level = 0;
  let lastValueEnd = -1;
  let lastValueStart = -1;
  let expectValue = true;
  for (i = array.start + 1; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    if (c === '"') {
      if (level === 0 && expectValue) lastValueStart = i;
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      i = j;
      if (level === 0) lastValueEnd = i;
      expectValue = false;
      continue;
    }
    if (c === "{" || c === "[") {
      if (level === 0 && expectValue) lastValueStart = i;
      level++;
      expectValue = false;
      continue;
    }
    if (c === "}" || (c === "]" && level > 0)) {
      level--;
      if (level === 0) lastValueEnd = i;
      continue;
    }
    if (c === "]") break; // the list's end
    if (c === "," && level === 0) {
      expectValue = true;
      continue;
    }
    if (level === 0 && expectValue) lastValueStart = i;
    if (level === 0) lastValueEnd = i;
    expectValue = false;
  }
  const end = i;
  if (lastValueEnd < 0) {
    // An empty list.
    const indent = indentAt(array.start);
    return `${text.slice(0, array.start + 1)}${eol}${indent}  ${entryText}${eol}${indent}${text.slice(end)}`;
  }
  const indent = indentAt(lastValueStart);
  return `${text.slice(0, lastValueEnd + 1)},${eol}${indent}${entryText}${text.slice(lastValueEnd + 1)}`;
}

/** An id for the entry that the app doesn't use yet: name, name-2, name-3... */
function freeId(config, name) {
  const used = new Set((config.components ?? []).map((c) => c?.id));
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name}-${n}`)) n++;
  return `${name}-${n}`;
}

// ---- Main --------------------------------------------------------------------------------------

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        name: { type: "string" },
        heading: { type: "string" },
        icon: { type: "string" },
        placements: { type: "string" },
        "corner-style": { type: "string" },
        expand: { type: "boolean" },
        "no-expand": { type: "boolean" },
        views: { type: "string" },
        option: { type: "string", multiple: true },
        follows: { type: "boolean" },
        saves: { type: "boolean" },
        configure: { type: "boolean" },
        app: { type: "string" },
        yes: { type: "boolean", short: "y" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
    }));
  } catch (err) {
    throw new UsageError(`${err.message.replace(/\. To specify.*$/s, "").replace(/\.?$/, ".")} See --help.`);
  }
  if (values.help) {
    console.log(HELP);
    return;
  }

  const fromFlags = answersFromFlags(values);
  let answers;
  if (values.yes) {
    answers = withDefaults(fromFlags);
  } else {
    const input = lineReader();
    try {
      answers = withDefaults(await askRest(fromFlags, input));
    } finally {
      input.close();
    }
  }

  // Everything is answered: render, then write all files or none.
  const files = render(answers);
  const target = join(EXTENSIONS, answers.name);
  if (existsSync(target)) throw new UsageError(`extensions/${answers.name}/ appeared while you were answering. Nothing was written.`);
  mkdirSync(EXTENSIONS, { recursive: true });
  const temp = join(EXTENSIONS, `.new-${answers.name}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    mkdirSync(temp);
    for (const [file, text] of Object.entries(files)) writeFileSync(join(temp, file), text, { flag: "wx" });
    renameSync(temp, target);
  } catch (err) {
    rmSync(temp, { recursive: true, force: true });
    throw err;
  }

  console.log(`\nCreated extensions/${answers.name}/:`);
  for (const file of Object.keys(files)) console.log(`  ${file}`);

  // The app config last: if this fails, the folder stays, and the entry is printed to add by hand.
  const entry = configEntry(answers);
  let addedTo;
  if (answers.app) {
    const file = join(APPS, `${answers.app}.json`);
    try {
      const text = readFileSync(file, "utf8");
      entry.id = freeId(JSON.parse(text), answers.name);
      const updated = addToApp(text, entry);
      JSON.parse(updated); // never write a file that doesn't parse
      writeFileSync(file, updated);
      addedTo = relative(ROOT, file).replace(/\\/g, "/");
      console.log(`Added ${entryText(entry)} to ${addedTo}.`);
    } catch (err) {
      console.log(`Couldn't add it to public/apps/${answers.app}.json (${err.message}). Add this entry to its components by hand:\n  ${entryText(entry)}`);
    }
  } else {
    console.log(`\nTo use it, add this entry to an app's components in public/apps/<app>.json:\n  ${entryText(entry)}`);
  }

  console.log(`
Next:
  npm run check        type-check it
  npm run dev          then open ${addedTo ? `?app=${answers.app}` : "an app that uses it"}
Then make it yours: start in extensions/${answers.name}/${pascalCase(answers.name)}.ts. See docs/components/getting-started.md.`);
}

main().catch((err) => {
  if (err instanceof UsageError) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
