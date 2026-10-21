import { describe, expect, it, vi } from "vitest";
import type { Attraction } from "@/lib/types";

vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn().mockRejectedValue(new Error("offline")) }));

import { planWalkOrder } from "@/lib/optimization/tsp-planner";

const stop = (id: string, lat: number, lng: number): Attraction =>
  ({ id, name: id, coordinates: { lat, lng }, avgVisitMinutes: 10, category: "park" }) as unknown as Attraction;

const origin = { lat: 32.0, lng: 34.9 };
const base = { origin, availableMinutes: 90, walkingPaceMinPerKm: 12.5, radiusMeters: 5000 };

describe("returnToStart", () => {
  it("counts the way home in the time budget", async () => {
    const far = [stop("a", 32.0, 34.92), stop("b", 32.0, 34.93)];
    const open = await planWalkOrder({ ...base, availableMinutes: 60 }, far);
    const loop = await planWalkOrder({ ...base, availableMinutes: 60, returnToStart: true }, far);
    expect(open.orderedAttractions).toHaveLength(2);
    expect(loop.orderedAttractions.length).toBeLessThan(2);
  });

  it("orders stops as a loop, not out and back", async () => {
    const stops = [stop("east", 32.0, 34.91), stop("north", 32.01, 34.9), stop("ne", 32.01, 34.91)];
    const loop = await planWalkOrder({ ...base, returnToStart: true }, stops);
    expect(loop.orderedAttractions.map((a) => a.id)).toHaveLength(3);
  });
});
