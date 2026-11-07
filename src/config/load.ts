/** Default config name; the file is `config/<name>.json` relative to the app's base URL. */
export const DEFAULT_CONFIG_NAME = "viewer";
/** Path of the default runtime config, relative to the app's base URL. */
export const CONFIG_PATH = `config/${DEFAULT_CONFIG_NAME}.json`;

/** `?config=` values: plain names only, so a link can't point at another site or path (D8). */
const CONFIG_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export const CONFIG_PARAM_MESSAGE =
  'The "config" URL parameter must be a config name of 1 to 64 letters, digits, hyphens, or underscores, such as ?config=county. Paths and URLs are not allowed.';

export type LoadResult =
  | { ok: true; url: string; raw: unknown }
  /** `url` is absent when no request was made (a rejected `?config=` value). */
  | { ok: false; url?: string; message: string };

export interface LoadOptions {
  fetch?: typeof fetch;
  /** Vite base URL; defaults to `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  /** Document URL the base is resolved against; defaults to `location.href`. */
  documentUrl?: string;
  /** Page query string holding `?config=`; defaults to `location.search`. */
  search?: string;
}

/** Resolve a config name to its URL against the app's base URL. */
export function configUrl(baseUrl: string, documentUrl: string, name = DEFAULT_CONFIG_NAME): string {
  return new URL(`config/${name}.json`, new URL(baseUrl, documentUrl)).href;
}

/**
 * The config name chosen by `?config=`: the default when the parameter is absent, or
 * undefined when its value is not a plain name.
 */
export function configName(search: string): string | undefined {
  const value = new URLSearchParams(search).get("config");
  if (value === null) return DEFAULT_CONFIG_NAME;
  return CONFIG_NAME.test(value) ? value : undefined;
}

/**
 * Fetch and parse the runtime config. Never throws: a failure comes back as a message that
 * names the config URL and the reason.
 */
export async function loadConfig(options: LoadOptions = {}): Promise<LoadResult> {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const name = configName(options.search ?? globalThis.location?.search ?? "");
  if (name === undefined) return { ok: false, message: CONFIG_PARAM_MESSAGE };

  const url = configUrl(
    options.baseUrl ?? import.meta.env.BASE_URL,
    options.documentUrl ?? globalThis.location.href,
    name,
  );

  let response: Response;
  try {
    // no-cache: revalidate, so an edited deployed config takes effect on reload.
    response = await doFetch(url, { cache: "no-cache" });
  } catch (err) {
    return { ok: false, url, message: `Could not load the config from ${url}: ${errorText(err)}` };
  }

  if (!response.ok) {
    const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    return { ok: false, url, message: `Could not load the config from ${url}: ${status}.` };
  }

  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    return { ok: false, url, message: `Could not read the config from ${url}: ${errorText(err)}` };
  }

  try {
    return { ok: true, url, raw: JSON.parse(text) };
  } catch (err) {
    return { ok: false, url, message: `The config at ${url} is not valid JSON: ${errorText(err)}` };
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
