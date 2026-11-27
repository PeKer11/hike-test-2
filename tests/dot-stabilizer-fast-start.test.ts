import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { LiveSpeed } from "@/lib/walk/live-speed";
import { SpeedEstimator } from "@/lib/walk/speed-estimator";
import { pickShownSpeed } from "@/lib/walk/walk-stats";
import { DEVICES, T0, genStill, replayStill, standMetrics, stillWalkMetrics, toLL, toXY, type StillOpts } from "./helpers/device-fixes";

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
  it("repro (still Doppler 0 -> walk null, acc 9, +-3 m): first move <= 8 s, trend by 8 s, lag @20 s <= 5 m", () => {
    for (const seed of SEEDS) {
      const { rows, m } = walk(REPRO, seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(8);
      expect(rows.some((r) => r.s >= STAND_S && r.s <= STAND_S + 8 && r.mode === "trend"), `seed ${seed} trend`).toBe(true);
      expect(Math.abs(m.lag20), `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });

  for (const [name, speed] of [["null", "null"], ["0", "zero"]] as const) {
    it(`good GPS, speed ${name} (acc 7-12, +-3 m): first move <= 11 s, median <= 8 s`, () => {
      const firsts = SEEDS.map((seed) => {
        const { m } = walk(walkOpts({ acc: [7, 12], noise: U(3), speedStand: speed, speedWalk: speed }), seed);
        expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(11);
        return m.firstMoveS;
      });
      expect(median(firsts)).toBeLessThanOrEqual(8);
    });

    it(`realistic drift (AR s4 t60, acc 7-18), speed ${name}: first move <= 10 s`, () => {
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

describe("DotStabilizer: stale exact-0 Doppler", () => {
  it("10 fixes of Doppler 0, then speedless fixes advancing 1.4 m/s: never unsure, no publish lands > 3 m ahead of the raw fix", () => {
    const st = new DotStabilizer();
    for (let s = 0; s < 10; s++) st.push({ coordinates: toLL(0, 0), accuracyM: 9, speedMps: 0, timestamp: T0 + s * 1000 });
    for (let s = 10; s < 50; s++) {
      const raw = toLL(0, (s - 10) * 1.4);
      const d = st.push({ coordinates: raw, accuracyM: 9, speedMps: null, timestamp: T0 + s * 1000 });
      expect(d.state, `t=${s}`).not.toBe("unsure");
      if (d.publish) expect(toXY(d.coordinates).y - toXY(raw).y, `t=${s}`).toBeLessThanOrEqual(3);
    }
  });
});

describe("DotStabilizer fast start: guard", () => {
  it("B3 / B4 standing (s5 t15): no fast start on seeds 1-6 (their 8 s noise scale turns the lane off)", () => {
    for (const id of ["B3", "B4"] as const) {
      for (const seed of SEEDS) {
        const st = new DotStabilizer();
        replayStill(DEVICES[id](seed, false), st);
        expect(fastStarts(st), `${id} seed ${seed}`).toBe(0);
      }
    }
  });
});

describe("speed cell while the fast lane trends", () => {
  // Same wiring as WalkPlannerApp: Doppler goes to LiveSpeed / SpeedEstimator only while the stabilizer trusts it.
  for (const speedWalk of ["null", "zero"] as const) {
    it(`repro, walk speed ${speedWalk}: the cell shows 3.5-6.5 km/h at walk +10 s and +20 s`, () => {
      for (const seed of [1, 2, 3]) {
        const st = new DotStabilizer();
        const se = new SpeedEstimator();
        const ls = new LiveSpeed();
        for (const f of genStill(seed, { ...REPRO, speedWalk })) {
          const c = toLL(f.x, f.y);
          st.push({ coordinates: c, accuracyM: f.acc, speedMps: f.speed, timestamp: f.t });
          const sp = st.dopplerTrusted(f.t) ? f.speed : undefined;
          ls.record({ timestamp: f.t, speedMps: sp });
          se.record({ coordinates: c, timestamp: f.t, accuracyMeters: f.acc, speedMps: sp });
          const t = (f.t - T0) / 1000 - STAND_S;
          if (t !== 10 && t !== 20) continue;
          const shown = pickShownSpeed({
            live: ls.current(f.t),
            sustained: se.current(f.t),
            position: st.positionSpeed(f.t),
            dopplerTrusted: st.dopplerTrusted(f.t),
            trending: st.trending,
          });
          expect(shown.state, `seed ${seed} +${t} s`).toBe("moving");
          expect(shown.kmh, `seed ${seed} +${t} s`).toBeGreaterThanOrEqual(3.5);
          expect(shown.kmh, `seed ${seed} +${t} s`).toBeLessThanOrEqual(6.5);
        }
      }
    });
  }
});
