import { describe, expect, it } from "vitest";

import trails from "@/lib/data/rtg-trails.json";
import { findHikeCandidates } from "@/lib/optimization/hike-search";
import type { HikeSearchRequest, RtgTrail } from "@/lib/types";

const rtgTrails = trails as RtgTrail[];

describe("findHikeCandidates", () => {
  it("returns nearby RTG candidates for Jerusalem origin", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
    };

    const result = findHikeCandidates(request, rtgTrails);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].source).toBe("rtg");
  });

  it("filters candidates by endpoint proximity when endpoint is given", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
      endpoint: { lat: 31.769, lng: 35.214 },
    };

    const result = findHikeCandidates(request, rtgTrails);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((candidate) => candidate.trail?.region.includes("Jerusalem"))).toBe(
      true,
    );
  });

  it("honors maxDistance preference", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
      preferences: { maxDistanceMeters: 4500 },
    };

    const result = findHikeCandidates(request, rtgTrails);
    expect(result.every((candidate) => candidate.distanceMeters <= 4950)).toBe(true);
  });

  it("honors maxStartDistance preference", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
      preferences: { maxStartDistanceMeters: 600 },
    };

    const customTrails: RtgTrail[] = [
      {
        id: "near",
        name: "Near Trail",
        region: "Jerusalem",
        lengthMeters: 3000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.7685, lng: 35.214 },
          { lat: 31.769, lng: 35.2145 },
          { lat: 31.7695, lng: 35.215 },
        ],
      },
      {
        id: "far",
        name: "Far Trail",
        region: "Jerusalem",
        lengthMeters: 3200,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.79, lng: 35.24 },
          { lat: 31.791, lng: 35.241 },
          { lat: 31.792, lng: 35.242 },
        ],
      },
    ];

    const result = findHikeCandidates(request, customTrails);
    expect(result).toHaveLength(1);
    expect(result[0]?.trail?.id).toBe("near");
  });

  it("auto-filters by recommended start distance when no explicit maxStartDistance is provided", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
      preferences: { desiredRouteCount: 1 },
    };

    const customTrails: RtgTrail[] = [
      {
        id: "near",
        name: "Near Trail",
        region: "Jerusalem",
        lengthMeters: 3000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.7685, lng: 35.214 },
          { lat: 31.769, lng: 35.2145 },
          { lat: 31.7695, lng: 35.215 },
        ],
      },
      {
        id: "too-far-for-auto",
        name: "Far For Auto",
        region: "Jerusalem",
        lengthMeters: 3200,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.79, lng: 35.24 },
          { lat: 31.791, lng: 35.241 },
          { lat: 31.792, lng: 35.242 },
        ],
      },
    ];

    const result = findHikeCandidates(request, customTrails);
    expect(result).toHaveLength(1);
    expect(result[0]?.trail?.id).toBe("near");
  });

  it("honors maxFinishDistanceFromOrigin preference", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
      preferences: { maxFinishDistanceFromOriginMeters: 2500 },
    };

    const customTrails: RtgTrail[] = [
      {
        id: "finish-near",
        name: "Finish Near",
        region: "Jerusalem",
        lengthMeters: 3000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.7685, lng: 35.214 },
          { lat: 31.769, lng: 35.2145 },
          { lat: 31.7695, lng: 35.215 },
        ],
      },
      {
        id: "finish-far",
        name: "Finish Far",
        region: "Jerusalem",
        lengthMeters: 3200,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 31.80, lng: 35.26 },
          { lat: 31.801, lng: 35.261 },
          { lat: 31.802, lng: 35.262 },
        ],
      },
    ];

    const result = findHikeCandidates(request, customTrails);
    expect(result).toHaveLength(1);
    expect(result[0]?.trail?.id).toBe("finish-near");
  });

  it("prefers trails with a trailhead close to the origin", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
    };

    const candidates = findHikeCandidates(request, rtgTrails);

    expect(candidates[0]?.trail?.name).toBe("Jerusalem Park Scenic Loop");
  });

  it("ignores invalid or empty trail geometry", () => {
    const request: HikeSearchRequest = {
      origin: { lat: 31.7683, lng: 35.2137 },
    };

    const malformedTrails: RtgTrail[] = [
      {
        id: "bad-empty",
        name: "Bad Empty",
        region: "Jerusalem",
        lengthMeters: 1000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [],
      },
      {
        id: "bad-point",
        name: "Bad Point",
        region: "Jerusalem",
        lengthMeters: 1000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [{ lat: 31.7, lng: 35.2 }],
      },
      {
        id: "bad-range",
        name: "Bad Range",
        region: "Jerusalem",
        lengthMeters: 1000,
        source: "rtg-curated",
        dataVersion: "2026-04-03",
        lastUpdated: "2026-04-03T00:00:00.000Z",
        geometry: [
          { lat: 999, lng: 35.2 },
          { lat: 31.7, lng: 35.3 },
        ],
      },
    ];

    const result = findHikeCandidates(request, malformedTrails);
    expect(result).toHaveLength(0);
  });
});
