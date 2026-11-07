import { isCredentialKey, type ConfigProblem, type ProxyRule, type RequestConfig } from "./types.ts";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** An absolute URL with one of the given protocols. */
function isAbsoluteUrl(v: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** A path on the viewer's own site: no scheme and not protocol-relative (`//host`). */
function isSitePath(v: string): boolean {
  if (v.startsWith("//") || v.startsWith("\\")) return false;
  try {
    new URL(v); // parses only with a scheme
    return false;
  } catch {
    return v.trim() !== "";
  }
}

/** A proxy URL: absolute https, or a path on the viewer's own site (design D9). */
export const isProxyUrl = (v: unknown): v is string =>
  typeof v === "string" && (isAbsoluteUrl(v, ["https:"]) || isSitePath(v));

const PROXY_URL_MESSAGE = "Expected an absolute https URL or a path on this site, such as proxy/forward.";

/** Validate the `request` section. Problems are appended to `errors` and `warnings`. */
export function validateRequest(raw: unknown, errors: ConfigProblem[], warnings: ConfigProblem[] = []): RequestConfig {
  const result: RequestConfig = { proxyRules: [] };
  if (raw === undefined) return result;
  if (!isObject(raw)) {
    errors.push({ path: "request", message: "Expected an object." });
    return result;
  }

  for (const key of Object.keys(raw)) {
    if (key !== "proxyUrl" && key !== "proxyRules" && !isCredentialKey(key)) {
      warnings.push({ path: `request.${key}`, message: "Unknown setting; it is ignored." });
    }
  }

  if (raw.proxyUrl !== undefined) {
    if (isProxyUrl(raw.proxyUrl)) result.proxyUrl = raw.proxyUrl;
    else errors.push({ path: "request.proxyUrl", message: PROXY_URL_MESSAGE });
  }

  if (raw.proxyRules !== undefined) {
    if (!Array.isArray(raw.proxyRules)) {
      errors.push({ path: "request.proxyRules", message: "Expected an array of { urlPrefix, proxyUrl }." });
    } else {
      raw.proxyRules.forEach((rule: unknown, i) => {
        const path = `request.proxyRules[${i}]`;
        if (!isObject(rule)) {
          errors.push({ path, message: "Expected an object with urlPrefix and proxyUrl." });
          return;
        }
        let ok = true;
        if (typeof rule.urlPrefix !== "string" || !isAbsoluteUrl(rule.urlPrefix, ["https:", "http:"])) {
          errors.push({ path: `${path}.urlPrefix`, message: "Expected an absolute http or https URL prefix." });
          ok = false;
        }
        if (!isProxyUrl(rule.proxyUrl)) {
          errors.push({ path: `${path}.proxyUrl`, message: PROXY_URL_MESSAGE });
          ok = false;
        }
        if (ok) result.proxyRules.push({ urlPrefix: rule.urlPrefix as string, proxyUrl: rule.proxyUrl as string });
      });
    }
  }

  return result;
}

/** Resolve a site-relative proxy path to an absolute URL against the page's base URL. */
export function resolveProxyUrl(proxyUrl: string, baseUrl: string): string {
  return new URL(proxyUrl, baseUrl).href;
}

export type { ProxyRule };
