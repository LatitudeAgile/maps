import { describe, expect, test } from "vitest";
import { PlacesSuggester, type Place, type PlacesQuery } from "./placesSuggester.ts";

const UNION: Place = { placeId: "p1", name: "Union Station", longitude: -105.0, latitude: 39.753, category: "Train Station" };

/** A stand-in query that records calls, and a wait the test releases by hand. */
function setup() {
  const calls: PlacesQuery[] = [];
  const waits: (() => void)[] = [];
  const suggester = new PlacesSuggester({
    radius: 2000,
    categories: ["cat1"],
    query: async (q) => {
      calls.push(q);
      return [UNION];
    },
    wait: () => new Promise<void>((resolve) => waits.push(resolve)),
  });
  const releaseAll = () => waits.splice(0).forEach((r) => r());
  return { suggester, calls, releaseAll };
}

describe("Places rationing (geocoding spec)", () => {
  test("Short term: no request below 3 characters", async () => {
    const s = setup();
    await expect(s.suggester.suggest("Un", -105, 39.75)).resolves.toEqual([]);
    expect(s.calls).toEqual([]);
  });

  test("Fast typing: only the latest term is sent", async () => {
    const s = setup();
    const a = s.suggester.suggest("Uni", -105, 39.75);
    const b = s.suggester.suggest("Unio", -105, 39.75);
    const c = s.suggester.suggest("Union", -105, 39.75);
    s.releaseAll();
    await expect(a).resolves.toEqual([]);
    await expect(b).resolves.toEqual([]);
    await expect(c).resolves.toEqual([UNION]);
    expect(s.calls.map((q) => q.searchText)).toEqual(["Union"]);
    expect(s.calls[0]).toMatchObject({ longitude: -105, latitude: 39.75, radius: 2000, categoryIds: ["cat1"] });
  });

  test("Repeated term: one request, same suggestions, at the same (rounded) center", async () => {
    const s = setup();
    const first = s.suggester.suggest("Union", -105, 39.75);
    s.releaseAll();
    const one = await first;
    // A few meters away rounds to the same center.
    const second = s.suggester.suggest("union", -105.0001, 39.7501);
    s.releaseAll();
    expect(await second).toEqual(one);
    expect(s.calls).toHaveLength(1);
  });

  test("a different center is a new request", async () => {
    const s = setup();
    const a = s.suggester.suggest("Union", -105, 39.75);
    s.releaseAll();
    await a;
    const b = s.suggester.suggest("Union", -104.9, 39.75);
    s.releaseAll();
    await b;
    expect(s.calls).toHaveLength(2);
  });

  test("a chosen suggestion is known, so it costs no request; Enter searches without waiting", async () => {
    const s = setup();
    const a = s.suggester.suggest("Union", -105, 39.75);
    s.releaseAll();
    await a;
    expect(s.suggester.place("p1")).toEqual(UNION);
    await expect(s.suggester.search("Union", -105, 39.75)).resolves.toEqual([UNION]);
    expect(s.calls).toHaveLength(1); // cached
    await expect(s.suggester.search("Coors Field", -105, 39.75)).resolves.toEqual([UNION]);
    expect(s.calls.map((q) => q.searchText)).toEqual(["Union", "Coors Field"]);
  });

  test("a failed request isn't cached", async () => {
    let fail = true;
    const calls: string[] = [];
    const suggester = new PlacesSuggester({
      radius: 1000,
      categories: [],
      query: async (q) => {
        calls.push(q.searchText);
        if (fail) throw new Error("network");
        return [UNION];
      },
      wait: async () => undefined,
    });
    await expect(suggester.suggest("Union", -105, 39.75)).rejects.toThrow("network");
    fail = false;
    await expect(suggester.suggest("Union", -105, 39.75)).resolves.toEqual([UNION]);
    expect(calls).toEqual(["Union", "Union"]);
  });
});
