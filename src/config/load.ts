/**
 * The default app's name, loaded with no `?app=`; its file is `apps/<name>.json` relative to the
 * app's base URL (add-app-selector D12).
 */
export const DEFAULT_CONFIG_NAME = "default";
/** The folder holding every app's config, relative to the app's base URL. */
export const APPS_FOLDER = "apps";
/** URL parameter that names the app to open. */
export const APP_PARAM = "app";
/** Path of the default runtime config, relative to the app's base URL. */
export const CONFIG_PATH = `${APPS_FOLDER}/${DEFAULT_CONFIG_NAME}.json`;

/** `?app=` values: plain names only, so a link can't point at another site or path (D8). */
const CONFIG_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export const CONFIG_PARAM_MESSAGE =
  'The "app" URL parameter must be an app name of 1 to 64 letters, digits, hyphens, or underscores, such as ?app=county. Paths and URLs are not allowed.';

export type LoadResult =
  | { ok: true; url: string; raw: unknown }
  /** `url` is absent when no request was made (a rejected `?app=` value). */
  | { ok: false; url?: string; message: string };

export interface LoadOptions {
  fetch?: typeof fetch;
  /** Vite base URL; defaults to `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  /** Document URL the base is resolved against; defaults to `location.href`. */
  documentUrl?: string;
  /** Page query string holding `?app=`; defaults to `location.search`. */
  search?: string;
}

/** Resolve an app name to its config's URL against the app's base URL. */
export function configUrl(baseUrl: string, documentUrl: string, name = DEFAULT_CONFIG_NAME): string {
  return new URL(`${APPS_FOLDER}/${name}.json`, new URL(baseUrl, documentUrl)).href;
}

/**
 * The app name chosen by `?app=`: the default when the parameter is absent, or undefined when
 * its value is not a plain name. A `config` parameter is ignored (add-app-selector D12).
 */
export function configName(search: string): string | undefined {
  const value = new URLSearchParams(search).get(APP_PARAM);
  if (value === null) return DEFAULT_CONFIG_NAME;
  return isConfigName(value) ? value : undefined;
}

/** Whether `value` is a plain app name, the rule `?app=` and the app catalog share. */
export const isConfigName = (value: string): boolean => CONFIG_NAME.test(value);

/**
 * Fetch and parse the runtime config. Never throws: a failure comes back as a message that
 * names the config URL and the reason.
 */
export async function loadConfig(options: LoadOptions = {}): Promise<LoadResult> {
  const name = configName(options.search ?? globalThis.location?.search ?? "");
  if (name === undefined) return { ok: false, message: CONFIG_PARAM_MESSAGE };
  return loadNamedConfig(name, options);
}

/**
 * Fetch and parse `apps/<name>.json`, for the page's own config or another app's listing
 * (add-app-selector D2). `name` must already follow the config-name rule. Never throws.
 */
export function loadNamedConfig(name: string, options: Omit<LoadOptions, "search"> = {}): Promise<LoadResult> {
  const url = configUrl(
    options.baseUrl ?? import.meta.env.BASE_URL,
    options.documentUrl ?? globalThis.location.href,
    name,
  );
  return fetchJson(url, "the config", options.fetch);
}

/** A JSON fetch result; `status` is the HTTP status when the server answered with an error. */
export type JsonResult =
  | { ok: true; url: string; raw: unknown }
  | { ok: false; url: string; message: string; status?: number };

/**
 * Fetch `url` and parse it as JSON (add-app-selector D2). `what` names the file in messages,
 * such as "the config". Never throws: a failure is a message naming the URL and the reason.
 */
export async function fetchJson(url: string, what: string, fetchFn?: typeof fetch): Promise<JsonResult> {
  const doFetch = fetchFn ?? globalThis.fetch.bind(globalThis);
  let response: Response;
  try {
    // no-cache: revalidate, so an edited deployed file takes effect on reload. Accept JSON
    // only: the dev server answers `*/*` for a missing file with index.html, not a 404.
    response = await doFetch(url, { cache: "no-cache", headers: { Accept: "application/json" } });
  } catch (err) {
    return { ok: false, url, message: `Could not load ${what} from ${url}: ${errorText(err)}` };
  }

  if (!response.ok) {
    const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    return { ok: false, url, status: response.status, message: `Could not load ${what} from ${url}: ${status}.` };
  }

  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    return { ok: false, url, message: `Could not read ${what} from ${url}: ${errorText(err)}` };
  }

  try {
    return { ok: true, url, raw: JSON.parse(text) };
  } catch (err) {
    const label = what.replace(/^the /, "");
    return { ok: false, url, message: `The ${label} at ${url} is not valid JSON: ${errorText(err)}` };
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
