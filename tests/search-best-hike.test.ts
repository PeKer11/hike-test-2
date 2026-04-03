import { describe, expect, it, vi } from "vitest";

import type { RtgTrail } from "@/lib/types";

const mockGetRtgTrails = vi.fn<() => Promise<RtgTrail[]>>();
const mockPlanRoute = vi.fn();

vi.mock("@/lib/api/rtg-client", () => ({
  getRtgTrails: () => mockGetRtgTrails(),
}));

vi.mock("@/lib/optimization/route-planner", () => ({
  planRoute: (...args: unknown[]) => mockPlanRoute(...args),
}));

import { searchBestHike } from "@/lib/optimization/hike-search";

describe("searchBestHike", () => {
  it("falls back when all RTG candidates are unusable", async () => {
    mockGetRtgTrails.mockResolvedValueOnce([
      {
        id: "candidate-1",
        name: "Candidate",
        region: "Jerusalem",
        lengthMeters: 3500,
        difficulty: "easy",
        geometry: [
          { lat: 31.7683, lng: 35.2137 },
          { lat: 31.769, lng: 35.215 },
          { lat: 31.77, lng: 35.216 },
        ],
      },
    ]);

    let callCount = 0;
    mockPlanRoute.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("Failed route from RTG candidate");
      }
      return {
        orderedWaypoints: [],
        segments: [],
        geometry: [],
        totalDistanceMeters: 1000,
        totalDurationSeconds: 900,
        warnings: [],
      };
    });

    const result = await searchBestHike({
      origin: { lat: 31.7683, lng: 35.2137 },
    });

    expect(result.selected.source).toBe("fallback");
    expect(result.route.source).toBe("fallback");
    expect(result.fallbackReason).toContain("malformed or unusable");
  });
});
