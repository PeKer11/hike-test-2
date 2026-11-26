import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  DOT_ESCAPE_FIXES_NODOP,
  DOT_ESCAPE_FIXES_STOPPED,
  DOT_ESCAPE_MIN_M,
  DOT_ESCAPE_SPAN_NODOP_MS,
  DOT_ESCAPE_SPAN_STOPPED_MS,
  DOT_NODOP_RADIUS_CAP_M,
  DOT_PROGRESS_MIN_M,
  DOT_PROGRESS_MIN_MPS,
  DOT_RECENTRE_FIXES,
  DOT_RECENTRE_MAX_ACCURACY_M,
  DOT_RECENTRE_MIN_M,
  DOT_TREND_MAX_TURN_DEG,
  DOT_TREND_PAIR_MS,
  DOT_TREND_STALL_M,
  DOT_TREND_STALL_MS,
  SPEED_LIVE_WINDOW_MS,
  SPEED_MOVE_ABOVE_MPS,
  SPEED_STOP_BELOW_MPS,
} from "@/lib/walk/walk-cadence";

/** Same windows as TrailFilter.stopped(): 3+ Doppler readings in 10 s under 0.35 m/s is a standing phone. */
const STOP_WINDOW_MS = 10_000;
const STOP_MIN_READINGS = 3;

export type DotState = "moving" | "unsure" | "stopped" | "nodoppler";
export type DotMode = "follow" | "hold" | "escape" | "recentre" | "trend";

export interface DotFix {
  coordinates: Coordinates;
  accuracyM: number;
  speedMps?: number | null;
  timestamp: number;
}

export interface DotDecision {
  /** True when the shown dot should move to `coordinates`; false means nothing is published at all. */
  publish: boolean;
  coordinates: Coordinates;
  mode: DotMode;
  state: DotState;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (pts: Coordinates[]): Coordinates => ({
  lat: pts.reduce((s, c) => s + c.lat, 0) / pts.length,
  lng: pts.reduce((s, c) => s + c.lng, 0) / pts.length,
});
/** Local metres from a to b (x east, y north). */
const offset = (a: Coordinates, b: Coordinates) => ({
  x: (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180),
  y: (b.lat - a.lat) * 111320,
});
/** Positions kept for the progress check. */
const HIST_MS = 40_000;
/** "Now" is the mean of the fixes in the last 5 s; "then" the mean of those DOT_TREND_STALL_MS +- 5 s ago. */
const NOW_WINDOW_MS = 5_000;

/**
 * Decides where the shown dot sits. Moving or unsure: it follows the raw fix as before. Standing (Doppler) or no
 * Doppler at all: it holds, and moves only on agreeing fixes beyond max(15 m, the fix's accuracy), the accuracy capped
 * at 25 m when there is no Doppler. Escapes that keep going the same way switch to trend follow (every fix) until the
 * fixes make no progress for about 20 s. Pure; time is the fix timestamp.
 */
export class DotStabilizer {
  private shown: Coordinates | null = null;
  private dop: Array<{ t: number; v: number }> = [];
  private cand: DotFix[] = [];
  private good: Coordinates[] = [];
  private mode: DotMode = "follow";
  private lastState: DotState = "nodoppler";
  private hist: Array<{ t: number; c: Coordinates }> = [];
  private lastEscape: { t: number; x: number; y: number } | null = null;
  private trend = false;
  /** Counters for ?gpsdebug=1. */
  stats = { held: 0, escapes: 0, recentres: 0, trends: 0 };

  reset(seed?: Coordinates): void {
    this.shown = seed ?? null;
    this.dop = [];
    this.cand = [];
    this.good = [];
    this.mode = "follow";
    this.lastState = "nodoppler";
    this.hist = [];
    this.lastEscape = null;
    this.trend = false;
    this.stats = { held: 0, escapes: 0, recentres: 0, trends: 0 };
  }

  get state(): DotState {
    return this.lastState;
  }
  get holding(): boolean {
    return this.mode === "hold";
  }
  /** Following positions with no usable Doppler because the fixes keep advancing. */
  get trending(): boolean {
    return this.trend;
  }
  get escapeCandidates(): number {
    return this.cand.length;
  }
  get shownDot(): Coordinates | null {
    return this.shown;
  }

  /** How far the fixes moved between "then" (about 20 s ago) and "now", and over how many seconds. */
  private progress(ts: number): { m: number; dtS: number } | null {
    const now = this.hist.filter((h) => ts - h.t <= NOW_WINDOW_MS);
    const then = this.hist.filter((h) => Math.abs(ts - h.t - DOT_TREND_STALL_MS) <= NOW_WINDOW_MS);
    if (!now.length || !then.length) return null;
    const meanT = (v: typeof now) => v.reduce((s, h) => s + h.t, 0) / v.length;
    return {
      m: haversineDistance(mean(then.map((h) => h.c)), mean(now.map((h) => h.c))),
      dtS: Math.max(1, (meanT(now) - meanT(then)) / 1000),
    };
  }

  private stateAt(ts: number): DotState {
    this.dop = this.dop.filter((d) => ts - d.t <= STOP_WINDOW_MS);
    const recent = this.dop.filter((d) => ts - d.t <= SPEED_LIVE_WINDOW_MS).map((d) => d.v);
    if (recent.length && median(recent) >= SPEED_MOVE_ABOVE_MPS) return "moving";
    if (this.dop.length >= STOP_MIN_READINGS && median(this.dop.map((d) => d.v)) < SPEED_STOP_BELOW_MPS) return "stopped";
    if (this.dop.length === 0) return "nodoppler";
    return "unsure";
  }

  push(f: DotFix): DotDecision {
    const ts = f.timestamp;
    const hasSpeed = typeof f.speedMps === "number" && Number.isFinite(f.speedMps);
    if (hasSpeed) this.dop.push({ t: ts, v: f.speedMps as number });
    this.hist = [...this.hist.filter((h) => ts - h.t <= HIST_MS), { t: ts, c: f.coordinates }];
    const st = this.stateAt(ts);
    this.lastState = st;
    if (hasSpeed && f.accuracyM <= DOT_RECENTRE_MAX_ACCURACY_M) this.good = [...this.good, f.coordinates].slice(-DOT_RECENTRE_FIXES);

    if (!this.shown || st === "moving" || st === "unsure") {
      this.mode = "follow";
      this.cand = [];
      this.trend = false;
      this.lastEscape = null;
      this.shown = f.coordinates;
      return { publish: true, coordinates: f.coordinates, mode: "follow", state: st };
    }

    // Trend: no usable Doppler, the fixes keep advancing. Follow every fix until they make no progress for ~20 s.
    if (this.trend && st !== "stopped") {
      const p = this.progress(ts);
      if (p && p.m < DOT_TREND_STALL_M) {
        this.trend = false;
        this.lastEscape = null;
        this.cand = [];
        this.mode = "hold";
        this.shown = mean(this.hist.filter((h) => ts - h.t <= NOW_WINDOW_MS).map((h) => h.c));
        return { publish: true, coordinates: this.shown, mode: "recentre", state: st };
      }
      this.mode = "trend";
      this.shown = f.coordinates;
      return { publish: true, coordinates: f.coordinates, mode: "trend", state: st };
    }
    this.trend = false;

    if (this.mode !== "hold") {
      this.mode = "hold";
      this.good = this.good.slice(-1);
    }
    // Doppler-stopped: the whole accuracy. No usable Doppler: capped, since network accuracy is bias, not scatter.
    const radius = st === "stopped" ? Math.max(DOT_ESCAPE_MIN_M, f.accuracyM) : Math.max(DOT_ESCAPE_MIN_M, Math.min(f.accuracyM, DOT_NODOP_RADIUS_CAP_M));
    // The GPS says standing: a Wi-Fi fix (no speed) cannot overrule it.
    const noSpeedWhileStopped = st === "stopped" && !hasSpeed;
    if (!noSpeedWhileStopped && haversineDistance(this.shown, f.coordinates) > radius) {
      const last = this.cand[this.cand.length - 1];
      if (last && haversineDistance(last.coordinates, f.coordinates) > radius) this.cand = [];
      this.cand.push(f);
      const [need, span] = st === "stopped" ? [DOT_ESCAPE_FIXES_STOPPED, DOT_ESCAPE_SPAN_STOPPED_MS] : [DOT_ESCAPE_FIXES_NODOP, DOT_ESCAPE_SPAN_NODOP_MS];
      if (this.cand.length >= need && ts - this.cand[0].timestamp >= span) {
        const to = mean(this.cand.map((c) => c.coordinates));
        const dir = offset(this.shown, to);
        const len = Math.hypot(dir.x, dir.y) || 1;
        // The candidates themselves advance along the escape: walking, whatever Doppler says.
        const p0 = offset(this.shown, this.cand[0].coordinates);
        const p1 = offset(this.shown, this.cand[this.cand.length - 1].coordinates);
        const along = ((p1.x - p0.x) * dir.x + (p1.y - p0.y) * dir.y) / len;
        const spanS = (ts - this.cand[0].timestamp) / 1000;
        const advancing = this.cand.length >= 3 && along >= Math.max(DOT_PROGRESS_MIN_M, DOT_PROGRESS_MIN_MPS * spanS);
        // A second escape about the same way within 60 s: walking.
        const pe = this.lastEscape;
        const consistent =
          !!pe &&
          ts - pe.t <= DOT_TREND_PAIR_MS &&
          (pe.x * dir.x + pe.y * dir.y) / ((Math.hypot(pe.x, pe.y) || 1) * len) >= Math.cos((DOT_TREND_MAX_TURN_DEG * Math.PI) / 180);
        this.lastEscape = { t: ts, x: dir.x, y: dir.y };
        this.cand = [];
        this.stats.escapes += 1;
        if (advancing || consistent) {
          this.trend = true;
          this.stats.trends += 1;
          this.mode = "trend";
          this.shown = f.coordinates;
          return { publish: true, coordinates: f.coordinates, mode: "trend", state: st };
        }
        this.shown = to;
        return { publish: true, coordinates: to, mode: "escape", state: st };
      }
    } else if (!noSpeedWhileStopped) {
      this.cand = [];
    }

    if (st === "stopped" && this.good.length >= DOT_RECENTRE_FIXES) {
      const m = mean(this.good);
      if (haversineDistance(m, this.shown) > DOT_RECENTRE_MIN_M) {
        this.shown = m;
        this.good = [];
        this.stats.recentres += 1;
        return { publish: true, coordinates: m, mode: "recentre", state: st };
      }
    }
    this.stats.held += 1;
    return { publish: false, coordinates: this.shown, mode: "hold", state: st };
  }
}
