import { describe, expect, it } from "vitest";

import { TrailFilter, withLiveTail } from "@/lib/walk/trail-filter";
import { haversineDistance } from "@/lib/utils/geo";
import { ENGINE_MAX_ACCURACY_M } from "@/lib/walk/walk-cadence";
import type { Coordinates } from "@/lib/types";

// Replays what the app does with a stream of fixes: the tracker drops fixes worse than 150 m, the dot is published at
// most every 500 ms, the engine drops fixes worse than 50 m, TrailFilter.accept runs on published fixes only, and the
// map draws withLiveTail(trail, dot, ...). The phone stands still for 5 minutes with 1 Hz fixes, mixing GPS fixes with
// Wi-Fi/cell ("network") fixes the way Android's fused provider does.

type Fix = { c: Coordinates; t: number; acc: number; kind: "gps" | "net"; v?: number; quick?: boolean };
const M = 111_320;
const at = (n: number, e = 0): Coordinates => ({ lat: 32 + n / M, lng: 34 + e / (M * Math.cos((32 * Math.PI) / 180)) });
const O = at(0);

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const gps = (t: number): Fix => {
  const acc = 5 + rnd() * 10;
  return { c: at((gauss() * acc) / 2, (gauss() * acc) / 2), t, acc, kind: "gps", v: Math.abs(gauss()) * 0.15 };
};
const net = (t: number, distM: number, bearingDeg: number, acc: number, jitter = 3): Fix => {
  const b = (bearingDeg * Math.PI) / 180;
  return { c: at(distM * Math.cos(b) + gauss() * jitter, distM * Math.sin(b) + gauss() * jitter), t, acc, kind: "net" };
};
/** GPS noise that drifts slowly (AR(1), tau 20 s), like a real standing phone. */
function drift(sigmaM: number, tauS = 20) {
  let n = 0;
  let e = 0;
  const a = Math.exp(-1 / tauS);
  const k = Math.sqrt(1 - a * a) * sigmaM;
  return (t: number): Fix => {
    n = a * n + k * gauss();
    e = a * e + k * gauss();
    return { c: at(n, e), t, acc: 8 + rnd() * 6, kind: "gps", v: Math.abs(gauss()) * 0.15 };
  };
}

function run(fixes: Fix[]) {
  const filter = new TrailFilter();
  const trail: Coordinates[] = [];
  let lastPublished = -Infinity;
  let emitted = false;
  let dot: Coordinates | null = null;
  let dotAcc: number | null = null;
  let maxTail = 0;
  let farthestDrawn = 0;
  for (const x of fixes) {
    if (x.acc > 150 && emitted) continue;
    emitted = true;
    const due = x.t - lastPublished >= 500;
    if (due) {
      lastPublished = x.t;
      dot = x.c;
      dotAcc = x.acc;
    }
    if (x.acc <= ENGINE_MAX_ACCURACY_M && due) {
      const point = filter.accept(x.c, x.t, x.acc, x.v, x.quick ? "quick" : "watch");
      if (point) trail.push(point);
    }
    const drawn = withLiveTail(trail, dot, dotAcc, filter.tailAllowed(dot, dotAcc));
    for (const p of drawn) farthestDrawn = Math.max(farthestDrawn, haversineDistance(O, p));
    if (drawn !== trail && drawn.length >= 2) maxTail = Math.max(maxTail, haversineDistance(drawn[drawn.length - 2], drawn[drawn.length - 1]));
  }
  const length = trail.slice(1).reduce((s, p, i) => s + haversineDistance(trail[i], p), 0);
  return { trail, farthestDrawn, maxTail, length };
}

const T = 300;

describe("a standing phone with network fixes mixed into the GPS stream draws nothing far from where it stands", () => {
  const cases: Array<[string, number, () => Fix[]]> = [
    ["A: a single network outlier (80-200 m) every 45 s", 3, () => {
      const xs: Fix[] = [];
      for (let s = 0; s < T; s++) xs.push(s % 45 === 30 ? net(s * 1000, 80 + rnd() * 120, rnd() * 360, 20 + rnd() * 30) : gps(s * 1000));
      return xs;
    }],
    ["B: 4-fix bursts of one Wi-Fi cluster 120 m away every 60 s", 5, () => {
      const xs: Fix[] = [];
      for (let s = 0; s < T; s++) xs.push(s % 60 >= 40 && s % 60 < 44 ? net(s * 1000, 120, 70, 30, 2) : gps(s * 1000));
      return xs;
    }],
    ["C: the walk's first fix is a network fix 120 m away, then GPS", 7, () => {
      const xs: Fix[] = [{ ...net(0, 120, 300, 14), quick: true }];
      for (let s = 1; s < T; s++) xs.push(gps(s * 1000));
      return xs;
    }],
    ["G3: one 4-fix network cluster 130 m away while the GPS drifts", 24, () => {
      const g = drift(4);
      const xs: Fix[] = [];
      for (let s = 0; s < T; s++) xs.push(s >= 120 && s < 124 ? net(s * 1000, 130, 250, 30, 2) : g(s * 1000));
      return xs;
    }],
    ["G4: GPS silent for 30 s, then one 100 m Wi-Fi fix (acc 12)", 25, () => {
      const g = drift(4);
      const xs: Fix[] = [];
      for (let s = 0; s < T; s++) {
        if (s >= 120 && s < 150) continue;
        xs.push(s === 150 ? net(s * 1000, 100, 120, 12) : g(s * 1000));
      }
      return xs;
    }],
    ["G5: no point kept for 120 s, then one 150 m Wi-Fi fix (acc 14)", 21, () => {
      const g = drift(4);
      const xs: Fix[] = [];
      for (let s = 0; s < T; s++) {
        const x = g(s * 1000);
        xs.push(s === 120 ? net(s * 1000, 150, 60, 14) : x);
      }
      return xs;
    }],
  ];

  for (const [name, sd, build] of cases) {
    it(name, () => {
      seed = sd;
      const { farthestDrawn } = run(build());
      expect(farthestDrawn).toBeLessThanOrEqual(25);
    });
  }
});

describe("a walker is still drawn faithfully", () => {
  it("W: 1.4 m/s for 300 s, a 40 s tunnel and one network outlier: length within 10% of the truth, a short tail", () => {
    seed = 31;
    const xs: Fix[] = [];
    for (let s = 0; s < T; s++) {
      if (s >= 150 && s < 190) continue;
      const acc = 8 + rnd() * 6;
      xs.push(s === 100
        ? net(s * 1000, 140 + s * 1.4, 90, 30)
        : { c: at(s * 1.4 + gauss() * 2, gauss() * 2), t: s * 1000, acc, kind: "gps", v: 1.4 + gauss() * 0.1 });
    }
    const { length, maxTail } = run(xs);
    const truth = 420;
    expect(Math.abs(length - truth) / truth).toBeLessThan(0.1);
    expect(maxTail).toBeLessThanOrEqual(30);
  });
});
