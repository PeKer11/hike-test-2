import { describe, expect, it } from "vitest";

import {
  ROUTE_END_DWELL_MS,
  ROUTE_END_MAX_ACCURACY_M,
  ROUTE_END_RADIUS_M,
  RouteEndDetector,
} from "@/lib/walk/route-end";

const T0 = 1_000_000;

describe("RouteEndDetector", () => {
  it("does not fire 40 m before the end (the field-test case)", () => {
    const d = new RouteEndDetector();
    for (let i = 0; i < 30; i += 1) {
      expect(d.update({ remainingM: 40, accuracyM: 8, atMs: T0 + i * 1_000 })).toBe(false);
    }
  });

  it("does not fire on a single fix inside the radius", () => {
    const d = new RouteEndDetector();
    expect(d.update({ remainingM: 3, accuracyM: 5, atMs: T0 })).toBe(false);
  });

  it("fires once the walker has stayed within the radius for the dwell, by fix time", () => {
    const d = new RouteEndDetector();
    expect(d.update({ remainingM: ROUTE_END_RADIUS_M, accuracyM: 5, atMs: T0 })).toBe(false);
    expect(d.update({ remainingM: 9, accuracyM: 5, atMs: T0 + ROUTE_END_DWELL_MS - 1 })).toBe(false);
    expect(d.update({ remainingM: 4, accuracyM: 5, atMs: T0 + ROUTE_END_DWELL_MS })).toBe(true);
  });

  it("a stale fix re-read on later ticks never advances the dwell", () => {
    const d = new RouteEndDetector();
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 })).toBe(false);
    for (let i = 0; i < 10; i += 1) {
      expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 })).toBe(false);
    }
  });

  it("a fix that jumps back out of the radius starts the dwell over", () => {
    const d = new RouteEndDetector();
    d.update({ remainingM: 5, accuracyM: 5, atMs: T0 });
    d.update({ remainingM: 60, accuracyM: 5, atMs: T0 + 3_000 }); // a GPS jump out
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 + 6_000 })).toBe(false);
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 + 6_000 + ROUTE_END_DWELL_MS })).toBe(true);
  });

  it("ignores fixes too coarse to place the walker, without breaking a dwell in progress", () => {
    const d = new RouteEndDetector();
    d.update({ remainingM: 5, accuracyM: 5, atMs: T0 });
    // Looks like the end but cannot be trusted: no progress, no reset.
    expect(d.update({ remainingM: 2, accuracyM: ROUTE_END_MAX_ACCURACY_M + 1, atMs: T0 + 3_000 })).toBe(false);
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 + ROUTE_END_DWELL_MS })).toBe(true);

    // A coarse fix alone never starts one.
    const e = new RouteEndDetector();
    for (let i = 0; i < 10; i += 1) {
      expect(e.update({ remainingM: 1, accuracyM: 45, atMs: T0 + i * 2_000 })).toBe(false);
    }
  });

  it("leaves the zone again after confirming (walker keeps going) and drops the flag", () => {
    const d = new RouteEndDetector();
    d.update({ remainingM: 5, accuracyM: 5, atMs: T0 });
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 + ROUTE_END_DWELL_MS })).toBe(true);
    expect(d.update({ remainingM: 80, accuracyM: 5, atMs: T0 + 8_000 })).toBe(false);
  });

  it("reset forgets everything", () => {
    const d = new RouteEndDetector();
    d.update({ remainingM: 5, accuracyM: 5, atMs: T0 });
    d.update({ remainingM: 5, accuracyM: 5, atMs: T0 + ROUTE_END_DWELL_MS });
    d.reset();
    // Same timestamps are fresh again after a reset (a new walk), and the dwell restarts.
    expect(d.update({ remainingM: 5, accuracyM: 5, atMs: T0 })).toBe(false);
  });
});
