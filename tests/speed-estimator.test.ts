import { describe, expect, it } from "vitest";

import { SpeedEstimator } from "@/lib/walk/speed-estimator";
import type { Coordinates } from "@/lib/types";

const T0 = 1_700_000_000_000;
const START: Coordinates = { lat: 32.08, lng: 34.78 };
const M_PER_DEG_LAT = 111_320;

function northOf(base: Coordinates, meters: number): Coordinates {
  return { lat: base.lat + meters / M_PER_DEG_LAT, lng: base.lng };
}

/** Feeds a fix every second walking north at `mps`. */
function walkNorth(
  est: SpeedEstimator,
  seconds: number,
  mps: number,
  opts: { doppler?: number; accuracy?: number } = {},
): number {
  for (let s = 0; s <= seconds; s += 1) {
    est.record({
      coordinates: northOf(START, mps * s),
      timestamp: T0 + s * 1000,
      accuracyMeters: opts.accuracy ?? 8,
      speedMps: opts.doppler,
    });
  }
  return T0 + seconds * 1000;
}

describe("SpeedEstimator", () => {
  it("uses the device Doppler speed (median of the last 10 s) when present", () => {
    const est = new SpeedEstimator();
    const now = walkNorth(est, 20, 1.2, { doppler: 1.4 });
    const { kmh, state } = est.current(now);
    expect(state).toBe("moving");
    expect(kmh).toBeCloseTo(1.4 * 3.6, 1);
  });

  it("falls back to displacement over time without a Doppler speed", () => {
    const est = new SpeedEstimator();
    const now = walkNorth(est, 30, 1.25);
    const { kmh, state } = est.current(now);
    expect(state).toBe("moving");
    expect(kmh).toBeCloseTo(1.25 * 3.6, 0);
  });

  it("reports unknown before enough data exists", () => {
    const est = new SpeedEstimator();
    expect(est.current(T0).state).toBe("unknown");
    walkNorth(est, 2, 1.2);
    expect(est.current(T0 + 2000)).toEqual({ kmh: null, state: "unknown" });
  });

  it("reads stationary GPS jitter as Paused, not as walking", () => {
    const est = new SpeedEstimator();
    for (let s = 0; s <= 30; s += 1) {
      // +-3 m wobble around a fixed point
      const wobble = (s % 2 === 0 ? 3 : -3) / M_PER_DEG_LAT;
      est.record({
        coordinates: { lat: START.lat + wobble, lng: START.lng },
        timestamp: T0 + s * 1000,
        accuracyMeters: 10,
      });
    }
    const { kmh, state } = est.current(T0 + 30_000);
    expect(state).toBe("paused");
    expect(kmh).toBe(0);
  });

  it("drops fixes worse than 35 m", () => {
    const est = new SpeedEstimator();
    const now = walkNorth(est, 20, 1.2, { accuracy: 60 });
    expect(est.current(now).state).toBe("unknown");
  });

  it("rejects a single impossible jump instead of averaging it in", () => {
    const est = new SpeedEstimator();
    walkNorth(est, 20, 1.2);
    // A 500 m teleport one second later...
    est.record({
      coordinates: northOf(START, 24 + 500),
      timestamp: T0 + 21_000,
      accuracyMeters: 8,
    });
    // ...then the walk carries on where it was.
    est.record({
      coordinates: northOf(START, 1.2 * 22),
      timestamp: T0 + 22_000,
      accuracyMeters: 8,
    });
    const { kmh } = est.current(T0 + 22_000);
    expect(kmh).not.toBeNull();
    expect(kmh as number).toBeLessThan(6);
  });

  it("says nothing once the fixes go stale", () => {
    const est = new SpeedEstimator();
    const now = walkNorth(est, 20, 1.2);
    expect(est.current(now + 60_000).state).toBe("unknown");
  });
});
