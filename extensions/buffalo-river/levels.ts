// The level model: the five bands a river level falls in, the USGS gauge readings, and how they
// become a level score for each segment of the river. Scores run from 0 (Very Low) to 1000 (Flood).
// Ported from brokan.xyz/buffalo (buffaloDataHelper.ts and buffaloArcGisHelper.ts). See design D5.
import { riverPath } from "./data/riverPath.ts";
import { distanceMeters, weightedAverage } from "./geo.ts";

export interface LevelBand {
  /** The score at the band's center. */
  score: number;
  label: "Very Low" | "Low" | "Moderate" | "High" | "Flood";
  color: string;
  guidance: string;
}

/** The five bands, lowest first. The colours are data, the same in light and dark mode. */
export const LEVEL_BANDS: readonly LevelBand[] = [
  {
    score: 0,
    label: "Very Low",
    color: "#5813fc",
    guidance: "Too low for most floating. Expect to drag your boat across gravel bars and shallow, rocky stretches.",
  },
  {
    score: 250,
    label: "Low",
    color: "#1cc2fd",
    guidance: "Floatable, but low. Expect some scraping and a few spots where you'll need to hop out and walk your boat.",
  },
  {
    score: 500,
    label: "Moderate",
    color: "#7dfd94",
    guidance: "Ample water for floating. Good conditions for most paddlers and a comfortable, relaxed trip.",
  },
  { score: 750, label: "High", color: "#f5c926", guidance: "Fast current. Experienced floaters only." },
  {
    score: 1000,
    label: "Flood",
    color: "#ff2b18",
    guidance: "Flood stage. The river is dangerous and should be considered closed to floating.",
  },
];

/** The band whose center is nearest `score`. */
export function bandFor(score: number): LevelBand {
  return LEVEL_BANDS.reduce((closest, band) =>
    Math.abs(band.score - score) < Math.abs(closest.score - score) ? band : closest,
  );
}

/** A band of discharge, in cubic feet per second, at one gauge. */
interface DischargeRange {
  min: number;
  max: number;
}

interface GaugeSite {
  id: string;
  name: string;
  /** [longitude, latitude] */
  coord: [number, number];
  /** The discharge for each band, Very Low to Flood. */
  ranges: [DischargeRange, DischargeRange, DischargeRange, DischargeRange, DischargeRange];
}

interface Gauge extends GaugeSite {
  /** Meters along the river path from its first vertex to the vertex nearest the gauge. */
  riverMeters: number;
}

const bands = (low: number, moderate: number, high: number, flood: number): GaugeSite["ranges"] => [
  { min: -Infinity, max: low },
  { min: low, max: moderate },
  { min: moderate, max: high },
  { min: high, max: flood },
  { min: flood, max: Infinity },
];

/** Meters along the path from its first vertex to each vertex. */
const pathMeters: number[] = [0];
for (let i = 1; i < riverPath.length; i++) {
  const [lon1, lat1] = riverPath[i - 1];
  const [lon2, lat2] = riverPath[i];
  pathMeters.push(pathMeters[i - 1] + distanceMeters(lat1, lon1, lat2, lon2));
}

/** Where a gauge is along the river: at the path vertex nearest it. */
function locate(site: GaugeSite): Gauge {
  let nearest = 0;
  let minDistance = Infinity;
  riverPath.forEach(([lon, lat], index) => {
    const distance = distanceMeters(site.coord[1], site.coord[0], lat, lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = index;
    }
  });
  return { ...site, riverMeters: pathMeters[nearest] };
}

const GAUGE_SITES: GaugeSite[] = [
  { id: "USGS-07055646", name: "Boxley", coord: [-93.405, 35.9388888888889], ranges: bands(200, 350, 1500, 6500) },
  { id: "USGS-07055660", name: "Ponca", coord: [-93.3547222222222, 36.0225], ranges: bands(100, 200, 900, 1600) },
  { id: "USGS-07055680", name: "Pruitt", coord: [-93.13777777777779, 36.05916666666666], ranges: bands(100, 200, 1000, 2000) },
  { id: "USGS-07056000", name: "St. Joe", coord: [-92.74722222222222, 35.98305555555556], ranges: bands(40, 200, 3000, 8000) },
  { id: "USGS-07056700", name: "Harriet", coord: [-92.5775, 36.06777777777778], ranges: bands(60, 200, 3000, 9370) },
];

/** The five gauges, upstream first. */
export const GAUGES: readonly Gauge[] = GAUGE_SITES.map(locate);

/** How far a score may change from one segment to the next, which smooths jumps at gauges. */
const MAX_SCORE_CHANGE_PER_SEGMENT = 1;
export const WINDOW_HOURS = 48;
const DISCHARGE_PARAMETER = "00060";
// Buffalo used /ogcapi/v0. The API's own next-page links now point to v1, which answers the same
// request with the same data, so the port uses v1.
const ITEMS_URL = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items";
const PAGE_LIMIT = 1000;

/** Discharge by gauge id at one time. */
type DischargeByGauge = Record<string, number>;

/** One reading time and the river's score for every segment then. */
export interface Reading {
  time: Date;
  /** One score per segment; segment i joins path vertices i and i + 1. */
  scores: number[];
}

function readingsUrl(windowEnd: Date): string {
  const iso = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");
  const start = new Date(windowEnd.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const params = new URLSearchParams({
    f: "json",
    limit: String(PAGE_LIMIT),
    properties: "monitoring_location_id,value,time",
    skipGeometry: "true",
    datetime: `${iso(start)}/${iso(windowEnd)}`,
    monitoring_location_id: GAUGES.map((g) => g.id).join(","),
    parameter_code: DISCHARGE_PARAMETER,
  });
  return `${ITEMS_URL}?${params}`;
}

interface ItemsPage {
  features?: { properties?: { monitoring_location_id?: string; value?: string | number; time?: string } }[];
  links?: { rel?: string; href?: string }[];
}

/** Every reading in the window, following the API's next-page links. */
async function fetchDischarge(windowEnd: Date, signal: AbortSignal): Promise<Map<number, DischargeByGauge>> {
  const byTime = new Map<number, DischargeByGauge>();
  let url: string | undefined = readingsUrl(windowEnd);
  while (url) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`USGS readings request failed: HTTP ${response.status}`);
    const page = (await response.json()) as ItemsPage;
    for (const feature of page.features ?? []) {
      const { monitoring_location_id: gauge, value, time } = feature.properties ?? {};
      const discharge = typeof value === "number" ? value : Number.parseFloat(value ?? "");
      const at = time ? Date.parse(time) : NaN;
      if (!gauge || !Number.isFinite(discharge) || !Number.isFinite(at)) continue;
      const entry = byTime.get(at) ?? {};
      entry[gauge] = discharge;
      byTime.set(at, entry);
    }
    url = page.links?.find((link) => link.rel === "next")?.href;
  }
  return byTime;
}

/**
 * Fills each time's missing gauges from the time before it. The first time takes them from the
 * earliest time that has every gauge.
 */
function fillGaps(times: number[], byTime: Map<number, DischargeByGauge>): void {
  const complete = (entry: DischargeByGauge) => GAUGES.every((g) => entry[g.id] !== undefined);
  let previous = times.map((t) => byTime.get(t)!).find(complete);
  if (!previous) throw new Error("No time in the window has a reading at every gauge");
  for (const time of times) {
    const entry = byTime.get(time)!;
    for (const gauge of GAUGES) entry[gauge.id] ??= previous[gauge.id];
    previous = entry;
  }
}

/** Every whole hour in the window, plus the newest reading. */
function hourlyTimes(sorted: number[]): number[] {
  const newest = sorted[sorted.length - 1];
  return [...sorted.slice(0, -1).filter((t) => new Date(t).getUTCMinutes() === 0), newest];
}

/** The score for `discharge` within `ranges`, interpolated across the middle bands. */
function scoreFor(discharge: number, ranges: readonly DischargeRange[]): number {
  const last = ranges.length - 1;
  for (let i = 0; i < ranges.length; i++) {
    const { min, max } = ranges[i];
    if (discharge >= min && discharge < max) {
      if (i === 0) return 0;
      if (i === last) return 1000;
      const center = i / last;
      const lower = center - 0.5 / last;
      const upper = center + 0.5 / last;
      return Math.round((lower + ((discharge - min) / (max - min)) * (upper - lower)) * 1000);
    }
  }
  throw new Error(`Discharge ${discharge} is in no band`);
}

/** Ranges blended between two gauges; infinite ends stay infinite. */
function blendRanges(a: readonly DischargeRange[], b: readonly DischargeRange[], weightA: number): DischargeRange[] {
  return a.map((range, i) => ({
    min: Number.isFinite(range.min) && Number.isFinite(b[i].min) ? weightedAverage(range.min, b[i].min, weightA) : range.min,
    max: Number.isFinite(range.max) && Number.isFinite(b[i].max) ? weightedAverage(range.max, b[i].max, weightA) : range.max,
  }));
}

/** How one segment's score is worked out: from one gauge, or two blended. Fixed for the river. */
interface SegmentModel {
  a: Gauge;
  b: Gauge | null;
  /** The weight of gauge a, by distance: the nearer gauge counts more. */
  weightA: number;
}

const distanceTo = ([lon, lat]: [number, number], gauge: Gauge) => distanceMeters(lat, lon, gauge.coord[1], gauge.coord[0]);

/** For each segment, the gauges either side of its downstream end along the river. */
const SEGMENT_MODELS: SegmentModel[] = (() => {
  const models: SegmentModel[] = [];
  let riverMeters = 0;
  for (let j = 0; j < riverPath.length - 1; j++) {
    const [lon1, lat1] = riverPath[j];
    const end = riverPath[j + 1];
    riverMeters += distanceMeters(lat1, lon1, end[1], end[0]);
    const below = GAUGES.findIndex((g) => riverMeters < g.riverMeters);
    if (below === 0) {
      models.push({ a: GAUGES[0], b: null, weightA: 1 });
    } else if (below === -1) {
      models.push({ a: GAUGES[GAUGES.length - 1], b: null, weightA: 1 });
    } else {
      const a = GAUGES[below - 1];
      const b = GAUGES[below];
      const toA = distanceTo(end, a);
      const toB = distanceTo(end, b);
      models.push({ a, b, weightA: toA + toB === 0 ? 0.5 : toB / (toA + toB) });
    }
  }
  return models;
})();

/** The score of every segment for one time's discharges. */
function segmentScores(discharge: DischargeByGauge): number[] {
  const scores: number[] = [];
  let previous = -1;
  for (const { a, b, weightA } of SEGMENT_MODELS) {
    let score = b
      ? scoreFor(weightedAverage(discharge[a.id], discharge[b.id], weightA), blendRanges(a.ranges, b.ranges, weightA))
      : scoreFor(discharge[a.id], a.ranges);
    if (previous !== -1) {
      score = Math.min(previous + MAX_SCORE_CHANGE_PER_SEGMENT, Math.max(previous - MAX_SCORE_CHANGE_PER_SEGMENT, score));
    }
    scores.push(score);
    previous = score;
  }
  return scores;
}

/**
 * The river's scores at each whole hour of the 48 hours before `windowEnd`, and at the newest
 * reading, oldest first. Rejects when the readings can't be fetched or are unusable.
 */
export async function loadReadings(signal: AbortSignal, windowEnd = new Date()): Promise<Reading[]> {
  const byTime = await fetchDischarge(windowEnd, signal);
  const sorted = [...byTime.keys()].sort((x, y) => x - y);
  if (sorted.length === 0) throw new Error("No USGS readings in the window");
  fillGaps(sorted, byTime);
  return hourlyTimes(sorted).map((time) => ({ time: new Date(time), scores: segmentScores(byTime.get(time)!) }));
}
