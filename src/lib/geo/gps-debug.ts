/**
 * On-phone GPS counters for diagnosing a walk whose dot does not move. Pure: no React, no network.
 * Always counting (a few integer increments per fix); shown only with `?gpsdebug=1` (see GpsDebugLine).
 */

import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

export type GpsFixKind = "watch" | "quick" | "rearm";

export interface GpsDebugSnapshot {
  received: number;
  receivedWatch: number;
  receivedQuick: number;
  receivedRearm: number;
  /** Dropped by locate()'s out-of-order timestamp guard. */
  droppedOrder: number;
  /** `lastWalkFixTs - fix.timestamp` of the last such drop, ms. */
  lastDeltaMs: number | null;
  /** Dropped by the tracker's accuracy gate (over DOT_MAX_ACCURACY_M). */
  droppedTracker: number;
  /** Fixes handed to the map. */
  published: number;
  lastAccuracyM: number | null;
  /** `Date.now() - fix.timestamp` of the last fix, ms. */
  lastAgeMs: number | null;
  /** Fixes that carried a device (Doppler) speed. */
  withSpeed: number;
  /** `coords.speed` of the last fix, m/s (null when the device sent none). */
  lastSpeedMps: number | null;
  errors: number;
  lastError: string | null;
  /** Dot stabilizer: moving / unsure / stopped / nodoppler (null before the first fix). */
  dotState: "moving" | "unsure" | "stopped" | "nodoppler" | null;
  dotHolding: boolean;
  /** Fixes the stabilizer did not show. */
  dotHeld: number;
  dotEscapes: number;
  dotRecentres: number;
  /** Path the shown dot walked over the last 60 s of fixes, m. */
  dotPath60M: number;
  /** Distance between the raw fix and the shown dot, m. */
  rawToDotM: number | null;
  /** Over the last 30 watch fixes: gps = speed on >= 50% and accuracy median <= 25 m; net = speed on < 10% (or always
   * exactly 0) and accuracy median >= 30 m; else mix. Null before the first watch fix. */
  provider: "gps" | "net" | "mix" | null;
  /** Share of the last 30 watch fixes with no speed / speed exactly 0 / no heading, %. */
  speedNullPct: number | null;
  speedZeroPct: number | null;
  headingNullPct: number | null;
  /** Median interval between the last 30 watch fixes, s. */
  intervalMedS: number | null;
  /** Median accuracy of the last 30 watch fixes, m. */
  accMedM: number | null;
  /** Dot stabilizer: following positions in trend mode, Doppler trusted, contradictions so far. */
  dotTrend: boolean;
  dopplerTrusted: boolean;
  contradictions: number;
}

const EMPTY: GpsDebugSnapshot = {
  received: 0,
  receivedWatch: 0,
  receivedQuick: 0,
  receivedRearm: 0,
  droppedOrder: 0,
  lastDeltaMs: null,
  droppedTracker: 0,
  published: 0,
  lastAccuracyM: null,
  lastAgeMs: null,
  withSpeed: 0,
  lastSpeedMps: null,
  errors: 0,
  lastError: null,
  dotState: null,
  dotHolding: false,
  dotHeld: 0,
  dotEscapes: 0,
  dotRecentres: 0,
  dotPath60M: 0,
  rawToDotM: null,
  provider: null,
  speedNullPct: null,
  speedZeroPct: null,
  headingNullPct: null,
  intervalMedS: null,
  accMedM: null,
  dotTrend: false,
  dopplerTrusted: true,
  contradictions: 0,
};

const PATH_WINDOW_MS = 60_000;
const DEVICE_WINDOW_FIXES = 30;
let dotMoves: Array<{ t: number; m: number }> = [];
let lastShown: Coordinates | null = null;
let watchFixes: Array<{ t: number; acc: number; speed: number | null; heading: number | null }> = [];

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const pct = (n: number, of: number) => Math.round((100 * n) / of);

/** Provider guess and rates over the last 30 watch fixes. */
function deviceFields(): Pick<
  GpsDebugSnapshot,
  "provider" | "speedNullPct" | "speedZeroPct" | "headingNullPct" | "intervalMedS" | "accMedM"
> {
  const w = watchFixes;
  if (!w.length) return { provider: null, speedNullPct: null, speedZeroPct: null, headingNullPct: null, intervalMedS: null, accMedM: null };
  const withSpeed = w.filter((f) => f.speed !== null);
  const accMedM = median(w.map((f) => f.acc));
  const speedShare = withSpeed.length / w.length;
  const allZero = withSpeed.length > 0 && withSpeed.every((f) => f.speed === 0);
  const provider =
    speedShare >= 0.5 && accMedM <= 25 ? "gps" : (speedShare < 0.1 || allZero) && accMedM >= 30 ? "net" : "mix";
  const iv = w.slice(1).map((f, i) => (f.t - w[i].t) / 1000);
  return {
    provider,
    speedNullPct: pct(w.length - withSpeed.length, w.length),
    speedZeroPct: pct(withSpeed.filter((f) => f.speed === 0).length, w.length),
    headingNullPct: pct(w.filter((f) => f.heading === null).length, w.length),
    intervalMedS: iv.length ? median(iv) : null,
    accMedM,
  };
}

let state: GpsDebugSnapshot = { ...EMPTY };

export const gpsDebug = {
  reset(): void {
    state = { ...EMPTY };
    dotMoves = [];
    lastShown = null;
    watchFixes = [];
  },
  snapshot(): GpsDebugSnapshot {
    return { ...state };
  },
  received(kind: GpsFixKind, accuracyM: number, fixTimestamp: number, speedMps?: number | null, headingDeg?: number | null): void {
    state.received += 1;
    if (kind === "watch") state.receivedWatch += 1;
    else if (kind === "quick") state.receivedQuick += 1;
    else state.receivedRearm += 1;
    state.lastAccuracyM = accuracyM;
    state.lastAgeMs = Date.now() - fixTimestamp;
    const hasSpeed = typeof speedMps === "number" && Number.isFinite(speedMps);
    if (hasSpeed) state.withSpeed += 1;
    state.lastSpeedMps = hasSpeed ? (speedMps as number) : null;
    if (kind === "watch") {
      const heading = typeof headingDeg === "number" && Number.isFinite(headingDeg) ? headingDeg : null;
      watchFixes = [...watchFixes, { t: fixTimestamp, acc: accuracyM, speed: state.lastSpeedMps, heading }].slice(-DEVICE_WINDOW_FIXES);
      Object.assign(state, deviceFields());
    }
  },
  droppedOrder(deltaMs: number): void {
    state.droppedOrder += 1;
    state.lastDeltaMs = deltaMs;
  },
  droppedTracker(): void {
    state.droppedTracker += 1;
  },
  published(): void {
    state.published += 1;
  },
  /** One call per accepted fix: what the dot stabilizer decided. `timestamp` is the fix's. */
  dot(d: {
    state: NonNullable<GpsDebugSnapshot["dotState"]>;
    holding: boolean;
    held: number;
    escapes: number;
    recentres: number;
    raw: Coordinates;
    shown: Coordinates;
    timestamp: number;
    trend?: boolean;
    dopplerTrusted?: boolean;
    contradictions?: number;
  }): void {
    if (lastShown) {
      const m = haversineDistance(lastShown, d.shown);
      if (m > 0) dotMoves.push({ t: d.timestamp, m });
    }
    lastShown = d.shown;
    dotMoves = dotMoves.filter((x) => d.timestamp - x.t <= PATH_WINDOW_MS);
    state.dotState = d.state;
    state.dotHolding = d.holding;
    state.dotHeld = d.held;
    state.dotEscapes = d.escapes;
    state.dotRecentres = d.recentres;
    state.dotPath60M = dotMoves.reduce((s, x) => s + x.m, 0);
    state.rawToDotM = haversineDistance(d.raw, d.shown);
    state.dotTrend = d.trend ?? false;
    state.dopplerTrusted = d.dopplerTrusted ?? true;
    state.contradictions = d.contradictions ?? 0;
  },
  error(e: unknown): void {
    state.errors += 1;
    state.lastError = e instanceof Error ? e.message : String(e);
  },
};

let latched = false;
/** True when the page was opened with `?gpsdebug=1`; remembered for the session because in-app navigation drops the query. */
export function isGpsDebugOn(): boolean {
  if (latched) return true;
  try {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("gpsdebug") === "1") {
      latched = true;
      try {
        sessionStorage.setItem("traike.gpsdebug", "1");
      } catch {}
      return true;
    }
    if (sessionStorage.getItem("traike.gpsdebug") === "1") {
      latched = true;
      return true;
    }
  } catch {}
  return false;
}

/** One short monospace line for the overlay. */
export function formatGpsDebug(s: GpsDebugSnapshot, zoom: number | undefined, follow: boolean): string {
  const n = (v: number | null, d = 0) => (v === null ? "-" : v.toFixed(d));
  return [
    `rx ${s.received} (w${s.receivedWatch} q${s.receivedQuick} r${s.receivedRearm})`,
    `ord-drop ${s.droppedOrder} d${s.lastDeltaMs === null ? "-" : Math.round(s.lastDeltaMs / 100) / 10}s`,
    `trk-drop ${s.droppedTracker}`,
    `pub ${s.published}`,
    `acc ${n(s.lastAccuracyM)}m`,
    `age ${s.lastAgeMs === null ? "-" : Math.round(s.lastAgeMs / 100) / 10}s`,
    `dop ${n(s.lastSpeedMps, 1)}`,
    `st ${s.dotState === null ? "-" : s.dotState === "stopped" ? "stop" : s.dotState === "moving" ? "move" : s.dotState === "nodoppler" ? "nodop" : "unsure"}`,
    `hold ${s.dotHolding ? "y" : "n"}`,
    `held ${s.dotHeld}`,
    `esc ${s.dotEscapes}`,
    `rc ${s.dotRecentres}`,
    `d60 ${Math.round(s.dotPath60M)}m`,
    `raw>dot ${s.rawToDotM === null ? "-" : Math.round(s.rawToDotM) + "m"}`,
    `dop% ${s.received === 0 ? "-" : Math.round((100 * s.withSpeed) / s.received)}`,
    `prov ${s.provider ?? "-"}`,
    `spd∅ ${s.speedNullPct === null ? "-" : s.speedNullPct + "%"}`,
    `spd0 ${s.speedZeroPct === null ? "-" : s.speedZeroPct + "%"}`,
    `hdg∅ ${s.headingNullPct === null ? "-" : s.headingNullPct + "%"}`,
    `iv ${s.intervalMedS === null ? "-" : Math.round(s.intervalMedS * 10) / 10 + "s"}`,
    `accMed ${s.accMedM === null ? "-" : Math.round(s.accMedM) + "m"}`,
    `trend ${s.dotTrend ? "y" : "n"}`,
    `dopT ${s.dopplerTrusted ? "y" : "n"}`,
    `contra ${s.contradictions}`,
    `err ${s.errors}`,
    `z ${zoom === undefined ? "-" : Math.round(zoom * 10) / 10}`,
    `follow ${follow ? "on" : "off"}`,
  ].join(" | ");
}
