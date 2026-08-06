import { beforeEach, describe, it, expect, vi } from "vitest";
import { planWalkOrder, buildWalkPlan } from "@/lib/optimization/tsp-planner";
import { haversineDistance } from "@/lib/utils/geo";
import type { Attraction, WalkPlanRequest } from "@/lib/types";

const mockGetMatrix = vi.fn();

vi.mock("@/lib/api/ors-client", () => ({
  getMatrix: (...args: unknown[]) => mockGetMatrix(...args),
}));

const origin = { lat: 32.08, lng: 34.78 }; // Tel Aviv

// Everything below the "ORS walking matrix" block is about the ordering and
// budget logic, not the matrix source — those cases run on the haversine
// fallback so their expected distances stay the plain straight-line ones.
beforeEach(() => {
  mockGetMatrix.mockReset();
  mockGetMatrix.mockRejectedValue(new Error("ORS unavailable"));
});

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
  it("returns empty plan for zero candidates", async () => {
    const result = await planWalkOrder(baseRequest, []);
    expect(result.orderedAttractions).toHaveLength(0);
    expect(result.feasible).toBe(false);
  });

  it("orders a single attraction", async () => {
    const a = makeAttraction("a", 32.081, 34.781);
    const result = await planWalkOrder(baseRequest, [a]);
    expect(result.orderedAttractions).toHaveLength(1);
    expect(result.orderedAttractions[0].id).toBe("a");
    expect(result.feasible).toBe(true);
  });

  it("drops attractions that exceed the time budget", async () => {
    // Each attraction takes 60 min to visit — only 2 should fit in 120 min
    const attractions = [
      makeAttraction("a", 32.081, 34.781, 60),
      makeAttraction("b", 32.082, 34.782, 60),
      makeAttraction("c", 32.083, 34.783, 60),
    ];
    const result = await planWalkOrder(baseRequest, attractions);
    expect(result.droppedAttractions.length).toBeGreaterThanOrEqual(1);
    const totalVisit = result.orderedAttractions.reduce(
      (sum, a) => sum + a.avgVisitMinutes,
      0,
    );
    expect(totalVisit + result.totalWalkingMinutes).toBeLessThanOrEqual(120);
  });

  it("total distance matches sum of segment distances", async () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781),
      makeAttraction("b", 32.082, 34.782),
      makeAttraction("c", 32.083, 34.783),
    ];
    const result = await planWalkOrder(baseRequest, attractions);
    const segTotal = result.segments.reduce(
      (sum, s) => sum + s.distanceMeters,
      0,
    );
    expect(result.totalDistanceMeters).toBeCloseTo(segTotal, 1);
  });

  it("drops attractions with broken coordinates without shifting the others", async () => {
    const broken = makeAttraction("broken", Number.NaN, 34.781);
    const attractions = [
      broken,
      makeAttraction("a", 32.081, 34.781),
      makeAttraction("b", 32.082, 34.782),
    ];
    const result = await planWalkOrder(baseRequest, attractions);
    expect(result.orderedAttractions.map((a) => a.id).sort()).toEqual(["a", "b"]);
    expect(result.droppedAttractions.map((a) => a.id)).toContain("broken");
    expect(result.segments.every((s) => Number.isFinite(s.distanceMeters))).toBe(true);
  });

  it("keeps a pinned attraction that no longer fits, and reports it as infeasible", async () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781, 60),
      makeAttraction("b", 32.082, 34.782, 60),
      makeAttraction("pinned", 32.083, 34.783, 60),
    ];
    const result = await planWalkOrder(
      { ...baseRequest, pinnedAttractionIds: ["pinned"] },
      attractions,
    );
    expect(result.orderedAttractions.map((a) => a.id)).toContain("pinned");
    expect(result.droppedAttractions.map((a) => a.id)).not.toContain("pinned");
    expect(result.feasible).toBe(false);
  });

  it("first segment always starts from origin", async () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781),
      makeAttraction("b", 32.082, 34.782),
    ];
    const result = await planWalkOrder(baseRequest, attractions);
    expect(result.segments[0]?.from).toMatchObject({ name: "origin" });
  });
});

describe("buildWalkPlan", () => {
  it("totalMinutes = walkingMinutes + visitMinutes", async () => {
    const attractions = [
      makeAttraction("a", 32.081, 34.781, 30),
      makeAttraction("b", 32.082, 34.782, 30),
    ];
    const plan = await buildWalkPlan(baseRequest, attractions);
    const visitTotal = plan.orderedAttractions.reduce(
      (sum, a) => sum + a.avgVisitMinutes,
      0,
    );
    // totalMinutes should be >= visitTotal (walking adds time)
    expect(plan.totalMinutes).toBeGreaterThanOrEqual(visitTotal);
    expect(plan.totalMinutes).toBeLessThanOrEqual(baseRequest.availableMinutes);
  });
});

describe("planWalkOrder — ORS walking matrix", () => {
  // `near` is the closer of the two as the crow flies; `far` is the closer of
  // the two on foot. Any test that gets [far, near] back is ordering on the
  // walking network, and one that gets [near, far] is ordering on haversine.
  const near = makeAttraction("near", 32.081, 34.781);
  const far = makeAttraction("far", 32.09, 34.79);
  const candidates = [near, far];

  // Matrix over [origin, near, far]: reaching `near` means a 5 km detour.
  const walkingMatrix = [
    [0, 5000, 100],
    [5000, 0, 100],
    [100, 100, 0],
  ];

  function haversineMatrix(): number[][] {
    const points = [origin, near.coordinates, far.coordinates];
    return points.map((a) => points.map((b) => haversineDistance(a, b)));
  }

  it("asks ORS for the origin and every attraction in [lng, lat] order", async () => {
    mockGetMatrix.mockResolvedValue({ distances: walkingMatrix });

    await planWalkOrder(baseRequest, candidates);

    expect(mockGetMatrix).toHaveBeenCalledTimes(1);
    expect(mockGetMatrix).toHaveBeenCalledWith({
      locations: [
        [34.78, 32.08],
        [34.781, 32.081],
        [34.79, 32.09],
      ],
      profile: "foot-walking",
    });
  });

  it("orders by walking distance, not by the straight line", async () => {
    mockGetMatrix.mockResolvedValue({ distances: walkingMatrix });

    const result = await planWalkOrder(baseRequest, candidates);

    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["far", "near"]);
    // Distances are reported from the same matrix the order was chosen from.
    expect(result.totalDistanceMeters).toBeCloseTo(200, 6);
  });

  it("fills a pair ORS could not route with the straight-line distance", async () => {
    mockGetMatrix.mockResolvedValue({
      distances: [
        [0, null, 5000],
        [null, 0, 100],
        [5000, 100, 0],
      ],
    });

    const result = await planWalkOrder(baseRequest, candidates);

    const originToNear = haversineDistance(origin, near.coordinates);
    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["near", "far"]);
    expect(result.totalDistanceMeters).toBeCloseTo(originToNear + 100, 6);
  });

  it("runs the same ordering the fallback would when ORS agrees with haversine", async () => {
    mockGetMatrix.mockResolvedValue({ distances: haversineMatrix() });
    const viaOrs = await planWalkOrder(baseRequest, candidates);

    mockGetMatrix.mockRejectedValue(new Error("ORS unavailable"));
    const viaFallback = await planWalkOrder(baseRequest, candidates);

    // Same NN + 2-opt, same numbers in, same walk out — only the source differs.
    expect(viaOrs.orderedAttractions.map((a) => a.id)).toEqual(
      viaFallback.orderedAttractions.map((a) => a.id),
    );
    expect(viaOrs.totalDistanceMeters).toBeCloseTo(viaFallback.totalDistanceMeters, 6);
  });
});

describe("planWalkOrder — haversine fallback", () => {
  const attractions = [
    makeAttraction("a", 32.081, 34.781),
    makeAttraction("b", 32.09, 34.79),
  ];

  async function expectHaversinePlan() {
    const result = await planWalkOrder(baseRequest, attractions);

    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["a", "b"]);
    expect(result.feasible).toBe(true);
    expect(result.droppedAttractions).toHaveLength(0);
    expect(result.segments.every((s) => Number.isFinite(s.distanceMeters))).toBe(true);
    expect(result.totalDistanceMeters).toBeCloseTo(
      haversineDistance(origin, attractions[0].coordinates) +
        haversineDistance(attractions[0].coordinates, attractions[1].coordinates),
      6,
    );
    return result;
  }

  it("plans the walk anyway when the ORS matrix call fails", async () => {
    mockGetMatrix.mockRejectedValue(new Error("ORS unavailable"));
    await expectHaversinePlan();
  });

  it("plans the walk anyway when ORS times out", async () => {
    mockGetMatrix.mockRejectedValue(
      Object.assign(new Error("The operation was aborted."), { name: "AbortError" }),
    );
    await expectHaversinePlan();
  });

  it("plans the walk anyway when ORS returns a matrix of the wrong size", async () => {
    mockGetMatrix.mockResolvedValue({ distances: [[0, 100], [100, 0]] });
    await expectHaversinePlan();
  });

  it("plans the walk anyway when ORS returns no distances at all", async () => {
    mockGetMatrix.mockResolvedValue({});
    await expectHaversinePlan();
  });

  it("does not call ORS when no attraction has usable coordinates", async () => {
    const result = await planWalkOrder(baseRequest, [
      makeAttraction("broken", Number.NaN, Number.NaN),
    ]);

    expect(mockGetMatrix).not.toHaveBeenCalled();
    expect(result.feasible).toBe(false);
    expect(result.droppedAttractions.map((a) => a.id)).toEqual(["broken"]);
  });
});

// "Search radius" only bounds where candidates are looked for; a walk built
// entirely from POIs 2 km out can still finish 2 km from the start, on the far
// side of it. This constraint is the separate promise that it will not.
describe("planWalkOrder — max end distance from origin", () => {
  // ~111 m, ~556 m and ~1112 m from the origin, on one line north.
  const near = makeAttraction("near", 32.081, 34.78);
  const middle = makeAttraction("middle", 32.085, 34.78);
  const far = makeAttraction("far", 32.09, 34.78);

  it("leaves an unconstrained walk exactly as it was", async () => {
    const result = await planWalkOrder(baseRequest, [near, middle, far]);

    expect(result.orderedAttractions.map((a) => a.id)).toEqual([
      "near",
      "middle",
      "far",
    ]);
    expect(result.droppedAttractions).toEqual([]);
    expect(result.feasible).toBe(true);
  });

  it("leaves a walk that already finishes in range as it was", async () => {
    const result = await planWalkOrder(
      { ...baseRequest, maxEndDistanceFromOriginMeters: 2000 },
      [near, middle, far],
    );

    expect(result.orderedAttractions.map((a) => a.id)).toEqual([
      "near",
      "middle",
      "far",
    ]);
    expect(result.droppedAttractions).toEqual([]);
    expect(result.feasible).toBe(true);
  });

  // The cheap fix: every stop is still visited, only the order changes.
  it("reorders so the walk finishes in range, keeping every stop", async () => {
    const result = await planWalkOrder(
      { ...baseRequest, maxEndDistanceFromOriginMeters: 800 },
      [near, middle, far],
    );

    // `middle` moves last — nearer the start than `far`, and the cheaper of the
    // two rearrangements that finish in range.
    expect(result.orderedAttractions.map((a) => a.id)).toEqual([
      "near",
      "far",
      "middle",
    ]);
    expect(result.droppedAttractions).toEqual([]);
    expect(
      haversineDistance(origin, result.orderedAttractions.at(-1)!.coordinates),
    ).toBeLessThanOrEqual(800);
    expect(result.feasible).toBe(true);
  });

  // ~2224 m out: walking back from it to a nearer stop costs more time than
  // the walker has, so there is no rearrangement to buy.
  const stranding = makeAttraction("stranding", 32.1, 34.78);

  it("drops the stop that strands the walker when no affordable order fits", async () => {
    const result = await planWalkOrder(
      {
        ...baseRequest,
        availableMinutes: 90,
        maxEndDistanceFromOriginMeters: 500,
      },
      [near, stranding],
    );

    expect(result.orderedAttractions.map((a) => a.id)).toEqual(["near"]);
    expect(result.droppedAttractions.map((a) => a.id)).toEqual(["stranding"]);
    expect(result.feasible).toBe(true);
  });

  // Same as above, except the walker asked for that place by name. A pin
  // already beats the time budget; it beats this too, and says so.
  it("keeps a pinned final stop and reports the walk as infeasible", async () => {
    const result = await planWalkOrder(
      {
        ...baseRequest,
        availableMinutes: 90,
        maxEndDistanceFromOriginMeters: 500,
        pinnedAttractionIds: ["stranding"],
      },
      [near, stranding],
    );

    expect(result.orderedAttractions.map((a) => a.id)).toEqual([
      "near",
      "stranding",
    ]);
    expect(result.droppedAttractions).toEqual([]);
    expect(result.feasible).toBe(false);
  });

  it("reports the trimmed walk's own distance and segments, not the dropped stop's", async () => {
    const result = await planWalkOrder(
      {
        ...baseRequest,
        availableMinutes: 90,
        maxEndDistanceFromOriginMeters: 500,
      },
      [near, stranding],
    );

    expect(result.segments).toHaveLength(1);
    expect(result.totalDistanceMeters).toBeCloseTo(
      haversineDistance(origin, near.coordinates),
      0,
    );
  });

  it("ignores a constraint that is not a usable distance", async () => {
    const result = await planWalkOrder(
      { ...baseRequest, maxEndDistanceFromOriginMeters: Number.NaN },
      [near, middle, far],
    );

    expect(result.orderedAttractions).toHaveLength(3);
    expect(result.feasible).toBe(true);
  });
});
