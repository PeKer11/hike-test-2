import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Coordinates } from "@/lib/types";
import { detectDeviation, remainingRoute } from "@/lib/walk/deviation-detector";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";

// An out-and-back: 600 m due north in 10 m steps, then the same distance back
// south down a line 60 m to the west. This is the shape the reported bug needs
// and the shape the old global search could not handle — the two legs are 60 m
// apart on the ground but ~60 segments apart in route order, so a walker who
// strays 80 m west off the outbound leg ends up 20 m from the return leg.
const START_LAT = 32.08;
const START_LNG = 34.78;
const STEP_LAT = 0.00009; // ~10 m
const LEG_POINTS = 61; // 60 segments per leg
const METERS_PER_DEGREE_LAT = 111_320;
const METERS_PER_LNG =
  METERS_PER_DEGREE_LAT * Math.cos((START_LAT * Math.PI) / 180);
const LEG_GAP_METERS = 60;
const RETURN_LNG = START_LNG - LEG_GAP_METERS / METERS_PER_LNG;

/** Index of the first segment of the southbound return leg. */
const RETURN_LEG_FIRST_SEGMENT = LEG_POINTS;

const LOOP_ROUTE: Coordinates[] = [
  ...Array.from({ length: LEG_POINTS }, (_, i) => ({
    lat: START_LAT + i * STEP_LAT,
    lng: START_LNG,
  })),
  ...Array.from({ length: LEG_POINTS }, (_, i) => ({
    lat: START_LAT + (LEG_POINTS - 1 - i) * STEP_LAT,
    lng: RETURN_LNG,
  })),
];

/** A point on the outbound leg, `offsetMeters` west of it. */
function outboundPoint(segmentIndex: number, offsetMeters = 0): Coordinates {
  return {
    lat: START_LAT + (segmentIndex + 0.5) * STEP_LAT,
    lng: START_LNG - offsetMeters / METERS_PER_LNG,
  };
}

describe("detectDeviation — constraining the search to the walker's progress", () => {
  it("stays on the segment the walker is walking when a route-distant segment is nearer on the ground", () => {
    const strayed = outboundPoint(5, 80);

    const anchored = detectDeviation(strayed, LOOP_ROUTE, 5);

    expect(anchored.closestSegmentIndex).toBe(5);
    expect(anchored.deviationMeters).toBeCloseTo(80, 0);
  });

  it("is the case an unanchored search gets wrong — it matches the far leg 20 m away", () => {
    const strayed = outboundPoint(5, 80);

    const unanchored = detectDeviation(strayed, LOOP_ROUTE);

    expect(unanchored.closestSegmentIndex).toBeGreaterThanOrEqual(
      RETURN_LEG_FIRST_SEGMENT,
    );
    expect(unanchored.deviationMeters).toBeCloseTo(20, 0);
  });

  it("keeps reporting a real 80 m stray as needing a re-route", () => {
    const strayed = outboundPoint(5, 80);

    const result = detectDeviation(strayed, LOOP_ROUTE, 5);

    expect(result.deviationMeters).toBeGreaterThan(50);
    expect(result.needsReroute).toBe(true);
  });

  it("does not call a 20 m step off the line a re-route", () => {
    const nudged = outboundPoint(5, 20);

    const result = detectDeviation(nudged, LOOP_ROUTE, 5);

    expect(result.deviationMeters).toBeCloseTo(20, 0);
    expect(result.needsReroute).toBe(false);
  });

  it("advances one segment at a time along a forward walk", () => {
    const seen: number[] = [];
    let previous: number | null = null;

    for (let segment = 0; segment < 30; segment++) {
      const result = detectDeviation(
        outboundPoint(segment),
        LOOP_ROUTE,
        previous,
      );
      seen.push(result.closestSegmentIndex);
      previous = result.closestSegmentIndex;
      expect(result.deviationMeters).toBeLessThan(1);
    }

    expect(seen).toEqual(Array.from({ length: 30 }, (_, i) => i));
  });

  it("follows a walker who retraces a few segments", () => {
    const backtracked = detectDeviation(outboundPoint(17), LOOP_ROUTE, 20);

    expect(backtracked.closestSegmentIndex).toBe(17);
    expect(backtracked.deviationMeters).toBeLessThan(1);
  });

  it("searches the whole route when there is no previous index yet", () => {
    const nearTheEnd = outboundPoint(55);

    const result = detectDeviation(nearTheEnd, LOOP_ROUTE, null);

    expect(result.closestSegmentIndex).toBe(55);
    expect(result.deviationMeters).toBeLessThan(1);
  });

  it("ignores an index that cannot belong to this route after a re-plan", () => {
    // A short replacement route: index 90 came from the geometry it replaced.
    const shortRoute = LOOP_ROUTE.slice(40, 50);
    const onShortRoute = {
      lat: shortRoute[3].lat + (shortRoute[4].lat - shortRoute[3].lat) / 2,
      lng: START_LNG,
    };

    const result = detectDeviation(onShortRoute, shortRoute, 90);

    expect(result.closestSegmentIndex).toBe(3);
    expect(result.deviationMeters).toBeLessThan(1);
  });
});

// Real tracker, real geometry, real detector — the chain that actually ran when
// Ariel pressed "Stray 80 m off route" and watched the line flicker.
describe("SimulatedWalkTracker straying on a route that doubles back", () => {
  const PACE_MIN_PER_KM = 15;
  const SPEED = 10;
  const TICK_MS = 500;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Positions reported over `ticks` ticks, straying 80 m west after the third. */
  function strayedRun(ticks: number): PaceUpdate[] {
    const updates: PaceUpdate[] = [];
    const tracker = new SimulatedWalkTracker(
      LOOP_ROUTE,
      (update) => updates.push(update),
      [],
      PACE_MIN_PER_KM,
      SPEED,
      TICK_MS,
    );

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 3);
    tracker.strayOffRoute(80);
    vi.advanceTimersByTime(TICK_MS * ticks);
    tracker.stop();

    return updates;
  }

  it("reports a segment index that only moves forward, a segment at a time", () => {
    const updates = strayedRun(12);
    let previous: number | null = null;
    const indices: number[] = [];

    for (const update of updates) {
      const deviation = detectDeviation(
        update.currentPosition,
        LOOP_ROUTE,
        previous,
      );
      previous = deviation.closestSegmentIndex;
      indices.push(deviation.closestSegmentIndex);
    }

    for (let i = 1; i < indices.length; i++) {
      const step = indices[i] - indices[i - 1];
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(1);
    }
    expect(indices.at(-1)).toBeLessThan(RETURN_LEG_FIRST_SEGMENT);
  });

  it("draws a remaining route that shortens by one point per tick instead of jumping", () => {
    const updates = strayedRun(12);
    let previous: number | null = null;
    const lengths: number[] = [];

    for (const update of updates) {
      const deviation = detectDeviation(
        update.currentPosition,
        LOOP_ROUTE,
        previous,
      );
      previous = deviation.closestSegmentIndex;
      lengths.push(
        remainingRoute(LOOP_ROUTE, deviation.closestSegmentIndex, update.currentPosition)
          .length,
      );
    }

    for (let i = 1; i < lengths.length; i++) {
      const shrink = lengths[i - 1] - lengths[i];
      expect(shrink).toBeGreaterThanOrEqual(0);
      expect(shrink).toBeLessThanOrEqual(1);
    }
  });

  it("is what an unanchored search gets wrong: the drawn route collapses to the far leg", () => {
    const updates = strayedRun(12);

    const lengths = updates.map((update) => {
      const deviation = detectDeviation(update.currentPosition, LOOP_ROUTE);
      return remainingRoute(
        LOOP_ROUTE,
        deviation.closestSegmentIndex,
        update.currentPosition,
      ).length;
    });

    // Before the stray the walker is matched near the start of a 122-point
    // route; after it, to the return leg — a jump of dozens of points in a
    // single tick, which is the flicker.
    const biggestJump = Math.max(
      ...lengths.slice(1).map((len, i) => Math.abs(lengths[i] - len)),
    );
    expect(biggestJump).toBeGreaterThan(50);
  });

  it("still reports the stray as off-route once the search is anchored", () => {
    const updates = strayedRun(12);
    let previous: number | null = null;
    let last = detectDeviation(updates[0].currentPosition, LOOP_ROUTE, previous);

    for (const update of updates) {
      last = detectDeviation(update.currentPosition, LOOP_ROUTE, previous);
      previous = last.closestSegmentIndex;
    }

    expect(last.deviationMeters).toBeCloseTo(80, 0);
    expect(last.needsReroute).toBe(true);
  });
});
