import { describe, expect, it } from "vitest";

import type { Coordinates } from "@/lib/types";
import {
  HEADING_HOLD_MS,
  HeadingSmoother,
  type HeadingSample,
} from "@/lib/walk/heading-smoother";

const M = 111_320;
const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const at = (eastM: number, northM: number): Coordinates => ({
  lat: ORIGIN.lat + northM / M,
  lng: ORIGIN.lng + eastM / (M * Math.cos((ORIGIN.lat * Math.PI) / 180)),
});

let clock = 1_000_000;
function sample(over: Partial<HeadingSample> & { position: Coordinates }, dtMs = 1_000): HeadingSample {
  clock += dtMs;
  return { accuracyM: 5, timestamp: clock, ...over };
}
const fresh = () => {
  clock = 1_000_000;
  return new HeadingSmoother();
};

describe("HeadingSmoother: where the device gives a heading", () => {
  it("uses coords.heading while moving", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 90, speedMps: 1.3 }));
    expect(h.current(clock)).toBeCloseTo(90, 5);
  });

  it("ignores coords.heading when the device is nearly still (the OS reports noise)", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 90, speedMps: 0.2 }));
    expect(h.current(clock)).toBeNull();
  });

  it.each([[Number.NaN], [-1], [400]])("ignores an impossible heading (%s) and has no arrow", (bad) => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: bad, speedMps: 1.3 }));
    expect(h.current(clock)).toBeNull();
  });
});

describe("HeadingSmoother: the chord between two fixes", () => {
  it("falls back to the bearing between two fixes 8 m or more apart", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0) }));
    expect(h.current(clock)).toBeNull(); // one fix says nothing about direction
    h.push(sample({ position: at(0, 9) })); // 9 m due north
    expect(h.current(clock)).toBeCloseTo(0, 0);
    h.push(sample({ position: at(30, 9) })); // then 30 m due east: the bearing swings towards 90
    expect(h.current(clock)!).toBeGreaterThan(0);
    expect(h.current(clock)!).toBeLessThan(90);
  });

  it("does not turn on a chord shorter than 8 m", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0) }));
    h.push(sample({ position: at(5, 0) }));
    expect(h.current(clock)).toBeNull();
  });

  it("ignores a poor-accuracy fix: a loose fix says nothing about direction", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0) }));
    h.push(sample({ position: at(0, 40), accuracyM: 40 }));
    expect(h.current(clock)).toBeNull();
  });

  it("needs a longer chord from a looser fix, so jitter at 20 m accuracy is not a direction", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), accuracyM: 20 }));
    h.push(sample({ position: at(12, 0), accuracyM: 20 })); // 12 m apart, but each is only good to 20 m
    expect(h.current(clock)).toBeNull();
    h.push(sample({ position: at(35, 0), accuracyM: 20 })); // 23 m from the last: now it means something
    expect(h.current(clock)).toBeCloseTo(90, 0);
  });

  it("standing still never turns the arrow, however much the dot jitters", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 45, speedMps: 1.4 }));
    const before = h.current(clock)!;
    // 12 s of jitter up to 12 m around one spot while the device says it is standing: the held heading stays exactly as it was.
    const jitter = [at(10, 3), at(-8, 6), at(4, -11), at(-12, 2), at(9, 9), at(-6, -9)];
    for (const p of jitter) h.push(sample({ position: p, speedMps: 0, accuracyM: 6 }, 2_000));
    expect(h.current(clock)).toBe(before);
  });
});

describe("HeadingSmoother: smoothing and the 0/360 seam", () => {
  it("takes the short way round: 350 to 10 is a 20 degree turn, not 340", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 350, speedMps: 1.3 }));
    h.push(sample({ position: at(0, 1), headingDeg: 10, speedMps: 1.3 }));
    const v = h.current(clock)!;
    // Unwrapped and between the two: a CSS rotation from 350 to here is a few degrees, never a spin through 180.
    expect(v).toBeGreaterThan(350);
    expect(v).toBeLessThan(370);
    expect(Math.abs(v - 350)).toBeLessThan(20);
  });

  it("takes the short way the other way round too: 10 to 350", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 10, speedMps: 1.3 }));
    h.push(sample({ position: at(0, 1), headingDeg: 350, speedMps: 1.3 }));
    const v = h.current(clock)!;
    expect(v).toBeLessThan(10);
    expect(v).toBeGreaterThan(-10);
  });

  it("converges on a steady heading and moves only part of the way each step", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 0, speedMps: 1.3 }));
    h.push(sample({ position: at(0, 1), headingDeg: 90, speedMps: 1.3 }));
    const first = h.current(clock)!;
    expect(first).toBeGreaterThan(20);
    expect(first).toBeLessThan(45);
    for (let i = 0; i < 12; i += 1) h.push(sample({ position: at(i, 1), headingDeg: 90, speedMps: 1.3 }));
    expect(h.current(clock)!).toBeCloseTo(90, 0);
  });
});

describe("HeadingSmoother: holding and giving up", () => {
  it("holds the last heading for 20 s with nothing valid, then drops the arrow", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 120, speedMps: 1.3 }));
    const last = clock;
    expect(h.current(last + HEADING_HOLD_MS)).toBeCloseTo(120, 5);
    expect(h.current(last + HEADING_HOLD_MS + 1)).toBeNull();
  });

  it("a heading after a long gap starts fresh instead of blending with a stale one", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 0, speedMps: 1.3 }));
    h.push(sample({ position: at(0, 5), headingDeg: 180, speedMps: 1.3 }, HEADING_HOLD_MS + 5_000));
    expect(h.current(clock)).toBeCloseTo(180, 5);
  });

  it("reset forgets everything", () => {
    const h = fresh();
    h.push(sample({ position: at(0, 0), headingDeg: 120, speedMps: 1.3 }));
    h.reset();
    expect(h.current(clock)).toBeNull();
  });
});
