import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import {
  SIMULATED_FAST_PACE_FACTOR,
  SIMULATED_SLOW_PACE_FACTOR,
} from "@/lib/walk/planner-actions";
import {
  replanPaceDirection,
  ReplanTrigger,
  type ReplanReason,
} from "@/lib/walk/replan-trigger";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";

// A straight kilometre due north. Straight on purpose: a perpendicular offset
// is exactly that far from the segment it was taken off, and only a route that
// does not double back guarantees no other segment is nearer.
const ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.089, lng: 34.78 },
];

// Long enough that a slow walker can spend a full 15-minute window on it
// without running out of route and being stopped by `totalDistance`.
const LONG_ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.17, lng: 34.78 },
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

// The pace equivalent of the stray suite: `ReplanTrigger`'s 15-minute average
// is not something a human can produce by clicking, so the slow/fast re-plan
// path had no end-to-end exercise at all. Everything below runs the real
// trigger over the real emitted stream — no stubbed reasons.
describe("SimulatedWalkTracker — drifting off the planned pace", () => {
  // One tick is `tickMs * SPEED` = 5 simulated seconds, so a 15-minute window
  // takes 180 ticks to fill. 200 clears the 90% coverage rule with room.
  const TICKS_PER_WINDOW = 200;

  function makeLongTracker(onUpdate: (update: PaceUpdate) => void) {
    return new SimulatedWalkTracker(
      LONG_ROUTE,
      onUpdate,
      [],
      PACE_MIN_PER_KM,
      SPEED,
      TICK_MS,
    );
  }

  /** What the real trigger makes of a slice of the reported stream. */
  function evaluateOver(updates: PaceUpdate[]): ReplanReason | null {
    const trigger = new ReplanTrigger(PACE_MIN_PER_KM);
    for (const update of updates) {
      trigger.recordSample({
        coordinates: update.currentPosition,
        timestamp: update.timestamp,
      });
    }
    return trigger.evaluate(updates[updates.length - 1].timestamp);
  }

  it("reports the new pace on every update after the change", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.setPace(24);
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    expect(updates.map((u) => u.paceMinPerKm)).toEqual([15, 15, 24, 24]);
  });

  it("covers less ground per tick once the pace slows", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.setPace(30); // half speed
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    const plannedHop = haversineDistance(
      updates[0].currentPosition,
      updates[1].currentPosition,
    );
    const slowHop = haversineDistance(
      updates[2].currentPosition,
      updates[3].currentPosition,
    );

    expect(plannedHop).toBeCloseTo(METERS_PER_TICK, 1);
    expect(slowHop).toBeCloseTo(METERS_PER_TICK / 2, 1);
  });

  it("drives the real trigger to sustained-slow-pace after a full window", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    const reason = evaluateOver(updates);
    expect(reason).toBe("sustained-slow-pace");
    expect(replanPaceDirection(reason!)).toBe("slow");
  });

  it("drives the real trigger to sustained-fast-pace after a full window", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_FAST_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    const reason = evaluateOver(updates);
    expect(reason).toBe("sustained-fast-pace");
    expect(replanPaceDirection(reason!)).toBe("fast");
  });

  it("says nothing while the walker holds the planned pace", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  // 18 min/km against a planned 15 is 1.2×, inside the 1.3× threshold: behind,
  // but not far enough behind that the plan stops fitting.
  it("says nothing for a drift too small to cross the slow ratio", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(18);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  it("does not fire before the window has been drifted for long enough", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    // Half a window's worth of ticks at the drifted pace.
    vi.advanceTimersByTime(TICK_MS * (TICKS_PER_WINDOW / 2));
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  // Five samples is the floor, and four of them spread over a full window is
  // still not a pace — the coverage and count rules have to both hold.
  it("does not fire on too few samples, however slow they are", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    // The same drifted walk, thinned to four widely-spaced fixes.
    const sparse = [0, 60, 120, 179].map((i) => updates[i]);
    expect(evaluateOver(sparse)).toBeNull();
  });

  it("stops triggering once the pace is put back to normal", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    const drifted = updates.length;

    tracker.resetPace();
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    // The window that was all slow fires; the window after the reset does not.
    expect(evaluateOver(updates.slice(0, drifted))).toBe("sustained-slow-pace");
    expect(evaluateOver(updates.slice(drifted))).toBeNull();
    expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
  });

  it("ignores a pace that is not a usable speed", () => {
    const tracker = makeLongTracker(vi.fn());

    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      tracker.setPace(bad);
      expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
    }
  });

  it("drops a drifted pace when the walk is stopped", () => {
    const tracker = makeLongTracker(vi.fn());

    tracker.start();
    tracker.setPace(24);
    tracker.stop();

    expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
    expect(tracker.plannedPace).toBe(PACE_MIN_PER_KM);
  });
});
