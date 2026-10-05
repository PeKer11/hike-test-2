import { describe, expect, it } from "vitest";

import { PaceAdvisor } from "@/lib/walk/pace-advisor";
import type { Coordinates } from "@/lib/types";

const T0 = 1_700_000_000_000;
const START: Coordinates = { lat: 32.08, lng: 34.78 };
const M_PER_DEG_LAT = 111_320;

/** Walks north for `seconds` at `paceMinPerKm`, a fix every 10 s. Returns end time. */
function feed(
  advisor: PaceAdvisor,
  from: number,
  seconds: number,
  paceMinPerKm: number,
  startMeters = 0,
): { end: number; meters: number } {
  const mps = 1000 / (paceMinPerKm * 60);
  let meters = startMeters;
  let t = from;
  for (let s = 0; s <= seconds; s += 10) {
    advisor.record({
      coordinates: { lat: START.lat + meters / M_PER_DEG_LAT, lng: START.lng },
      timestamp: t,
    });
    meters += mps * 10;
    t += 10_000;
  }
  return { end: t - 10_000, meters };
}

describe("PaceAdvisor", () => {
  it("stays silent at planned pace", () => {
    const a = new PaceAdvisor(12);
    const { end } = feed(a, T0, 330, 12);
    expect(a.evaluate(end, false)).toBeNull();
  });

  it("says slow within ~5 minutes of a 1.6x slowdown", () => {
    const a = new PaceAdvisor(12);
    const { end } = feed(a, T0, 330, 19.2);
    expect(a.evaluate(end, false)).toBe("slow");
  });

  it("says fast for a brisk window", () => {
    const a = new PaceAdvisor(12);
    const { end } = feed(a, T0, 330, 8);
    expect(a.evaluate(end, false)).toBe("fast");
  });

  it("does not speak before the window has enough coverage", () => {
    const a = new PaceAdvisor(12);
    const { end } = feed(a, T0, 120, 25);
    expect(a.evaluate(end, false)).toBeNull();
  });

  it("is silent near a stop", () => {
    const a = new PaceAdvisor(12);
    const { end } = feed(a, T0, 330, 19.2);
    expect(a.evaluate(end, true)).toBeNull();
    // ...and still offers it once the walker is clear of the stop.
    expect(a.evaluate(end, false)).toBe("slow");
  });

  it("holds a 6-minute cooldown between cards of the same kind", () => {
    const a = new PaceAdvisor(12);
    const first = feed(a, T0, 330, 19.2);
    expect(a.evaluate(first.end, false)).toBe("slow");
    const second = feed(a, first.end + 10_000, 120, 19.2, first.meters);
    expect(a.evaluate(second.end, false)).toBeNull();
    const third = feed(a, second.end + 10_000, 300, 19.2, second.meters);
    expect(a.evaluate(third.end, false)).toBe("slow");
  });

  it("uses hysteresis: ratio between 1.15 and 1.3 keeps slow, below 1.15 clears it", () => {
    const a = new PaceAdvisor(12);
    const slow = feed(a, T0, 330, 19.2);
    expect(a.evaluate(slow.end, false)).toBe("slow");
    // 1.2x: above the 1.15 clear line, below the 1.3 entry line -> still "slow" state,
    // but the cooldown suppresses a new card.
    const mid = feed(a, slow.end + 10_000, 330, 14.4, slow.meters);
    expect(a.evaluate(mid.end, false)).toBeNull();
    // Back on plan clears the state; a later real slowdown can card again after cooldown.
    const ok = feed(a, mid.end + 10_000, 330, 12, mid.meters);
    expect(a.evaluate(ok.end, false)).toBeNull();
    const slowAgain = feed(a, ok.end + 10_000, 330, 19.2, ok.meters);
    expect(a.evaluate(slowAgain.end, false)).toBe("slow");
  });

  it("does not call a walker slow right after a long visit at a stop", () => {
    const a = new PaceAdvisor(12);
    const walked = feed(a, T0, 300, 12);
    let t = walked.end + 10_000;
    const stopEnd = t + 240_000;
    for (; t <= stopEnd; t += 10_000) {
      a.record(
        { coordinates: { lat: START.lat + walked.meters / M_PER_DEG_LAT, lng: START.lng }, timestamp: t },
        true,
      );
    }
    const after = feed(a, t, 90, 12, walked.meters);
    expect(a.evaluate(after.end, false)).toBeNull();
  });

  it("still says slow for a slow walker on a route with a stop every 300 m (quiet within 50 m of each)", () => {
    const a = new PaceAdvisor(12);
    const mps = 1000 / (18 * 60); // ratio 1.5
    let t = T0;
    let meters = 0;
    let said: string | null = null;
    // A fix every 10 s for ~12 minutes; within 50 m of a stop every 300 m.
    for (let i = 0; i < 72; i += 1) {
      const m = meters % 300;
      const atStop = m < 50 || m > 250;
      a.record(
        { coordinates: { lat: START.lat + meters / M_PER_DEG_LAT, lng: START.lng }, timestamp: t },
        atStop,
      );
      const r = a.evaluate(t, atStop);
      if (r) said = r;
      meters += mps * 10;
      t += 10_000;
    }
    expect(said).toBe("slow");
  });
});
