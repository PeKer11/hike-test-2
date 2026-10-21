import { describe, expect, it, vi } from "vitest";

import { planWalkOrder } from "@/lib/optimization/tsp-planner";
import type { Attraction } from "@/lib/types";

// No ORS in tests: the planner falls back to straight-line distances.
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn().mockRejectedValue(new Error("offline")) }));

const stop = (id: string, lat: number): Attraction => ({
  id,
  name: id,
  coordinates: { lat, lng: 34.77 },
  category: "landmark",
  avgVisitMinutes: 10,
  tags: {},
});

describe("planWalkOrder fixedOrder", () => {
  const origin = { lat: 32.08, lng: 34.77 };
  // "far" is the first requested stop, "near" the second; an optimizer visits near first.
  const stops = [stop("far", 32.1), stop("near", 32.081)];
  const base = { origin, availableMinutes: 480, walkingPaceMinPerKm: 12, radiusMeters: 5000 };

  it("keeps the stated order", async () => {
    const result = await planWalkOrder({ ...base, fixedOrder: true }, stops);
    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["far", "near"]);
  });

  it("still optimizes without it", async () => {
    const result = await planWalkOrder(base, stops);
    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["near", "far"]);
  });
});
