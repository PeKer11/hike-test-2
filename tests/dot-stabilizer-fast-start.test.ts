import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { genStill, replayStill, standMetrics, stillWalkMetrics, type StillOpts } from "./helpers/device-fixes";

// Fast-start bars (docs/LIVE-DEVICE-FOLLOWUP-PLAN-2026-11-26.md, section (a) and (d) commit 1). Seeds 1-6.
// Walk: stand 30 s, then 1.4 m/s for 90 s, 1 Hz. `it.fails` marks a bar the current stabilizer does not meet yet;
// the commit that meets it flips it to `it`.
const SEEDS = [1, 2, 3, 4, 5, 6];
const U = (a: number) => ({ kind: "uniform" as const, a });
const DRIFT = { kind: "ar" as const, sigma: 4, tau: 60, white: 0.7 };
const DRIFT2 = { kind: "ar" as const, sigma: 3, tau: 30, white: 1 };
const STAND_S = 30;
const walkOpts = (o: Omit<StillOpts, "standS" | "walkS">): StillOpts => ({ standS: STAND_S, walkS: 90, ...o });

const walk = (o: StillOpts, seed: number) => {
  const st = new DotStabilizer();
  const rows = replayStill(genStill(seed, o), st);
  return { rows, m: stillWalkMetrics(rows, STAND_S) };
};
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const fastStarts = (st: DotStabilizer) => (st.stats as { fastStarts?: number }).fastStarts ?? 0;

const REPRO = walkOpts({ acc: [9, 9], noise: U(3), standScale: 0.3, speedStand: "zero", speedWalk: "null" });

describe("DotStabilizer fast start: walking", () => {
  it.fails("repro (still Doppler 0 -> walk null, acc 9, +-3 m): first move <= 8 s, trend by 8 s, lag @20 s <= 5 m", () => {
    for (const seed of SEEDS) {
      const { rows, m } = walk(REPRO, seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(8);
      expect(rows.some((r) => r.s >= STAND_S && r.s <= STAND_S + 8 && r.mode === "trend"), `seed ${seed} trend`).toBe(true);
      expect(Math.abs(m.lag20), `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });

  for (const [name, speed] of [["null", "null"], ["0", "zero"]] as const) {
    it.fails(`good GPS, speed ${name} (acc 7-12, +-3 m): first move <= 11 s, median <= 8 s`, () => {
      const firsts = SEEDS.map((seed) => {
        const { m } = walk(walkOpts({ acc: [7, 12], noise: U(3), speedStand: speed, speedWalk: speed }), seed);
        expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(11);
        return m.firstMoveS;
      });
      expect(median(firsts)).toBeLessThanOrEqual(8);
    });

    it.fails(`realistic drift (AR s4 t60, acc 7-18), speed ${name}: first move <= 10 s`, () => {
      for (const seed of SEEDS) {
        const { m } = walk(walkOpts({ acc: [7, 18], noise: DRIFT, speedStand: speed, speedWalk: speed }), seed);
        expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(10);
      }
    });
  }
});

describe("DotStabilizer fast start: standing 300 s stays held", () => {
  const stand = (o: Omit<StillOpts, "standS" | "walkS" | "speedWalk">, seed: number) => {
    const st = new DotStabilizer();
    const rows = replayStill(genStill(seed, { ...o, standS: 300, walkS: 0, speedWalk: "null" }), st);
    return { st, m: standMetrics(rows) };
  };

  for (const a of [3, 5, 8]) {
    for (const speed of ["null", "zero"] as const) {
      it(`+-${a} m jitter, speed ${speed}: <= 3.5 m/min, no fast start`, () => {
        for (const seed of SEEDS) {
          const { st, m } = stand({ acc: [10, 10], noise: U(a), speedStand: speed }, seed);
          expect(m.pathPerMin, `seed ${seed}`).toBeLessThanOrEqual(3.5);
          expect(fastStarts(st), `seed ${seed}`).toBe(0);
        }
      });
    }
  }

  for (const [name, noise] of [["s4 t60", DRIFT], ["s3 t30", DRIFT2]] as const) {
    for (const speed of ["null", "zero"] as const) {
      it(`drift ${name}, speed ${speed}: <= 5 m/min, <= 1.2 moves/min`, () => {
        for (const seed of SEEDS) {
          const { m } = stand({ acc: [7, 18], noise, speedStand: speed }, seed);
          expect(m.pathPerMin, `seed ${seed}`).toBeLessThanOrEqual(5);
          expect(m.movesPerMin, `seed ${seed}`).toBeLessThanOrEqual(1.2);
        }
      });
    }
  }
});
