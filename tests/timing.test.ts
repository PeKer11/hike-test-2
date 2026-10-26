import { describe, expect, it } from "vitest";

import { climbMinutes, dwellMinutes, legKmsFromGeometry, legPace, timeline } from "@/lib/walk/timing";

const stops = [
  { id: "a", visitMin: 30 },
  { id: "b", visitMin: 60 },
];

describe("timeline", () => {
  it("equals km x pace + default visits when there are no plans", () => {
    const t = timeline(stops, [1, 2], undefined, 15);
    expect(t.walkMin).toBe(45);
    expect(t.visitMin).toBe(90);
    expect(t.totalMin).toBe(135);
    expect(t.ignored).toEqual([]);
  });

  it("brisk to A, stroll to B, scale only those legs", () => {
    const t = timeline(stops, [1, 2], { a: { pace: "brisk" }, b: { pace: "stroll" } }, 15);
    expect(t.legs[0].pace).toBe(12);
    expect(t.legs[1].pace).toBeCloseTo(19.95);
    expect(t.walkMin).toBeCloseTo(12 + 39.9);
  });

  it("dwell 0 means pass by, and replaces the default visit time", () => {
    const t = timeline(stops, [1, 2], { b: { dwellMin: 0 }, a: { dwellMin: 10 } }, 15);
    expect(t.visitMin).toBe(10);
  });

  it("the return leg uses the end plan", () => {
    const t = timeline(stops, [1, 2, 1], { end: { pace: 20 } }, 15);
    expect(t.legs[2]).toMatchObject({ to: "end", pace: 20, min: 20 });
  });

  it("reports plans for stops that are not in the walk, without applying them", () => {
    const t = timeline(stops, [1, 2], { zzz: { pace: "brisk", dwellMin: 99 } }, 15);
    expect(t.ignored).toEqual(["zzz"]);
    expect(t.totalMin).toBe(135);
  });

  it("clamps absurd paces and dwell", () => {
    expect(legPace({ a: { pace: 1 } }, "a", 15)).toBe(6);
    expect(legPace({ a: { pace: 500 } }, "a", 15)).toBe(40);
    expect(dwellMinutes({ a: { dwellMin: 99999 } }, "a", 30)).toBe(600);
    expect(dwellMinutes({ a: { dwellMin: -5 } }, "a", 30)).toBe(30);
  });
});

describe("legKmsFromGeometry", () => {
  it("splits a straight route at the waypoints", () => {
    const geometry = Array.from({ length: 11 }, (_, i) => ({ lat: 32 + i * 0.001, lng: 34 }));
    const waypoints = [geometry[0], geometry[3], geometry[10]];
    const legs = legKmsFromGeometry(geometry, waypoints);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toBeCloseTo(0.333, 2);
    expect(legs[1]).toBeCloseTo(0.778, 2);
  });
});

describe("climbMinutes", () => {
  it("is Naismith scaled to the pace, with a 5 m/km noise floor", () => {
    expect(climbMinutes(120, 0, 12)).toBeCloseTo(12);
    expect(climbMinutes(120, 0, 15)).toBeCloseTo(15);
    expect(climbMinutes(10, 2, 12)).toBe(0);
    expect(climbMinutes(30, 2, 12)).toBeCloseTo(2);
  });

  it("adds climbing per leg to the timeline, only when every leg has a height", () => {
    const flat = timeline(stops, [1, 2], undefined, 15, null);
    expect(flat.climbKnown).toBe(false);
    const hill = timeline(stops, [1, 2], undefined, 15, [0, 80]);
    expect(hill.climbKnown).toBe(true);
    expect(hill.climbMin).toBeCloseTo(climbMinutes(80, 2, 15));
    expect(hill.walkMin).toBeCloseTo(45 + hill.climbMin);
    expect(timeline(stops, [1, 2], undefined, 15, [10]).climbKnown).toBe(false);
  });
});
