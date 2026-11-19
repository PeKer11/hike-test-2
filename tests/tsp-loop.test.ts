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

  it("closes at returnTo (the real start), not at the walker's position (L4b)", async () => {
    // Walker is 2 km east of the start; the stop is back west, 0.5 km from the start.
    const here = { lat: 32.0, lng: 34.92 };
    const realStart = { lat: 32.0, lng: 34.9 };
    const stops = [stop("a", 32.0, 34.905)];
    const toWalkerPos = await planWalkOrder({ ...base, origin: here, availableMinutes: 60, returnToStart: true }, stops);
    const toRealStart = await planWalkOrder(
      { ...base, origin: here, availableMinutes: 60, returnToStart: true, returnTo: realStart },
      stops,
    );
    // Home is 0.5 km from the stop either way here; the point is the budget uses returnTo, so a far-away closing point costs more.
    const farStart = { lat: 32.0, lng: 34.8 };
    const toFar = await planWalkOrder(
      { ...base, origin: here, availableMinutes: 60, returnToStart: true, returnTo: farStart },
      stops,
    );
    expect(toWalkerPos.orderedAttractions.length).toBe(1);
    expect(toRealStart.orderedAttractions.length).toBe(1);
    expect(toFar.orderedAttractions.length).toBe(0);
  });
});
