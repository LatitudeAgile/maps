/**
 * The rationing and caching behind the Places search source (geocoding spec, design D16), kept
 * free of SDK imports so it can be tested with a stand-in query and fake timers. Each Places
 * request that returns results is billed, so:
 * - no request below the API's 3-character minimum;
 * - a pause after the latest call, so only the last term of a burst is sent;
 * - a cache keyed by term and (rounded) map center.
 */

/** A place as this module needs it. */
export interface Place {
  placeId: string;
  name: string;
  /** WGS84. */
  longitude: number;
  latitude: number;
  /** The first category's label, if any. */
  category?: string;
}

export interface PlacesQuery {
  searchText: string;
  longitude: number;
  latitude: number;
  radius: number;
  categoryIds: string[];
  signal?: AbortSignal;
}

export interface PlacesSuggesterOptions {
  /** Runs one Places near-point query. */
  query: (q: PlacesQuery) => Promise<Place[]>;
  radius: number;
  categories: string[];
  /** Pause after the latest call before sending; default 300 ms. */
  delayMs?: number;
  /** For tests. */
  wait?: (ms: number) => Promise<void>;
}

/** The Places API's minimum search text length. */
export const MIN_PLACES_TERM = 3;
export const PLACES_SUGGEST_DELAY_MS = 300;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** About 100 m: close enough that the same term finds the same places. */
const round = (degrees: number) => Math.round(degrees * 1000) / 1000;

export class PlacesSuggester {
  private latest = 0;
  private readonly cache = new Map<string, Promise<Place[]>>();
  /** Places seen in any answer, so choosing a suggestion needs no further request. */
  private readonly known = new Map<string, Place>();

  constructor(private readonly options: PlacesSuggesterOptions) {}

  /** Suggestions for a term near a point. Superseded and too-short calls send nothing. */
  async suggest(term: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<Place[]> {
    const text = term.trim();
    if (text.length < MIN_PLACES_TERM) return [];
    const mine = ++this.latest;
    await (this.options.wait ?? defaultWait)(this.options.delayMs ?? PLACES_SUGGEST_DELAY_MS);
    if (mine !== this.latest || signal?.aborted) return [];
    return this.lookUp(text, longitude, latitude, signal);
  }

  /** A search the user asked for (Enter): no pause, but the same cache. */
  search(term: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<Place[]> {
    const text = term.trim();
    if (text.length < MIN_PLACES_TERM) return Promise.resolve([]);
    return this.lookUp(text, longitude, latitude, signal);
  }

  /** A place from an earlier answer, by id. */
  place(placeId: string): Place | undefined {
    return this.known.get(placeId);
  }

  private lookUp(text: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<Place[]> {
    const key = `${text.toLowerCase()}|${round(longitude)}|${round(latitude)}`;
    let answer = this.cache.get(key);
    if (!answer) {
      answer = this.options
        .query({ searchText: text, longitude, latitude, radius: this.options.radius, categoryIds: this.options.categories, signal })
        .then((places) => {
          for (const p of places) this.known.set(p.placeId, p);
          return places;
        });
      this.cache.set(key, answer);
      // A failed or cancelled request isn't cached, so the next call tries again.
      answer.catch(() => this.cache.delete(key));
    }
    return answer;
  }
}
