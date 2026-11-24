import { DEVIATION_SUSTAIN_MS } from "@/lib/walk/deviation-monitor";

/** A fix worse than this changes nothing (same limit the engine uses). */
const MAX_ACCURACY_M = 50;
/** Good on-route fixes needed, besides the 30 s, to call it a real rejoin. */
const REJOIN_MIN_FIXES = 3;
/** Strayed this much further than at the tap (or twice the fix error, if larger) means the answer no longer holds. */
const FURTHER_OFF_M = 150;
/** The answer "all OK, continue" is forgotten after this long. */
export const DISMISSAL_MAX_MS = 15 * 60_000;

/**
 * "All OK, continue" on the off-route card. It lifts only when the walker is really back on the route for a
 * while, strays clearly further, or enough time passes — never because one jittery fix landed on the line.
 * Times are fix timestamps, never the wall clock.
 */
export class OffRouteDismissal {
  private state: { atMs: number; deviationM: number; onRouteSinceMs: number | null; onRouteFixes: number } | null = null;
  private lastMs = 0;

  dismiss(args: { atMs: number; deviationM: number }): void {
    this.lastMs = args.atMs;
    this.state = { atMs: args.atMs, deviationM: args.deviationM, onRouteSinceMs: null, onRouteFixes: 0 };
  }

  clear(): void {
    this.state = null;
  }

  feed(f: { atMs: number; offRoute: boolean; deviationM: number; accuracyM: number }): void {
    this.lastMs = f.atMs;
    const s = this.state;
    if (!s) return;
    if (f.atMs - s.atMs >= DISMISSAL_MAX_MS) return this.clear();
    if (f.accuracyM > MAX_ACCURACY_M) return;
    if (f.offRoute) {
      s.onRouteSinceMs = null;
      s.onRouteFixes = 0;
      if (f.deviationM > s.deviationM + Math.max(FURTHER_OFF_M, 2 * f.accuracyM)) this.clear();
      return;
    }
    s.onRouteSinceMs ??= f.atMs;
    s.onRouteFixes += 1;
    if (f.atMs - s.onRouteSinceMs >= DEVIATION_SUSTAIN_MS && s.onRouteFixes >= REJOIN_MIN_FIXES) this.clear();
  }

  /** Still dismissed? `atMs` defaults to the newest fix time seen. */
  active(atMs: number = this.lastMs): boolean {
    const s = this.state;
    if (!s) return false;
    if (atMs - s.atMs >= DISMISSAL_MAX_MS) {
      this.state = null;
      return false;
    }
    return true;
  }
}
