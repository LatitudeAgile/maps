// Stats as text, in the configured units and the browser's locale. Plain code: no SDK or element
// imports.
import type { Stats } from "./stats.ts";

export type Units = "imperial" | "metric";

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

const number = (value: number, unit: string, digits: number): string =>
  new Intl.NumberFormat(undefined, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: digits }).format(value);

/** "14.2 mi" or "22.9 km"; short distances in feet or meters. */
export function formatDistance(meters: number, units: Units): string {
  if (units === "metric") return meters < 1000 ? number(Math.round(meters), "meter", 0) : number(meters / 1000, "kilometer", 1);
  const miles = meters / METERS_PER_MILE;
  return miles < 0.1 ? number(Math.round(meters / METERS_PER_FOOT), "foot", 0) : number(miles, "mile", miles < 10 ? 2 : 1);
}

/** "2,310 ft" or "704 m". */
export function formatHeight(meters: number, units: Units): string {
  return units === "metric" ? number(Math.round(meters), "meter", 0) : number(Math.round(meters / METERS_PER_FOOT), "foot", 0);
}

/** "6 h 41 min", or "41 min" under an hour. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const min = number(rest, "minute", 0);
  return hours ? `${number(hours, "hour", 0)} ${min}` : min;
}

/** "Oct 12, 2026", in the browser's locale. */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** The list's one-line summary: distance and date, or the waypoint count. */
export function formatSummary(stats: Stats, units: Units): string {
  const parts: string[] = [];
  if (stats.distance !== undefined) parts.push(formatDistance(stats.distance, units));
  else if (stats.waypoints) parts.push(stats.waypoints === 1 ? "1 waypoint" : `${stats.waypoints} waypoints`);
  if (stats.start !== undefined) parts.push(formatDate(stats.start));
  return parts.join(" · ");
}
