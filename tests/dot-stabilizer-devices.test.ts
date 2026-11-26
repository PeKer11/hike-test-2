import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { DEVICES, T0, pathPerMin, replayDots, toLL, walkMetrics, type DeviceId } from "./helpers/device-fixes";

// Movement bars per device class (docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md, section 4 commit 1). Seeds 1-3.
// Walk: stand 20 s, then 1.4 m/s for 180 s. `it.fails` marks a bar that the current stabilizer does not meet yet;
// the commit that meets it flips it to `it`.
const SEEDS = [1, 2, 3];
const walk = (id: DeviceId, seed: number) => walkMetrics(replayDots(DEVICES[id](seed, true), new DotStabilizer()));

describe("DotStabilizer devices: walking (every seed)", () => {
  it.fails("A (Tab S6 network-only): first move <= 40 s, lag p50 <= 16 m, longest freeze <= 40 s", () => {
    for (const seed of SEEDS) {
      const m = walk("A", seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(40);
      expect(m.lagP50, `seed ${seed}`).toBeLessThanOrEqual(16);
      expect(m.longestFreezeS, `seed ${seed}`).toBeLessThanOrEqual(40);
    }
  });
  it.fails("B3 (Doppler always 0): first move <= 20 s, lag p50 <= 5 m", () => {
    for (const seed of SEEDS) {
      const m = walk("B3", seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(20);
      expect(m.lagP50, `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });
  it.fails("B4 (no Doppler): lag p50 <= 5 m", () => {
    for (const seed of SEEDS) expect(walk("B4", seed).lagP50, `seed ${seed}`).toBeLessThanOrEqual(5);
  });
  it.fails("C2 (urban, no Doppler): first move <= 40 s, lag p50 <= 10 m", () => {
    for (const seed of SEEDS) {
      const m = walk("C2", seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(40);
      expect(m.lagP50, `seed ${seed}`).toBeLessThanOrEqual(10);
    }
  });
});

describe("DotStabilizer: no-Doppler escape radius", () => {
  it("a no-Doppler hold escapes 25 m out on 2 agreeing fixes over 2 s, whatever the reported accuracy", () => {
    const st = new DotStabilizer();
    st.push({ coordinates: toLL(0, 0), accuracyM: 100, timestamp: T0 });
    st.push({ coordinates: toLL(0, 1), accuracyM: 100, timestamp: T0 + 1_000 });
    expect(st.push({ coordinates: toLL(0, 28), accuracyM: 100, timestamp: T0 + 2_000 }).publish).toBe(false);
    const d = st.push({ coordinates: toLL(0, 30), accuracyM: 100, timestamp: T0 + 4_000 });
    expect(d.publish).toBe(true);
    expect(d.mode).not.toBe("hold");
  });
});

describe("DotStabilizer devices: standing", () => {
  for (const id of ["B1", "B2", "B3"] as const) {
    for (const seed of SEEDS) {
      it(`${id} standing stays under 5 m/min (seed ${seed})`, () => {
        expect(pathPerMin(replayDots(DEVICES[id](seed, false), new DotStabilizer()))).toBeLessThanOrEqual(5);
      });
    }
  }
});
