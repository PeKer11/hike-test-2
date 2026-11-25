import { describe, expect, it } from "vitest";

import { DotStabilizer } from "@/lib/walk/dot-stabilizer";
import { haversineDistance } from "@/lib/utils/geo";

const LAT0 = 32.0853;
const LNG0 = 34.7818;
const toLL = (x: number, y: number) => ({ lat: LAT0 + y / 111320, lng: LNG0 + x / (111320 * Math.cos((LAT0 * Math.PI) / 180)) });
const T0 = 1_700_000_000_000;

function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, n };
}
/** Correlated drift, like a standing GPS. */
function ar(r: ReturnType<typeof rng>, sigma: number, tauS: number) {
  let ex = r.n() * sigma;
  let ey = r.n() * sigma;
  const a = Math.exp(-1 / tauS);
  const b = Math.sqrt(1 - a * a) * sigma;
  return () => {
    ex = a * ex + b * r.n();
    ey = a * ey + b * r.n();
    return { x: ex, y: ey };
  };
}

interface Fix { t: number; x: number; y: number; acc: number; speed?: number; truthY: number }
const AP = [{ x: 18, y: 6 }, { x: -12, y: 22 }, { x: 4, y: -30 }];

function standing(kind: "s1" | "s3" | "s4", seed: number, secs = 600): Fix[] {
  const r = rng(seed);
  const [sigma, tau, accLo, accHi, dop] = kind === "s1" ? [4, 20, 5, 12, 0.25] : [10, 30, 12, 30, 0.4];
  const e = ar(r, sigma, tau);
  let cl = 0;
  let burst = 0;
  const out: Fix[] = [];
  for (let s = 0; s < secs; s++) {
    const t = T0 + s * 1000;
    const wifi = () => ({ t, x: AP[cl].x + r.n() * 3, y: AP[cl].y + r.n() * 3, acc: 18 + r.u() * 22, speed: undefined, truthY: 0 });
    if (kind === "s4") {
      if (r.u() < 0.05) cl = Math.floor(r.u() * 3);
      out.push(wifi());
      continue;
    }
    if (kind === "s3") {
      if (burst > 0) { burst--; out.push(wifi()); continue; }
      if (r.u() < 0.08) { burst = 2 + Math.floor(r.u() * 6); cl = Math.floor(r.u() * 3); }
    }
    const n = e();
    out.push({ t, x: n.x + r.n() * 1.5, y: n.y + r.n() * 1.5, acc: accLo + r.u() * (accHi - accLo), speed: Math.abs(r.n()) * dop * 0.5, truthY: 0 });
  }
  return out;
}

function walking(seed: number, v: number, secs = 300): Fix[] {
  const r = rng(seed);
  const e = ar(r, 3, 15);
  const out: Fix[] = [];
  for (let s = 0; s < secs; s++) {
    const ty = s < 60 ? 0 : (s - 60) * v;
    const n = e();
    out.push({ t: T0 + s * 1000, x: n.x, y: ty + n.y, acc: 6 + r.u() * 8, speed: s >= 60 ? Math.max(0, v + r.n() * 0.15) : Math.abs(r.n()) * 0.12, truthY: ty });
  }
  return out;
}

function replay(fixes: Fix[]) {
  const st = new DotStabilizer();
  const dots: Array<{ s: number; dot: { lat: number; lng: number }; truthY: number }> = [];
  let dot: { lat: number; lng: number } | null = null;
  let publishes = 0;
  for (const f of fixes) {
    const d = st.push({ coordinates: toLL(f.x, f.y), accuracyM: f.acc, speedMps: f.speed, timestamp: f.t });
    if (d.publish) { dot = d.coordinates; publishes++; }
    if (dot) dots.push({ s: (f.t - T0) / 1000, dot, truthY: f.truthY });
  }
  return { dots, publishes, st };
}
const pathPerMin = (dots: ReturnType<typeof replay>["dots"], from = 30) => {
  const w = dots.filter((d) => d.s >= from);
  let p = 0;
  let moves = 0;
  for (let i = 1; i < w.length; i++) { const d = haversineDistance(w[i - 1].dot, w[i].dot); p += d; if (d > 1) moves++; }
  const mins = (w[w.length - 1].s - w[0].s) / 60;
  return { path: p / mins, moves: moves / mins };
};

describe("DotStabilizer: standing", () => {
  for (const seed of [1, 2, 3]) {
    it(`open-sky GPS stays under 10 m/min and 1 move/min (seed ${seed})`, () => {
      const m = pathPerMin(replay(standing("s1", seed)).dots);
      expect(m.path).toBeLessThanOrEqual(10);
      expect(m.moves).toBeLessThanOrEqual(1);
    });
    it(`GPS with Wi-Fi bursts stays under 60 m/min (seed ${seed})`, () => {
      expect(pathPerMin(replay(standing("s3", seed)).dots).path).toBeLessThanOrEqual(60);
    });
    it(`Wi-Fi only (no Doppler) stays under 120 m/min (seed ${seed})`, () => {
      expect(pathPerMin(replay(standing("s4", seed)).dots).path).toBeLessThanOrEqual(120);
    });
  }

  it("a fix without speed never moves the dot while Doppler says standing", () => {
    const st = new DotStabilizer();
    const here = toLL(0, 0);
    for (let s = 0; s < 8; s++) st.push({ coordinates: here, accuracyM: 8, speedMps: 0.05, timestamp: T0 + s * 1000 });
    const far = toLL(60, 0);
    for (let s = 8; s < 14; s++) {
      const d = st.push({ coordinates: far, accuracyM: 20, timestamp: T0 + s * 1000 });
      expect(d.publish).toBe(false);
    }
  });
});

describe("DotStabilizer: walking", () => {
  it("starts following within 5 s of real walking, with the same lag as the raw fixes (+-0.5 m)", () => {
    const fixes = walking(11, 1.3);
    const { dots } = replay(fixes);
    const base = dots.find((d) => d.s >= 59)!.dot;
    const start = dots.find((d) => d.s >= 60 && haversineDistance(base, d.dot) > 5)!;
    expect(start.s - 60).toBeLessThanOrEqual(5);
    const lag = (use: "dot" | "raw") => {
      const e = fixes.filter((f) => f.t - T0 >= 70_000).map((f) => {
        const dot = use === "dot" ? dots.find((d) => d.s === (f.t - T0) / 1000)!.dot : toLL(f.x, f.y);
        return haversineDistance(dot, toLL(0, f.truthY));
      }).sort((a, b) => a - b);
      return e[Math.floor(e.length * 0.95)];
    };
    expect(Math.abs(lag("dot") - lag("raw"))).toBeLessThanOrEqual(0.5);
  });

  it("a 0.5 m/s stroll is never held for more than 10 s", () => {
    const fixes = walking(12, 0.5);
    const { dots } = replay(fixes);
    let still = 0;
    let worst = 0;
    for (let i = 61; i < dots.length; i++) {
      if (dots[i].dot === dots[i - 1].dot) { still++; worst = Math.max(worst, still); } else still = 0;
    }
    expect(worst).toBeLessThanOrEqual(10);
  });
});
