import type { Config } from "@arcgis/core/config.js";
import * as urlUtils from "@arcgis/core/core/urlUtils.js";
import { resolveProxyUrl } from "./request.ts";
import type { RequestConfig } from "./types.ts";

/**
 * Apply the `request` section to the SDK before the map exists (design D9). Site-relative
 * proxy paths are resolved against `baseUrl` (the page's base URL).
 */
export function applyRequest(
  esriConfig: Pick<Config, "request">,
  request: RequestConfig,
  baseUrl: string,
  addProxyRule: (rule: urlUtils.ProxyRule) => number = urlUtils.addProxyRule,
): void {
  if (request.proxyUrl) esriConfig.request.proxyUrl = resolveProxyUrl(request.proxyUrl, baseUrl);
  for (const rule of request.proxyRules) {
    addProxyRule({ urlPrefix: rule.urlPrefix, proxyUrl: resolveProxyUrl(rule.proxyUrl, baseUrl) });
  }
}
