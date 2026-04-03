import { describe, expect, it } from "vitest";

import {
  getRtgTrailDiagnostics,
  normalizeTrail,
  validateTrail,
} from "@/lib/api/rtg-client";

describe("rtg-client", () => {
  it("normalizes ORS-style coordinates and preserves curated metadata", () => {
    const trail = normalizeTrail({
      id: "trail-1",
      name: "Trail 1",
      region: "Jerusalem",
      lengthMeters: 1234,
      source: "rtg-curated",
      dataVersion: "2026-04-03",
      lastUpdated: "2026-04-03T00:00:00.000Z",
      geometry: [
        [35.2137, 31.7683],
        [35.215, 31.769],
        [35.216, 31.77],
      ],
    });

    expect(trail.geometry[0]).toEqual({ lat: 31.7683, lng: 35.2137 });
    expect(trail.source).toBe("rtg-curated");
  });

  it("rejects malformed trails during validation", () => {
    const invalid = normalizeTrail({
      id: "",
      name: "Broken",
      region: "Jerusalem",
      lengthMeters: 0,
      source: "rtg-curated",
      dataVersion: "2026-04-03",
      lastUpdated: "2026-04-03T00:00:00.000Z",
      geometry: [{ lat: 31.7, lng: 35.2 }],
    });

    const validation = validateTrail(invalid);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBeDefined();
  });

  it("exposes loader diagnostics for debugging", () => {
    const diagnostics = getRtgTrailDiagnostics();

    expect(diagnostics.validTrailCount).toBeGreaterThan(0);
    expect(diagnostics.skippedTrailCount).toBeGreaterThanOrEqual(0);
  });
});
