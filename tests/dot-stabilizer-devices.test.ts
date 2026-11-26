import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { DEVICES, pathPerMin, replayDots, walkMetrics, type DeviceId } from "./helpers/device-fixes";

// Movement bars per device class (docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md, section 4 commit 1). Seeds 1-3.
// Walk: stand 20 s, then 1.4 m/s for 180 s. `it.fails` marks a bar that the current stabilizer does not meet yet;
// the commit that meets it flips it to `it`.
const SEEDS = [1, 2, 3];
const walk = (id: DeviceId, seed: number) => walkMetrics(replayDots(DEVICES[id](seed, true), new DotStabilizer()));

describe("DotStabilizer devices: walking", () => {
  for (const seed of SEEDS) {
    it.fails(`A (Tab S6 network-only): first move <= 40 s, lag p50 <= 16 m, longest freeze <= 40 s (seed ${seed})`, () => {
      const m = walk("A", seed);
      expect(m.firstMoveS).toBeLessThanOrEqual(40);
      expect(m.lagP50).toBeLessThanOrEqual(16);
      expect(m.longestFreezeS).toBeLessThanOrEqual(40);
    });
    it.fails(`B3 (Doppler always 0): first move <= 20 s, lag p50 <= 5 m (seed ${seed})`, () => {
      const m = walk("B3", seed);
      expect(m.firstMoveS).toBeLessThanOrEqual(20);
      expect(m.lagP50).toBeLessThanOrEqual(5);
    });
    it.fails(`B4 (no Doppler): lag p50 <= 5 m (seed ${seed})`, () => {
      expect(walk("B4", seed).lagP50).toBeLessThanOrEqual(5);
    });
    it.fails(`C2 (urban, no Doppler): first move <= 40 s, lag p50 <= 10 m (seed ${seed})`, () => {
      const m = walk("C2", seed);
      expect(m.firstMoveS).toBeLessThanOrEqual(40);
      expect(m.lagP50).toBeLessThanOrEqual(10);
    });
  }
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
