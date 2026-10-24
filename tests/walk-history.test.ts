import { describe, expect, it } from "vitest";

import type { Attraction } from "@/lib/types/walk-plan";

import { newWalkFromPlan, paramsFromInput, rebuildFromSaved, stopsFromAttractions, titleForWalk } from "@/lib/walks/walk-history";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const a = (id: string, name: string): Attraction => ({
  id, name, coordinates: { lat: 1, lng: 2 }, category: "park", avgVisitMinutes: 5, tags: {},
});
const input = { origin: { lat: 3, lng: 4 }, availableMinutes: 90, walkingPaceMinPerKm: 11, radiusMeters: 2000 };

describe("walk-history", () => {
  it("maps stops and keeps google place ids only", () => {
    expect(stopsFromAttractions([a("google-ABC", "Cafe"), a("osm-1", "Park")])).toEqual([
      { name: "Cafe", category: "park", lat: 1, lng: 2, placeId: "ABC" },
      { name: "Park", category: "park", lat: 1, lng: 2 },
    ]);
  });
  it("keeps params small and omits unset ones", () => {
    expect(paramsFromInput(input)).toEqual({ availableMinutes: 90, walkingPaceMinPerKm: 11, radiusMeters: 2000 });
  });
  it("titles by first stop", () => {
    const d = new Date(2026, 9, 24);
    expect(titleForWalk([], d)).toBe("Walk, Oct 24");
    expect(titleForWalk(stopsFromAttractions([a("x", "A"), a("y", "B")]), d)).toBe("A + 1 more, Oct 24");
  });
  it("round-trips a walk for walk-again", () => {
    const n = newWalkFromPlan(input, [a("google-ABC", "Cafe")], 61.4, 4200.6);
    expect(n.totalMin).toBe(61);
    const w = { ...n, id: "w1", params: n.params ?? {}, totalMin: 61, distanceM: 4201 } as unknown as SavedWalk;
    const r = rebuildFromSaved(w);
    expect(r.input).toMatchObject({ origin: { lat: 3, lng: 4 }, availableMinutes: 90, radiusMeters: 2000 });
    expect(r.attractions[0].id).toBe("google-ABC");
  });
});
