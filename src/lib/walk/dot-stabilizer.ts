import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  DOT_ESCAPE_FIXES_NODOP,
  DOT_ESCAPE_FIXES_STOPPED,
  DOT_ESCAPE_MIN_M,
  DOT_ESCAPE_SPAN_NODOP_MS,
  DOT_ESCAPE_SPAN_STOPPED_MS,
  DOT_NODOP_RADIUS_CAP_M,
  DOT_RECENTRE_FIXES,
  DOT_RECENTRE_MAX_ACCURACY_M,
  DOT_RECENTRE_MIN_M,
  SPEED_LIVE_WINDOW_MS,
  SPEED_MOVE_ABOVE_MPS,
  SPEED_STOP_BELOW_MPS,
} from "@/lib/walk/walk-cadence";

/** Same windows as TrailFilter.stopped(): 3+ Doppler readings in 10 s under 0.35 m/s is a standing phone. */
const STOP_WINDOW_MS = 10_000;
const STOP_MIN_READINGS = 3;

export type DotState = "moving" | "unsure" | "stopped" | "nodoppler";
export type DotMode = "follow" | "hold" | "escape" | "recentre";

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

/**
 * Decides where the shown dot sits. Moving or unsure: it follows the raw fix as before. Standing (Doppler) or no
 * Doppler at all: it holds, and moves only on agreeing fixes beyond max(15 m, the fix's accuracy), the accuracy capped
 * at 25 m when there is no Doppler. Pure; time is the
 * fix timestamp.
 */
export class DotStabilizer {
  private shown: Coordinates | null = null;
  private dop: Array<{ t: number; v: number }> = [];
  private cand: DotFix[] = [];
  private good: Coordinates[] = [];
  private mode: DotMode = "follow";
  private lastState: DotState = "nodoppler";
  /** Counters for ?gpsdebug=1. */
  stats = { held: 0, escapes: 0, recentres: 0 };
  private readonly nodopRadiusCapM: number;

  constructor(opts: { nodopRadiusCapM?: number } = {}) {
    this.nodopRadiusCapM = opts.nodopRadiusCapM ?? DOT_NODOP_RADIUS_CAP_M;
  }

  reset(seed?: Coordinates): void {
    this.shown = seed ?? null;
    this.dop = [];
    this.cand = [];
    this.good = [];
    this.mode = "follow";
    this.lastState = "nodoppler";
    this.stats = { held: 0, escapes: 0, recentres: 0 };
  }

  get state(): DotState {
    return this.lastState;
  }
  get holding(): boolean {
    return this.mode === "hold";
  }
  get escapeCandidates(): number {
    return this.cand.length;
  }
  get shownDot(): Coordinates | null {
    return this.shown;
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
    const st = this.stateAt(ts);
    this.lastState = st;
    if (hasSpeed && f.accuracyM <= DOT_RECENTRE_MAX_ACCURACY_M) this.good = [...this.good, f.coordinates].slice(-DOT_RECENTRE_FIXES);

    if (!this.shown || st === "moving" || st === "unsure") {
      this.mode = "follow";
      this.cand = [];
      this.shown = f.coordinates;
      return { publish: true, coordinates: f.coordinates, mode: "follow", state: st };
    }

    if (this.mode !== "hold") {
      this.mode = "hold";
      this.good = this.good.slice(-1);
    }
    // Doppler-stopped: the whole accuracy. No usable Doppler: capped, since network accuracy is bias, not scatter.
    const radius = st === "stopped" ? Math.max(DOT_ESCAPE_MIN_M, f.accuracyM) : Math.max(DOT_ESCAPE_MIN_M, Math.min(f.accuracyM, this.nodopRadiusCapM));
    // The GPS says standing: a Wi-Fi fix (no speed) cannot overrule it.
    const noSpeedWhileStopped = st === "stopped" && !hasSpeed;
    if (!noSpeedWhileStopped && haversineDistance(this.shown, f.coordinates) > radius) {
      const last = this.cand[this.cand.length - 1];
      if (last && haversineDistance(last.coordinates, f.coordinates) > radius) this.cand = [];
      this.cand.push(f);
      const [need, span] = st === "stopped" ? [DOT_ESCAPE_FIXES_STOPPED, DOT_ESCAPE_SPAN_STOPPED_MS] : [DOT_ESCAPE_FIXES_NODOP, DOT_ESCAPE_SPAN_NODOP_MS];
      if (this.cand.length >= need && ts - this.cand[0].timestamp >= span) {
        this.shown = mean(this.cand.map((c) => c.coordinates));
        this.cand = [];
        this.stats.escapes += 1;
        return { publish: true, coordinates: this.shown, mode: "escape", state: st };
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
