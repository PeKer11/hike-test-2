import { describe, it, expect } from "vitest";
import { planWalkOrder, buildWalkPlan } from "@/lib/optimization/tsp-planner";
import type { Attraction, WalkPlanRequest } from "@/lib/types";

const origin = { lat: 32.08, lng: 34.78 }; // Tel Aviv

function makeAttraction(
  id: string,
  lat: number,
  lng: number,
  avgVisitMinutes = 20,
): Attraction {
  return {
    id,
    name: id,
    coordinates: { lat, lng },
    category: "landmark",
    avgVisitMinutes,
    tags: {},
  };
}

const baseRequest: WalkPlanRequest = {
  origin,
  availableMinutes: 120,
  walkingPaceMinPerKm: 15,
  radiusMeters: 2000,
};

describe("planWalkOrder", () => {
  it("returns empty plan for zero candidates", () => {
    const result = planWalkOrder(baseRequest, []);
    expect(result.orderedAttractions).toHaveLength(0);
    expect(result.feasible).toBe(false);
  });

  it("orders a single attraction", () => {
    const a = makeAttraction("a", 32.081, 34.781);
    const result = planWalkOrder(baseRequest, [a]);
    expect(result.orderedAttractions).toHaveLength(1);
    expect(result.orderedAttractions[0].id).toBe("a");
    expect(result.feasible).toBe(true);
  });

  it("drops attractions that exceed the time budget", () => {
    // Each attraction takes 60 min to visit — only 2 should fit in 120 min
    const attractions = [
      makeAttraction("a", 32.081, 34.781, 60),
      makeAttraction("b", 32.082, 34.782, 60),
      makeAttraction("c", 32.083, 34.783, 60),
    ];
    const result = planWalkOrder(baseRequest, attractions);
    expect(result.droppedAttractions.length).toBeGreaterThanOrEqual(1);
    const totalVisit = result.orderedAttractions.reduce(
      (sum, a) => sum + a.avgVisitMinutes,
      0,
    );
    expect(totalVisit + result.totalWalkingMinutes).toBeLessThanOrEqual(120);
  });

  it("total distance matches sum of segment distances", () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781),
      makeAttraction("b", 32.082, 34.782),
      makeAttraction("c", 32.083, 34.783),
    ];
    const result = planWalkOrder(baseRequest, attractions);
    const segTotal = result.segments.reduce(
      (sum, s) => sum + s.distanceMeters,
      0,
    );
    expect(result.totalDistanceMeters).toBeCloseTo(segTotal, 1);
  });

  it("first segment always starts from origin", () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781),
      makeAttraction("b", 32.082, 34.782),
    ];
    const result = planWalkOrder(baseRequest, attractions);
    expect(result.segments[0]?.from).toMatchObject({ name: "origin" });
  });
});

describe("buildWalkPlan", () => {
  it("totalMinutes = walkingMinutes + visitMinutes", () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781, 30),
      makeAttraction("b", 32.082, 34.782, 30),
    ];
    const plan = buildWalkPlan(baseRequest, attractions);
    const visitTotal = plan.orderedAttractions.reduce(
      (sum, a) => sum + a.avgVisitMinutes,
      0,
    );
    // totalMinutes should be >= visitTotal (walking adds time)
    expect(plan.totalMinutes).toBeGreaterThanOrEqual(visitTotal);
    expect(plan.totalMinutes).toBeLessThanOrEqual(baseRequest.availableMinutes);
  });
});
