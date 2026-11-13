/**
 * Finds the extension folders under `extensions/` and serves them as the virtual module
 * `virtual:viewer-extensions` (add-drop-in-extensions D1).
 *
 * Each folder becomes `{ folder, manifest }`, where `manifest` is the default export of its
 * `component.ts`, or `{ folder, problem }` when it has none. The viewer checks the manifests at
 * startup (src/components/extensions.ts). Folders whose names start with a dot are ignored, as
 * are files directly in `extensions/`.
 *
 * In dev, adding or removing a folder or a `component.ts` reloads the page with the new list.
 * Edits inside an extension use normal HMR.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";

const VIRTUAL_ID = "virtual:viewer-extensions";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const MANIFEST = "component.ts";

/** One folder's record, as the virtual module exports it. */
type Folder = { folder: string; manifestPath: string } | { folder: string; problem: string };

/** The folders under `dir`, in alphabetical order, each with its manifest or its problem. */
export function listExtensionFolders(dir: string): Folder[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort()
    .map((folder): Folder => {
      // Names exactly as stored on disk, so a wrong-case manifest is caught on Windows too.
      const files = readdirSync(join(dir, folder));
      if (files.includes(MANIFEST)) return { folder, manifestPath: `/extensions/${folder}/${MANIFEST}` };
      const nearMiss = files.find((name) => name.toLowerCase() === MANIFEST);
      return nearMiss
        ? { folder, problem: `it has no ${MANIFEST} (it has ${nearMiss}; the name must be all lowercase)` }
        : { folder, problem: `it has no ${MANIFEST}` };
    });
}

/** The virtual module's code: one namespace import per manifest, so a missing default export is undefined, not a build error. */
function moduleCode(folders: Folder[]): string {
  const imports: string[] = [];
  const records = folders.map((record, index) => {
    if ("problem" in record) return `  { folder: ${JSON.stringify(record.folder)}, problem: ${JSON.stringify(record.problem)} },`;
    imports.push(`import * as manifest${index} from ${JSON.stringify(record.manifestPath)};`);
    return `  { folder: ${JSON.stringify(record.folder)}, manifest: manifest${index}.default },`;
  });
  return `${imports.join("\n")}\nexport const folders = [\n${records.join("\n")}\n];\n`;
}

export function extensionsPlugin(): Plugin {
  let dir = "";
  return {
    name: "viewer-extensions",
    configResolved(config) {
      dir = resolve(config.root, "extensions");
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_ID ? moduleCode(listExtensionFolders(dir)) : undefined;
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(dir);
      const changed = (path: string, isDir: boolean): boolean => {
        const full = resolve(path);
        if (full === dir) return true; // extensions/ itself added or removed
        if (isDir) return dirname(full) === dir; // a folder in extensions/
        return dirname(dirname(full)) === dir && basename(full).toLowerCase() === MANIFEST; // a manifest
      };
      // One reload for a burst of changes, such as a folder copied in or deleted with its files.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reload = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          for (const environment of Object.values(server.environments)) {
            const module = environment.moduleGraph.getModuleById(RESOLVED_ID);
            if (module) environment.moduleGraph.invalidateModule(module);
          }
          server.ws.send({ type: "full-reload" });
        }, 150);
      };
      server.watcher.on("addDir", (path) => changed(path, true) && reload());
      server.watcher.on("unlinkDir", (path) => changed(path, true) && reload());
      server.watcher.on("add", (path) => changed(path, false) && reload());
      server.watcher.on("unlink", (path) => changed(path, false) && reload());
    },
  };
}
