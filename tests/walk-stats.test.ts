import { describe, expect, it } from "vitest";

import {
  cumulativeDistances,
  isNearAnyStop,
  nextStopAlongM,
  routeDirectionDeg,
  detourMinutes,
  paceBarTone,
  progressAlong,
  timeToFinishMin,
} from "@/lib/walk/walk-stats";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

const A: Coordinates = { lat: 32.08, lng: 34.78 };
const B: Coordinates = { lat: 32.081, lng: 34.78 };
const C: Coordinates = { lat: 32.082, lng: 34.78 };

describe("cumulativeDistances / progressAlong", () => {
  it("starts at 0 and accumulates per vertex", () => {
    const d = cumulativeDistances([A, B, C]);
    expect(d[0]).toBe(0);
    expect(d[1]).toBeCloseTo(haversineDistance(A, B), 3);
    expect(d[2]).toBeCloseTo(haversineDistance(A, C), 0);
  });

  it("splits the route into walked and remaining at the matched point", () => {
    const mid: Coordinates = { lat: 32.0815, lng: 34.78 };
    const { walkedM, remainingM } = progressAlong([A, B, C], 1, mid);
    expect(walkedM).toBeCloseTo(haversineDistance(A, mid), 0);
    expect(walkedM + remainingM).toBeCloseTo(haversineDistance(A, C), 0);
  });

  it("is zero for a degenerate geometry", () => {
    expect(progressAlong([A], 0, A)).toEqual({ walkedM: 0, remainingM: 0 });
  });
});

describe("timeToFinishMin", () => {
  // planned 12 min/km = 5 km/h
  it("uses the measured speed when within 0.5x-1.5x of plan", () => {
    const min = timeToFinishMin({
      remainingM: 2500,
      kmh: 6,
      plannedPace: 12,
      remainingVisitMin: 10,
    });
    expect(min).toBeCloseTo(25 + 10, 5);
  });

  it("falls back to plan when the measured speed is implausible", () => {
    const min = timeToFinishMin({
      remainingM: 2500,
      kmh: 0.5,
      plannedPace: 12,
      remainingVisitMin: 0,
    });
    expect(min).toBeCloseTo(30, 5);
    expect(
      timeToFinishMin({ remainingM: 2500, kmh: null, plannedPace: 12, remainingVisitMin: 0 }),
    ).toBeCloseTo(30, 5);
  });
});

describe("paceBarTone", () => {
  it("is good at/above plan, warn mid-slow, bad when much slower", () => {
    expect(paceBarTone(5, 12)).toBe("good");
    expect(paceBarTone(9, 12)).toBe("good");
    expect(paceBarTone(4.1, 12)).toBe("warn"); // 5/4.1 = 1.22
    expect(paceBarTone(3, 12)).toBe("bad");
    expect(paceBarTone(0, 12)).toBe("bad");
    expect(paceBarTone(null, 12)).toBe("good");
  });
});

describe("isNearAnyStop", () => {
  it("is true within the radius of any stop, false otherwise", () => {
    const stops = [{ coordinates: B }, { coordinates: C }];
    expect(isNearAnyStop(A, stops, 50)).toBe(false);
    expect(isNearAnyStop(A, stops, 150)).toBe(true);
    expect(isNearAnyStop(A, [], 150)).toBe(false);
  });
});

describe("nextStopAlongM", () => {
  const route = [A, B, C];
  it("measures along the route to the nearest stop still ahead", () => {
    const d = nextStopAlongM(route, 0, A, [{ lat: 32.0815, lng: 34.78 }, C]);
    expect(d).toBeCloseTo(haversineDistance(A, { lat: 32.0815, lng: 34.78 }), 0);
  });
  it("ignores stops behind the walker and stops far off the line", () => {
    const mid = { lat: 32.0815, lng: 34.78 };
    expect(nextStopAlongM(route, 1, mid, [A])).toBeNull();
    expect(nextStopAlongM(route, 0, A, [{ lat: 32.0815, lng: 34.79 }])).toBeNull();
    expect(nextStopAlongM(route, 0, A, [])).toBeNull();
  });
});

describe("routeDirectionDeg", () => {
  it("is the bearing of the route over the next 30 m", () => {
    expect(routeDirectionDeg([A, B, C], 0, A)).toBeCloseTo(0, 0);
    const east: Coordinates[] = [A, { lat: A.lat, lng: A.lng + 0.01 }];
    expect(routeDirectionDeg(east, 0, A)).toBeCloseTo(90, 0);
  });
  it("is null with nothing ahead", () => {
    expect(routeDirectionDeg([A], 0, A)).toBeNull();
    expect(routeDirectionDeg([A, B], 0, B)).toBeNull();
  });
});

describe("detourMinutes", () => {
  it("is out-and-back at plan pace (x1.25) plus the visit", () => {
    // 100 m at 12 min/km (83.3 m/min): 2*100*1.25/83.3 = 3 min, + 45 visit.
    expect(detourMinutes(100, 12, 45)).toBe(48);
    expect(detourMinutes(0, 12, 20)).toBe(20);
  });
});
