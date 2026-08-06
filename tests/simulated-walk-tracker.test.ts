import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";

// A straight kilometre due north. Straight on purpose: a perpendicular offset
// is exactly that far from the segment it was taken off, and only a route that
// does not double back guarantees no other segment is nearer.
const ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.089, lng: 34.78 },
];

const PACE_MIN_PER_KM = 15;
const SPEED = 10;
const TICK_MS = 500;
// (1000 / (15 * 60)) * 10 * 0.5 — what one tick advances along the route.
const METERS_PER_TICK = 5.555555555555555;

function makeTracker(onUpdate: (update: PaceUpdate) => void) {
  return new SimulatedWalkTracker(
    ROUTE,
    onUpdate,
    [],
    PACE_MIN_PER_KM,
    SPEED,
    TICK_MS,
  );
}

/** Every position the tracker reported, in order. */
function collect(): { updates: PaceUpdate[]; onUpdate: (u: PaceUpdate) => void } {
  const updates: PaceUpdate[] = [];
  return { updates, onUpdate: (update) => updates.push(update) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SimulatedWalkTracker — staying on the route", () => {
  it("reports positions the deviation detector reads as on-route", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 10);
    tracker.stop();

    expect(updates.length).toBe(10);
    for (const update of updates) {
      const deviation = detectDeviation(update.currentPosition, ROUTE);
      expect(deviation.deviationMeters).toBeLessThan(1);
      expect(deviation.needsReroute).toBe(false);
    }
  });

  it("has nothing to report as straying until asked", () => {
    const tracker = makeTracker(vi.fn());
    expect(tracker.isStraying).toBe(false);
  });
});

// The whole point: `deviation-detector.ts`'s >50 m trigger and the banner it
// drives could not be exercised end to end before this, because every reported
// position was interpolated along the route's own geometry.
describe("SimulatedWalkTracker — straying off the route", () => {
  it("reports a position far enough off-route to need a re-route", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 3);
    tracker.strayOffRoute(80);
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(tracker.isStraying).toBe(true);
    tracker.stop();

    const before = detectDeviation(updates[2].currentPosition, ROUTE);
    const after = detectDeviation(updates.at(-1)!.currentPosition, ROUTE);

    expect(before.needsReroute).toBe(false);
    expect(after.deviationMeters).toBeCloseTo(80, 0);
    expect(after.needsReroute).toBe(true);
  });

  // The threshold is 50 m, and a walker on the other pavement is not lost.
  it("does not trip the re-route trigger for an offset under the threshold", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    tracker.strayOffRoute(30);
    vi.advanceTimersByTime(TICK_MS * 5);
    tracker.stop();

    for (const update of updates) {
      const deviation = detectDeviation(update.currentPosition, ROUTE);
      expect(deviation.deviationMeters).toBeCloseTo(30, 0);
      expect(deviation.needsReroute).toBe(false);
    }
  });

  it("rejoins the route after the stated distance", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    // Two ticks off the line, then back on it.
    tracker.strayOffRoute(80, METERS_PER_TICK * 2.5);
    vi.advanceTimersByTime(TICK_MS * 5);
    tracker.stop();

    const deviations = updates.map(
      (update) => detectDeviation(update.currentPosition, ROUTE).deviationMeters,
    );

    expect(deviations[0]).toBeCloseTo(80, 0);
    expect(deviations[1]).toBeCloseTo(80, 0);
    expect(deviations[3]).toBeLessThan(1);
    expect(deviations[4]).toBeLessThan(1);
  });

  it("rejoins the route on demand", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    tracker.strayOffRoute(80);
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.returnToRoute();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    expect(
      detectDeviation(updates[1].currentPosition, ROUTE).needsReroute,
    ).toBe(true);
    expect(
      detectDeviation(updates.at(-1)!.currentPosition, ROUTE).deviationMeters,
    ).toBeLessThan(1);
    expect(tracker.isStraying).toBe(false);
  });

  // A stray is a position, not a pause: the walker keeps covering ground while
  // they are off the line, so the walk still ends.
  it("keeps advancing along the route while straying", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    tracker.strayOffRoute(80);
    vi.advanceTimersByTime(TICK_MS * 4);
    tracker.stop();

    const first = detectDeviation(updates[0].currentPosition, ROUTE);
    const last = detectDeviation(updates.at(-1)!.currentPosition, ROUTE);

    expect(
      haversineDistance(ROUTE[0], last.closestPointOnRoute),
    ).toBeGreaterThan(haversineDistance(ROUTE[0], first.closestPointOnRoute));
  });

  it("ignores an offset that is not a usable distance", () => {
    const tracker = makeTracker(vi.fn());

    tracker.strayOffRoute(Number.NaN);
    expect(tracker.isStraying).toBe(false);

    tracker.strayOffRoute(0);
    expect(tracker.isStraying).toBe(false);
  });

  it("drops a standing stray when the walk is stopped", () => {
    const tracker = makeTracker(vi.fn());

    tracker.start();
    tracker.strayOffRoute(80);
    tracker.stop();

    expect(tracker.isStraying).toBe(false);
  });
});
