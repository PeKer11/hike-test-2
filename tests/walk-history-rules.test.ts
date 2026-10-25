import { describe, expect, it } from "vitest";

import { newWalkFromPlan, rebuildFromSaved, stopsFromAttractions } from "@/lib/walks/walk-history";
import type { SavedWalk } from "@/lib/walks/saved-walks";
import type { Attraction } from "@/lib/types/walk-plan";

const stop = (id: string, tags: Record<string, unknown> = {}): Attraction => ({
  id,
  name: id,
  coordinates: { lat: 32.07, lng: 34.77 },
  category: "landmark",
  avgVisitMinutes: 30,
  tags,
});
const input = { origin: { lat: 32.07, lng: 34.77 }, availableMinutes: 90, walkingPaceMinPerKm: 15, radiusMeters: 2000 };

describe("saved walks keep identity and rules", () => {
  it("keeps the Google place id of chat and AI-builder stops, not only google- ids", () => {
    const stops = stopsFromAttractions([stop("google-AAA"), stop("ai-BBB", { placeId: "BBB" }), stop("osm-1")]);
    expect(stops.map((s) => s.placeId)).toEqual(["AAA", "BBB", undefined]);
  });

  it("round-trips the route rules, and gives an empty set when none were saved", () => {
    const withRules = newWalkFromPlan(input, [stop("google-AAA")], 80, 3000, { avoidStreets: ["Allenby"] });
    const saved = { ...withRules, id: "w1" } as unknown as SavedWalk;
    expect(rebuildFromSaved(saved).routeRules).toEqual({ avoidStreets: ["Allenby"] });
    const plain = { ...newWalkFromPlan(input, [stop("google-AAA")], 80, 3000), id: "w2" } as unknown as SavedWalk;
    expect(rebuildFromSaved(plain).routeRules).toEqual({});
  });
});
