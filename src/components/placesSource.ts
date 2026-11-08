/**
 * ArcGIS Places as a Search source (geocoding spec, design D16).
 *
 * The SDK has no built-in Places source, so this is a custom `SearchSource` whose
 * `getSuggestions` and `getResults` query the Places service near the searching view's center.
 * `SearchSource` is only available under `@arcgis/core/widgets/`, the one exception to the
 * project's no-widgets rule (approved until the SDK moves it). This module is loaded only when
 * Places is configured and a key is available.
 */
import SearchSource from "@arcgis/core/widgets/Search/SearchSource.js";
import Graphic from "@arcgis/core/Graphic.js";
import Point from "@arcgis/core/geometry/Point.js";
import { queryPlacesNearPoint } from "@arcgis/core/rest/places.js";
import PlacesQueryParameters from "@arcgis/core/rest/support/PlacesQueryParameters.js";
import type { PlacesConfig } from "../config/geocoding.ts";
import { MIN_PLACES_TERM, PlacesSuggester, type Place, type PlacesQuery } from "./placesSuggester.ts";

/** Scale to show a chosen place at: a few streets around it. */
const PLACE_ZOOM_SCALE = 5000;
/** Results per request; the API allows up to 20. */
const PAGE_SIZE = 10;

/** One Places near-point query. The key goes on this request only, never globally (D16). */
function queryWith(apiKey: string) {
  return async (q: PlacesQuery): Promise<Place[]> => {
    const params = new PlacesQueryParameters({
      apiKey,
      point: { longitude: q.longitude, latitude: q.latitude },
      radius: q.radius,
      searchText: q.searchText,
      categoryIds: q.categoryIds.length ? q.categoryIds : undefined,
      pageSize: PAGE_SIZE,
    });
    const answer = await queryPlacesNearPoint(params, q.signal ? { signal: q.signal } : undefined);
    return (answer.results ?? []).map((r) => ({
      placeId: r.placeId,
      name: r.name,
      longitude: r.location.longitude ?? r.location.x,
      latitude: r.location.latitude ?? r.location.y,
      ...(r.categories?.[0]?.label ? { category: r.categories[0].label } : {}),
    }));
  };
}

/** The center of the view that is searching, in WGS84, or undefined before it exists. */
function centerOf(view: { center?: Point | null } | null | undefined): { longitude: number; latitude: number } | undefined {
  const c = view?.center;
  if (c?.longitude == null || c.latitude == null) return undefined;
  return { longitude: c.longitude, latitude: c.latitude };
}

function toResult(place: Place) {
  const graphic = new Graphic({
    geometry: new Point({ longitude: place.longitude, latitude: place.latitude }),
    attributes: { name: place.name, placeId: place.placeId, category: place.category ?? null },
  });
  return { name: place.name, feature: graphic, target: graphic, extent: null };
}

const label = (p: Place) => (p.category ? `${p.name} (${p.category})` : p.name);

/** A Search source for ArcGIS Places, with rationed suggestions. */
export function createPlacesSource(settings: PlacesConfig, apiKey: string): SearchSource {
  const suggester = new PlacesSuggester({ query: queryWith(apiKey), radius: settings.radius, categories: settings.categories });
  const source = new SearchSource({
    placeholder: "Find a place nearby",
    minSuggestCharacters: MIN_PLACES_TERM,
    zoomScale: PLACE_ZOOM_SCALE,
    getSuggestions: async (params, options) => {
      const center = centerOf(params.view);
      if (!center) return [];
      const places = await suggester.suggest(params.suggestTerm, center.longitude, center.latitude, options?.signal ?? undefined);
      return places.map((p) => ({ key: p.placeId, text: label(p), sourceIndex: params.sourceIndex }));
    },
    getResults: async (params, options) => {
      // A chosen suggestion: the place came with it, so no further request is billed.
      const key = params.suggestResult?.key;
      const known = typeof key === "string" ? suggester.place(key) : undefined;
      if (known) return [toResult(known)];
      // Enter on typed text: one query, best match first.
      const center = centerOf(params.view);
      const text = params.suggestResult?.text ?? "";
      if (!center) return [];
      const places = await suggester.search(text, center.longitude, center.latitude, options?.signal ?? undefined);
      return places.slice(0, params.maxResults ?? 6).map(toResult);
    },
  });
  // `name` labels the source in the menu; the typings don't list it, but sources read it.
  (source as unknown as { name: string }).name = settings.name;
  return source;
}
