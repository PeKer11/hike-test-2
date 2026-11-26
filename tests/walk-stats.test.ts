import { describe, expect, it } from "vitest";

import {
  cumulativeDistances,
  isNearAnyStop,
  nextStopAlongM,
  routeDirectionDeg,
  detourMinutes,
  paceBarTone,
  pickShownSpeed,
  progressAlong,
  spareMinAtPace,
  steadyWalkedM,
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
  it("uses the measured speed when plausible, fast or slow vs plan", () => {
    const min = timeToFinishMin({
      remainingM: 2500,
      kmh: 6,
      plannedPace: 12,
      remainingVisitMin: 10,
    });
    expect(min).toBeCloseTo(25 + 10, 5);
  });

  it("prices a 2x faster walker at the measured pace (plan 2 km/h, walking 4)", () => {
    expect(timeToFinishMin({ remainingM: 1000, kmh: 4, plannedPace: 30, remainingVisitMin: 0 })).toBeCloseTo(15, 5);
  });

  it("prices a much slower walker at the measured pace (plan 5 km/h, walking 2)", () => {
    expect(timeToFinishMin({ remainingM: 1000, kmh: 2, plannedPace: 12, remainingVisitMin: 0 })).toBeCloseTo(30, 5);
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

describe("spareMinAtPace", () => {
  it("is the budget left minus the time to finish at that pace: positive ahead, negative over", () => {
    // 60 min set, 10 gone, 3 km and 5 visit minutes left.
    const args = { availableMin: 60, elapsedMin: 10, remainingM: 3000, remainingVisitMin: 5 };
    expect(spareMinAtPace({ ...args, paceMinPerKm: 13.3 })).toBeCloseTo(60 - 10 - (3 * 13.3 + 5), 5); // ~5.1 spare
    expect(spareMinAtPace({ ...args, paceMinPerKm: 30 })).toBeCloseTo(60 - 10 - (3 * 30 + 5), 5); // 45 over
    expect(spareMinAtPace({ ...args, paceMinPerKm: 30 })).toBeLessThan(0);
  });

  it("the planned-2-km/h walker at 4.5 km/h has time to lengthen", () => {
    // Plan: 2 km/h (30 min/km). 1 h set, 15 min in, 2 km left.
    expect(spareMinAtPace({ availableMin: 60, elapsedMin: 15, remainingM: 2000, remainingVisitMin: 0, paceMinPerKm: 13.3 })).toBeGreaterThan(10);
  });
});

describe("steadyWalkedM (distance holds while the walker is paused)", () => {
  it("holds the last distance while paused and the new fix is only jitter", () => {
    expect(steadyWalkedM(500, 512, "paused")).toBe(500);
    expect(steadyWalkedM(500, 478, "paused")).toBe(500);
  });
  it("moves normally when walking, with no earlier value, or when the route itself was swapped", () => {
    expect(steadyWalkedM(500, 512, "moving")).toBe(512);
    expect(steadyWalkedM(null, 512, "paused")).toBe(512);
    expect(steadyWalkedM(900, 20, "paused")).toBe(20);
  });
});

describe("pickShownSpeed", () => {
  const live = { kmh: 5, state: "moving" as const };
  const sustained = { kmh: 4.6, state: "moving" as const };
  const position = { kmh: 5.4, state: "moving" as const };
  const unknown = { kmh: null, state: "unknown" as const };

  it("trusted live Doppler first", () => {
    expect(pickShownSpeed({ live, sustained, position, dopplerTrusted: true })).toEqual({ ...live, source: "live" });
  });
  it("live Doppler that is not trusted is skipped for the sustained speed", () => {
    expect(pickShownSpeed({ live: { kmh: 0, state: "paused" }, sustained, position, dopplerTrusted: false })).toEqual({ ...sustained, source: "sustained" });
  });
  it("no live and no sustained speed: the position-derived one", () => {
    expect(pickShownSpeed({ live: unknown, sustained: unknown, position, dopplerTrusted: true })).toEqual({ ...position, source: "position" });
    expect(pickShownSpeed({ live: undefined, sustained: unknown, position, dopplerTrusted: false })).toEqual({ ...position, source: "position" });
  });
  it("nothing known anywhere: unknown", () => {
    expect(pickShownSpeed({ live: unknown, sustained: unknown, position: undefined, dopplerTrusted: true }).state).toBe("unknown");
  });
});
