import { describe, expect, it } from "vitest";

import { chooseHeading, COMPASS_FRESH_MS, nearestEquivalent } from "@/lib/walk/heading-source";

const NOW = 1_000_000;
const base = { gps: null, compass: null, compassAt: null, now: NOW, simulated: false };
/** A compass reading taken `ageMs` ago. */
const compass = (deg: number, ageMs = 100) => ({ compass: deg, compassAt: NOW - ageMs });

describe("chooseHeading", () => {
  it("prefers a fresh compass over the GPS course while walking", () => {
    expect(chooseHeading({ ...base, gps: 90, ...compass(200) })).toBe(200);
  });

  it("falls back to the GPS course when the compass is stale (> 1.5 s)", () => {
    expect(COMPASS_FRESH_MS).toBe(1500);
    expect(chooseHeading({ ...base, gps: 90, ...compass(200, 1500) })).toBe(200); // exactly 1.5 s is still fresh
    expect(chooseHeading({ ...base, gps: 90, ...compass(200, 1501) })).toBe(90);
  });

  it("falls back to the GPS course when there is no compass at all", () => {
    expect(chooseHeading({ ...base, gps: 90 })).toBe(90);
  });

  it("keeps the last compass reading when it is stale and the GPS has no course, so a phone lying still keeps its beam", () => {
    expect(chooseHeading({ ...base, ...compass(200, 60_000) })).toBe(200);
  });

  it("has no heading at all when there is no source: no fake direction", () => {
    expect(chooseHeading(base)).toBeNull();
  });

  it("keeps a heading of 0 (north) as a heading", () => {
    expect(chooseHeading({ ...base, ...compass(0) })).toBe(0);
    expect(chooseHeading({ ...base, gps: 0 })).toBe(0);
  });

  it("in a simulated walk uses the simulated path only and never the phone's compass", () => {
    expect(chooseHeading({ ...base, gps: 45, ...compass(200), simulated: true })).toBe(45);
    expect(chooseHeading({ ...base, ...compass(200), simulated: true })).toBeNull();
  });
});

describe("nearestEquivalent", () => {
  it("is the value itself with nothing before it", () => {
    expect(nearestEquivalent(null, 30)).toBe(30);
    expect(nearestEquivalent(null, -400)).toBe(-400);
  });

  it("turns the short way across north", () => {
    expect(nearestEquivalent(355, 5)).toBe(365);
    expect(nearestEquivalent(5, 355)).toBe(-5);
  });

  it("brings a source that is whole turns away back next to what was shown", () => {
    expect(nearestEquivalent(725, 10)).toBe(730);
    expect(nearestEquivalent(-340, 10)).toBe(-350);
    expect(nearestEquivalent(100, 100)).toBe(100);
  });

  it("never moves the heading by more than half a turn", () => {
    for (const prev of [-700, -90, 0, 45, 359, 361, 1000]) {
      for (const next of [-720, -1, 0, 90, 179, 180, 181, 359, 540]) {
        const out = nearestEquivalent(prev, next);
        expect(Math.abs(out - prev)).toBeLessThanOrEqual(180);
        expect((((out - next) % 360) + 360) % 360).toBeCloseTo(0, 9); // same direction
      }
    }
  });
});
