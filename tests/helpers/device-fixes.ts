// Device fix generators for the movement bars (docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md section 2).
// Local metres (x east, y north) around Tel Aviv. Deterministic per seed.
import { haversineDistance } from "@/lib/utils/geo";
import type { Coordinates } from "@/lib/types";

export const LAT0 = 32.0853;
export const LNG0 = 34.7818;
export const T0 = 1_700_000_000_000;
const COS = Math.cos((LAT0 * Math.PI) / 180);
export const toLL = (x: number, y: number): Coordinates => ({ lat: LAT0 + y / 111320, lng: LNG0 + x / (111320 * COS) });
export const toXY = (c: Coordinates) => ({ x: (c.lng - LNG0) * 111320 * COS, y: (c.lat - LAT0) * 111320 });

export function rng(seed: number) {
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

/** Correlated drift (AR(1)), like a standing GPS. */
export function ar(r: ReturnType<typeof rng>, sigma: number, tauS: number) {
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

export interface Fix { t: number; x: number; y: number; acc: number; speed?: number; truthY: number }

export const STAND_S = 20;
export const WALK_S = 180;
export const V = 1.4;
export const TOTAL_S = STAND_S + WALK_S;
const truthY = (s: number, walking: boolean) => (!walking || s < STAND_S ? 0 : (s - STAND_S) * V);

/** Tab S6 network-only: weighted centroid of the 3 nearest access points, 2-10 s apart, accuracy 30-150 m stepwise. */
export function genWifi(seed: number, walking: boolean, speedZero = false): Fix[] {
  const r = rng(seed);
  const aps: Array<{ x: number; y: number }> = [];
  for (let y = -80; y < 480; y += 20 + r.u() * 20) aps.push({ x: (r.u() * 2 - 1) * 35, y: y + (r.u() * 2 - 1) * 8 });
  const levels = [30, 40, 60, 90, 150];
  let li = 2;
  const out: Fix[] = [];
  let s = 0;
  while (s < TOTAL_S) {
    const ty = truthY(s, walking);
    const near = [...aps].sort((a, b) => Math.hypot(a.x, a.y - ty) - Math.hypot(b.x, b.y - ty)).slice(0, 3);
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (const ap of near) {
      const w = 1 / (Math.hypot(ap.x, ap.y - ty) ** 2 + 100);
      wx += w * ap.x;
      wy += w * ap.y;
      ws += w;
    }
    if (r.u() < 0.3) li = Math.max(0, Math.min(levels.length - 1, li + (r.u() < 0.5 ? -1 : 1)));
    out.push({ t: T0 + Math.round(s * 1000), x: wx / ws + r.n() * 4, y: wy / ws + r.n() * 4, acc: levels[li], speed: speedZero ? 0 : undefined, truthY: ty });
    s += 2 + r.u() * 8;
  }
  return out;
}

export type SpeedMode = "true" | "mixed" | "zero" | "null" | "urban";
/** GPS-class device: correlated drift, interval jitter, a Doppler policy. */
export function genGps(
  seed: number,
  walking: boolean,
  o: { accLo: number; accHi: number; sigma: number; tau: number; ivLo: number; ivHi: number; speed: SpeedMode },
): Fix[] {
  const r = rng(seed);
  const e = ar(r, o.sigma, o.tau);
  let acc = (o.accLo + o.accHi) / 2;
  const out: Fix[] = [];
  let next = 0;
  for (let s = 0; s < TOTAL_S; s++) {
    const n = e();
    acc = Math.max(o.accLo, Math.min(o.accHi, acc + r.n() * 1.5));
    if (s < next) continue;
    next = s + o.ivLo + Math.floor(r.u() * (o.ivHi - o.ivLo + 1));
    const ty = truthY(s, walking);
    const moving = walking && s >= STAND_S;
    const real = moving ? Math.max(0, V + r.n() * 0.15) : Math.abs(r.n()) * 0.08;
    let speed: number | undefined;
    const u = r.u();
    if (o.speed === "true") speed = real;
    else if (o.speed === "mixed") speed = u < 0.55 ? real : u < 0.8 ? undefined : 0;
    else if (o.speed === "zero") speed = 0;
    else if (o.speed === "null") speed = undefined;
    else speed = u < 0.7 ? (moving ? Math.max(0, V + r.n() * 0.3) : Math.abs(r.n()) * 0.15) : undefined;
    out.push({ t: T0 + s * 1000, x: n.x + r.n(), y: ty + n.y + r.n(), acc, speed, truthY: ty });
  }
  return out;
}

export type DeviceId = "A" | "A0" | "B1" | "B2" | "B3" | "B4" | "C1" | "C2";
export const DEVICES: Record<DeviceId, (seed: number, walking: boolean) => Fix[]> = {
  A: (s, w) => genWifi(s, w),
  A0: (s, w) => genWifi(s, w, true),
  B1: (s, w) => genGps(s, w, { accLo: 5, accHi: 12, sigma: 3, tau: 15, ivLo: 1, ivHi: 1, speed: "true" }),
  B2: (s, w) => genGps(s, w, { accLo: 8, accHi: 25, sigma: 5, tau: 15, ivLo: 1, ivHi: 1, speed: "mixed" }),
  B3: (s, w) => genGps(s, w, { accLo: 8, accHi: 25, sigma: 5, tau: 15, ivLo: 1, ivHi: 1, speed: "zero" }),
  B4: (s, w) => genGps(s, w, { accLo: 8, accHi: 25, sigma: 5, tau: 15, ivLo: 1, ivHi: 1, speed: "null" }),
  C1: (s, w) => genGps(s, w, { accLo: 25, accHi: 60, sigma: 10, tau: 30, ivLo: 1, ivHi: 3, speed: "urban" }),
  C2: (s, w) => genGps(s, w, { accLo: 25, accHi: 60, sigma: 10, tau: 30, ivLo: 1, ivHi: 3, speed: "null" }),
};

/** Anything with the DotStabilizer push() shape. */
export interface DotLike {
  push(f: { coordinates: Coordinates; accuracyM: number; speedMps?: number | null; timestamp: number }): { publish: boolean; coordinates: Coordinates };
}

export interface DotSample { s: number; dot: Coordinates; truthY: number }

/** Feeds the fixes in time order and samples the shown dot once a second. */
export function replayDots(fixes: Fix[], st: DotLike): DotSample[] {
  const out: DotSample[] = [];
  let dot: Coordinates | null = null;
  let fi = 0;
  const end = Math.ceil((fixes[fixes.length - 1].t - T0) / 1000);
  for (let s = 0; s <= end; s++) {
    const now = T0 + s * 1000;
    while (fi < fixes.length && fixes[fi].t <= now) {
      const f = fixes[fi++];
      const d = st.push({ coordinates: toLL(f.x, f.y), accuracyM: f.acc, speedMps: f.speed, timestamp: f.t });
      if (d.publish) dot = d.coordinates;
    }
    if (dot) out.push({ s, dot, truthY: fixes[Math.max(0, fi - 1)].truthY });
  }
  return out;
}

/** Walking metrics: first move (10 m along the walk), lag p50/p90 from 30 s into the walk, longest frozen run. */
export function walkMetrics(dots: DotSample[]) {
  const base = toXY(dots.find((d) => d.s >= STAND_S)!.dot);
  const first = dots.find((d) => d.s >= STAND_S && toXY(d.dot).y - base.y >= 10);
  const lags = dots
    .filter((d) => d.s >= STAND_S + 30)
    .map((d) => Math.abs((d.s - STAND_S) * V - toXY(d.dot).y))
    .sort((a, b) => a - b);
  let still = 0;
  let worst = 0;
  const w = dots.filter((d) => d.s > STAND_S + 5);
  for (let i = 1; i < w.length; i++) {
    const same = w[i].dot.lat === w[i - 1].dot.lat && w[i].dot.lng === w[i - 1].dot.lng;
    still = same ? still + 1 : 0;
    worst = Math.max(worst, still);
  }
  return {
    firstMoveS: first ? first.s - STAND_S : Number.POSITIVE_INFINITY,
    lagP50: lags[Math.floor(lags.length / 2)],
    lagP90: lags[Math.floor(lags.length * 0.9)],
    longestFreezeS: worst,
  };
}

/** Standing metric: dot path length per minute from 30 s on. */
export function pathPerMin(dots: DotSample[], from = 30): number {
  const w = dots.filter((d) => d.s >= from);
  let p = 0;
  for (let i = 1; i < w.length; i++) p += haversineDistance(w[i - 1].dot, w[i].dot);
  return p / ((w[w.length - 1].s - w[0].s) / 60);
}

/** Signed progress of the dot along the walk (metres north). */
export const alongY = (c: Coordinates) => toXY(c).y;

// --- Fast-start fixtures (docs/LIVE-DEVICE-FOLLOWUP-PLAN-2026-11-26.md, section (d) commit 1) ---

export type StillSpeed = "zero" | "null" | "true";
export type StillNoise = { kind: "uniform"; a: number } | { kind: "ar"; sigma: number; tau: number; white: number };
export interface StillOpts {
  standS: number;
  walkS: number;
  v?: number;
  acc: [number, number];
  noise: StillNoise;
  speedStand: StillSpeed;
  speedWalk: StillSpeed;
  /** Scales the standing noise (a phone lying still is quieter than one in a hand). */
  standScale?: number;
}

/** 1 Hz fixes: stand `standS` s at (0,0), then walk north at `v` m/s for `walkS` s. Deterministic per seed. */
export function genStill(seed: number, o: StillOpts): Fix[] {
  const r = rng(seed);
  const v = o.v ?? V;
  const e = o.noise.kind === "ar" ? ar(r, o.noise.sigma, o.noise.tau) : null;
  const out: Fix[] = [];
  for (let s = 0; s < o.standS + o.walkS; s++) {
    const walking = s >= o.standS;
    const ty = walking ? (s - o.standS) * v : 0;
    let nx: number;
    let ny: number;
    if (o.noise.kind === "uniform") {
      nx = (r.u() * 2 - 1) * o.noise.a;
      ny = (r.u() * 2 - 1) * o.noise.a;
    } else {
      const n = e!();
      nx = n.x + r.n() * o.noise.white;
      ny = n.y + r.n() * o.noise.white;
    }
    if (!walking && o.standScale !== undefined) {
      nx *= o.standScale;
      ny *= o.standScale;
    }
    const mode = walking ? o.speedWalk : o.speedStand;
    const speed = mode === "zero" ? 0 : mode === "null" ? undefined : walking ? Math.max(0, v + r.n() * 0.15) : Math.abs(r.n()) * 0.08;
    out.push({ t: T0 + s * 1000, x: nx, y: ty + ny, acc: o.acc[0] + r.u() * (o.acc[1] - o.acc[0]), speed, truthY: ty });
  }
  return out;
}

export interface StillRow { s: number; dot: Coordinates; mode?: string; publish: boolean }

/** Feeds every fix and records the shown dot after each one (falls back to the raw fix before the first publish). */
export function replayStill(fixes: Fix[], st: { push: DotLike["push"] }): StillRow[] {
  let dot: Coordinates | null = null;
  return fixes.map((f) => {
    const raw = toLL(f.x, f.y);
    const d = st.push({ coordinates: raw, accuracyM: f.acc, speedMps: f.speed, timestamp: f.t }) as { publish: boolean; coordinates: Coordinates; mode?: string };
    if (d.publish) dot = d.coordinates;
    return { s: (f.t - T0) / 1000, dot: dot ?? raw, mode: d.mode, publish: d.publish };
  });
}

/** Walking after `standS`: first second the dot is >= 5 m along the walk; signed lag (truth - dot) at +10/+20 s. */
export function stillWalkMetrics(rows: StillRow[], standS: number, v = V) {
  const base = toXY(rows.find((r) => r.s >= standS)!.dot).y;
  const first = rows.find((r) => r.s >= standS && toXY(r.dot).y - base >= 5);
  const lagAt = (sec: number) => {
    const r = rows.find((x) => x.s === standS + sec);
    return r ? sec * v - toXY(r.dot).y : Number.NaN;
  };
  return { firstMoveS: first ? first.s - standS : Number.POSITIVE_INFINITY, lag10: lagAt(10), lag20: lagAt(20) };
}

/** Standing: the dot's path (m/min) and moves over 1 m per minute, from `from` s on. */
export function standMetrics(rows: StillRow[], from = 30) {
  const w = rows.filter((r) => r.s >= from);
  let p = 0;
  let moves = 0;
  for (let i = 1; i < w.length; i++) {
    const d = haversineDistance(w[i - 1].dot, w[i].dot);
    p += d;
    if (d > 1) moves += 1;
  }
  const mins = (w[w.length - 1].s - w[0].s) / 60;
  return { pathPerMin: p / mins, movesPerMin: moves / mins };
}
