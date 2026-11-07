/** Path of the runtime config, relative to the app's base URL. */
export const CONFIG_PATH = "config/viewer.json";

export type LoadResult =
  | { ok: true; url: string; raw: unknown }
  | { ok: false; url: string; message: string };

export interface LoadOptions {
  fetch?: typeof fetch;
  /** Vite base URL; defaults to `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  /** Document URL the base is resolved against; defaults to `location.href`. */
  documentUrl?: string;
}

/** Resolve the config URL against the app's base URL. */
export function configUrl(baseUrl: string, documentUrl: string): string {
  return new URL(CONFIG_PATH, new URL(baseUrl, documentUrl)).href;
}

/**
 * Fetch and parse the runtime config. Never throws: a failure comes back as a message that
 * names the config URL and the reason.
 */
export async function loadConfig(options: LoadOptions = {}): Promise<LoadResult> {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const url = configUrl(
    options.baseUrl ?? import.meta.env.BASE_URL,
    options.documentUrl ?? globalThis.location.href,
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
