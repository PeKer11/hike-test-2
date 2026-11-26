import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { DEVICES, STAND_S, T0, alongY, pathPerMin, replayDots, toLL, walkMetrics, type DeviceId } from "./helpers/device-fixes";

// Movement bars per device class (docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md, section 4 commit 1). Seeds 1-3.
// Walk: stand 20 s, then 1.4 m/s for 180 s. `it.fails` marks a bar that the current stabilizer does not meet yet;
// the commit that meets it flips it to `it`.
const SEEDS = [1, 2, 3];
const walk = (id: DeviceId, seed: number) => walkMetrics(replayDots(DEVICES[id](seed, true), new DotStabilizer()));

describe("DotStabilizer devices: walking (every seed)", () => {
  it("A (Tab S6 network-only): first move <= 40 s, lag p50 <= 16 m, longest freeze <= 40 s", () => {
    for (const seed of SEEDS) {
      const m = walk("A", seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(40);
      expect(m.lagP50, `seed ${seed}`).toBeLessThanOrEqual(16);
      expect(m.longestFreezeS, `seed ${seed}`).toBeLessThanOrEqual(40);
    }
  });
  it("B3 (Doppler always 0): first move <= 20 s, lag p50 <= 5 m", () => {
    for (const seed of SEEDS) {
      const m = walk("B3", seed);
      expect(m.firstMoveS, `seed ${seed}`).toBeLessThanOrEqual(20);
      expect(m.lagP50, `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });
  it("B4 (no Doppler): lag p50 <= 5 m", () => {
    for (const seed of SEEDS) expect(walk("B4", seed).lagP50, `seed ${seed}`).toBeLessThanOrEqual(5);
  });
  it("C2 (urban, no Doppler): first move <= 40 s, lag p50 <= 10 m", () => {
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

  it("guard: the 25 m cap never applies while Doppler says standing (the full accuracy still holds the dot)", () => {
    // A capped radius here would let a standing GPS phone's 30-40 m Wi-Fi-grade fixes walk the dot (S3/S4 bars).
    const st = new DotStabilizer();
    for (let s = 0; s < 6; s++) st.push({ coordinates: toLL(0, 0), accuracyM: 8, speedMps: 0.05, timestamp: T0 + s * 1000 });
    for (let s = 6; s < 30; s++) {
      expect(st.push({ coordinates: toLL(0, 35), accuracyM: 40, speedMps: 0.05, timestamp: T0 + s * 1000 }).publish).toBe(false);
    }
  });
});

describe("DotStabilizer: trend follow", () => {
  /** No-Doppler fixes 1 s apart along y; `y(s)` gives the position at second s. */
  const feed = (st: DotStabilizer, from: number, to: number, y: (s: number) => number) => {
    const out = [];
    for (let s = from; s < to; s++) out.push(st.push({ coordinates: toLL(0, y(s)), accuracyM: 60, timestamp: T0 + s * 1000 }));
    return out;
  };

  it("two escapes the same way within 60 s switch to following every fix", () => {
    const st = new DotStabilizer();
    const d = feed(st, 0, 30, (s) => (s < 10 ? 0 : s < 20 ? 30 : 60));
    expect(d.findIndex((x) => x.mode === "escape")).toBeLessThan(15);
    const trendAt = d.findIndex((x) => x.mode === "trend");
    expect(trendAt).toBeGreaterThan(20);
    expect(trendAt).toBeLessThan(25);
    expect(st.trending).toBe(true);
    expect(d.slice(trendAt).every((x) => x.publish)).toBe(true);
  });

  it("escape candidates that advance along the escape switch to trend at once", () => {
    const st = new DotStabilizer();
    feed(st, 0, 10, () => 0);
    // 1.4 m/s from 26 m out: three candidates advancing ~3 m over 2 s (>= max(8, 0.6 x span) fails), so walk on.
    const d = feed(st, 10, 40, (s) => 26 + (s - 10) * 1.4);
    expect(d.some((x) => x.mode === "trend")).toBe(true);
    const last = d[d.length - 1];
    expect(last.publish).toBe(true);
    expect(last.coordinates.lat).toBeCloseTo(toLL(0, 26 + 29 * 1.4).lat, 9);
  });

  it("leaves trend and holds when the fixes make no progress for about 20 s", () => {
    const st = new DotStabilizer();
    feed(st, 0, 60, (s) => (s < 10 ? 0 : s < 20 ? 30 : 60 + (s - 20) * 1.4));
    expect(st.trending).toBe(true);
    const d = feed(st, 60, 100, () => 60 + 40 * 1.4);
    expect(st.trending).toBe(false);
    expect(st.holding).toBe(true);
    const stopAt = d.findIndex((x) => x.mode !== "trend");
    expect(stopAt).toBeGreaterThan(5);
    expect(stopAt).toBeLessThanOrEqual(25);
    expect(d.slice(stopAt + 1).every((x) => !x.publish)).toBe(true);
  });
});

describe("DotStabilizer devices: standing", () => {
  for (const id of ["B1", "B2", "B3"] as const) {
    for (const seed of SEEDS) {
      it(`${id} standing stays under 5 m/min with 0 Doppler contradictions (seed ${seed})`, () => {
        const st = new DotStabilizer();
        expect(pathPerMin(replayDots(DEVICES[id](seed, false), st))).toBeLessThanOrEqual(5);
        expect(st.stats.contradictions).toBe(0);
      });
    }
  }
});

describe("DotStabilizer: Doppler contradiction", () => {
  it("walking with Doppler 0: the dot never steps more than 5 m backwards along the walk, except onto the raw fix itself", () => {
    // Following raw fixes carries their own noise (a good-GPS phone does the same); a recentre onto old fixes must not.
    const check = (fixes: Array<{ t: number; x: number; y: number; acc: number; speed?: number }>, label: string) => {
      const st = new DotStabilizer();
      let prev: number | null = null;
      for (const f of fixes) {
        const raw = toLL(f.x, f.y);
        const d = st.push({ coordinates: raw, accuracyM: f.acc, speedMps: f.speed, timestamp: f.t });
        const y = alongY(d.coordinates);
        const onRaw = d.coordinates.lat === raw.lat && d.coordinates.lng === raw.lng;
        if (prev !== null && !onRaw && f.t - T0 >= STAND_S * 1000) expect(y - prev, `${label} at ${(f.t - T0) / 1000} s (${d.mode})`).toBeGreaterThanOrEqual(-5);
        prev = y;
      }
    };
    check(Array.from({ length: 200 }, (_, s) => ({ t: T0 + s * 1000, x: 0, y: s < 30 ? 0 : (s - 30) * 1.4, acc: 10, speed: 0 })), "clean");
    for (const seed of SEEDS) check(DEVICES.B3(seed, true), `B3 seed ${seed}`);
  });

  it("Doppler stuck at exactly 0 while the fixes travel >= 18 m in ~20 s stops being trusted, and the dot follows", () => {
    const st = new DotStabilizer();
    let firstDistrust: number | null = null;
    for (let s = 0; s < 60; s++) {
      const y = s < 10 ? 0 : (s - 10) * 1.4;
      st.push({ coordinates: toLL(0, y), accuracyM: 10, speedMps: 0, timestamp: T0 + s * 1000 });
      if (firstDistrust === null && !st.dopplerTrusted(T0 + s * 1000)) firstDistrust = s;
    }
    expect(firstDistrust).not.toBeNull();
    expect(firstDistrust!).toBeLessThanOrEqual(35);
    expect(st.stats.contradictions).toBeGreaterThanOrEqual(1);
    expect(st.state).toBe("nodoppler");
    expect(st.holding).toBe(false);
  });

  it("a standing phone whose Doppler reads exactly 0 keeps holding and keeps trusting it", () => {
    const st = new DotStabilizer();
    for (let s = 0; s < 120; s++) {
      st.push({ coordinates: toLL(Math.sin(s / 7) * 4, Math.cos(s / 5) * 4), accuracyM: 10, speedMps: 0, timestamp: T0 + s * 1000 });
      expect(st.dopplerTrusted(T0 + s * 1000)).toBe(true);
    }
    expect(st.stats.contradictions).toBe(0);
    expect(st.state).toBe("stopped");
  });

  it("Doppler is trusted again 60 s after the last contradiction once the walker stands", () => {
    const st = new DotStabilizer();
    let s = 0;
    for (; s < 60; s++) st.push({ coordinates: toLL(0, s < 10 ? 0 : (s - 10) * 1.4), accuracyM: 10, speedMps: 0, timestamp: T0 + s * 1000 });
    expect(st.dopplerTrusted(T0 + s * 1000)).toBe(false);
    for (; s < 200; s++) st.push({ coordinates: toLL(0, 70), accuracyM: 10, speedMps: 0, timestamp: T0 + s * 1000 });
    expect(st.dopplerTrusted(T0 + s * 1000)).toBe(true);
    expect(st.state).toBe("stopped");
  });

  it("positionSpeed: about the walking speed while following positions, paused while held, unknown with no history", () => {
    const st = new DotStabilizer();
    expect(st.positionSpeed(T0).state).toBe("unknown");
    let s = 0;
    for (; s < 60; s++) st.push({ coordinates: toLL(0, s < 10 ? 0 : (s - 10) * 1.4), accuracyM: 60, timestamp: T0 + s * 1000 });
    const walking = st.positionSpeed(T0 + (s - 1) * 1000);
    expect(walking.state).toBe("moving");
    expect(walking.kmh!).toBeGreaterThan(4);
    expect(walking.kmh!).toBeLessThan(6);
    for (; s < 120; s++) st.push({ coordinates: toLL(0, 70), accuracyM: 60, timestamp: T0 + s * 1000 });
    expect(st.positionSpeed(T0 + (s - 1) * 1000)).toEqual({ kmh: 0, state: "paused" });
  });
});
