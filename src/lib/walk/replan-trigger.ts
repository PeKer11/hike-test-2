import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

export type ReplanReason =
  | "full-stop"
  | "sustained-slow-pace"
  | "sustained-fast-pace";

/**
 * Which way the walker's pace drifted. The two are settable independently
 * (`WalkSettings.fastPaceMode` / `slowPaceMode`) because they are different
 * situations: falling behind is a problem, being ahead is spare time.
 *
 * A full stop counts as slow. It is the extreme end of the same complaint —
 * the walk no longer fits the time — and nobody would expect "rebuild when I
 * fall behind" to leave a walker who has stopped altogether unhandled.
 */
export type PaceDirection = "slow" | "fast";

export function replanPaceDirection(reason: ReplanReason): PaceDirection {
  return reason === "sustained-fast-pace" ? "fast" : "slow";
}

export interface ReplanSample {
  coordinates: Coordinates;
  timestamp: number; // ms since epoch
}

// A walker who has not left a ~20m circle for the last 4 minutes has stopped —
// short pauses (traffic light, tying a shoe) never cover the whole window.
export const FULL_STOP_WINDOW_MS = 4 * 60_000;
export const FULL_STOP_DISPLACEMENT_METERS = 20;
// Rolling window for the average-pace check. One slow GPS tick means nothing;
// 15 minutes of being slow means the plan no longer fits the time budget.
export const SUSTAINED_SLOW_WINDOW_MS = 15 * 60_000;
export const SLOW_PACE_RATIO = 1.3;
/**
 * The mirror of `SLOW_PACE_RATIO` on the other side: a walker averaging under
 * 77% of the planned minutes per kilometre is comfortably ahead, not just
 * having a good stretch. Not the exact reciprocal of 1.3 (0.769) — the round
 * number is honest about the precision a GPS-derived pace actually has, and
 * the two ratios are separately tunable anyway.
 */
export const FAST_PACE_RATIO = 0.77;
// After a replan the walker gets a fresh route and fresh windows. 12 minutes is
// short enough to catch a second genuine slowdown on a long walk, and long
// enough that the 15-minute rolling window has mostly refilled with samples
// from the new route before it can fire again.
export const REPLAN_COOLDOWN_MS = 12 * 60_000;

// A window that is only partly filled with samples can't prove "sustained".
const MIN_WINDOW_COVERAGE = 0.9;
const MIN_SAMPLES_FOR_FULL_STOP = 3;
const MIN_SAMPLES_FOR_SLOW_PACE = 5;
// Below this the pace ratio is GPS noise, not a pace — the full-stop check owns that case.
const MIN_DISTANCE_FOR_PACE_METERS = 10;

/**
 * Decides when an automatic re-plan is warranted, from the GPS sample stream.
 *
 * Two independent triggers, both requiring a sustained condition rather than a
 * single tick, and a shared cooldown so one slow walker can't loop the rebuild
 * (Overpass + ORS) endlessly. Unlike a one-shot latch, several re-plans over a
 * long walk are possible as long as each is separated by the cooldown.
 */
export class ReplanTrigger {
  private readonly plannedPaceMinPerKm: number;
  private samples: ReplanSample[] = [];
  private cooldownUntil = 0;

  constructor(plannedPaceMinPerKm: number) {
    this.plannedPaceMinPerKm = plannedPaceMinPerKm;
  }

  recordSample(sample: ReplanSample): void {
    this.samples.push(sample);
    this.pruneOlderThan(sample.timestamp - SUSTAINED_SLOW_WINDOW_MS);
  }

  /**
   * Returns the reason a re-plan should fire now, or null. Firing arms the
   * cooldown and drops the collected samples, so the next evaluation starts
   * from the walker's behaviour on the new route.
   */
  evaluate(now: number): ReplanReason | null {
    if (now < this.cooldownUntil) return null;

    this.pruneOlderThan(now - SUSTAINED_SLOW_WINDOW_MS);

    // Order matters only in that the slow side is checked first: a walker
    // cannot be both, and the slow reasons are the ones with a deadline
    // attached, so they are the ones worth naming when anything is ambiguous.
    const reason: ReplanReason | null = this.hasFullyStopped(now)
      ? "full-stop"
      : this.isSustainedSlow(now)
        ? "sustained-slow-pace"
        : this.isSustainedFast(now)
          ? "sustained-fast-pace"
          : null;

    if (reason !== null) {
      this.cooldownUntil = now + REPLAN_COOLDOWN_MS;
      this.samples = [];
    }

    return reason;
  }

  /** Clears samples and cooldown — call when a new walk starts. */
  reset(): void {
    this.samples = [];
    this.cooldownUntil = 0;
  }

  private pruneOlderThan(cutoff: number): void {
    this.samples = this.samples.filter((s) => s.timestamp >= cutoff);
  }

  private windowSamples(now: number, windowMs: number): ReplanSample[] {
    return this.samples.filter((s) => s.timestamp >= now - windowMs);
  }

  private coversWindow(window: ReplanSample[], now: number, windowMs: number): boolean {
    const first = window[0];
    if (!first) return false;
    return now - first.timestamp >= windowMs * MIN_WINDOW_COVERAGE;
  }

  private hasFullyStopped(now: number): boolean {
    const window = this.windowSamples(now, FULL_STOP_WINDOW_MS);
    if (window.length < MIN_SAMPLES_FOR_FULL_STOP) return false;
    if (!this.coversWindow(window, now, FULL_STOP_WINDOW_MS)) return false;

    // Max displacement from the oldest sample in the window — not just the last
    // one — so a walker who leaves and comes back is not read as stopped.
    const anchor = window[0].coordinates;
    return window.every(
      (s) => haversineDistance(anchor, s.coordinates) <= FULL_STOP_DISPLACEMENT_METERS,
    );
  }

  private isSustainedSlow(now: number): boolean {
    const window = this.windowSamples(now, SUSTAINED_SLOW_WINDOW_MS);
    if (window.length < MIN_SAMPLES_FOR_SLOW_PACE) return false;
    if (!this.coversWindow(window, now, SUSTAINED_SLOW_WINDOW_MS)) return false;

    // Sum consecutive hops: a straight line from first to last under-counts
    // every turn and makes the walker look slower than they are.
    let distMeters = 0;
    for (let i = 1; i < window.length; i += 1) {
      distMeters += haversineDistance(window[i - 1].coordinates, window[i].coordinates);
    }
    if (distMeters < MIN_DISTANCE_FOR_PACE_METERS) return false;

    const durationMs = window[window.length - 1].timestamp - window[0].timestamp;
    if (durationMs <= 0) return false;

    const paceMinPerKm = durationMs / 60_000 / (distMeters / 1000);
    return paceMinPerKm > this.plannedPaceMinPerKm * SLOW_PACE_RATIO;
  }

  /**
   * The same measurement as `isSustainedSlow`, compared the other way. Shares
   * its window, sample minimum and coverage rule deliberately: being ahead of
   * plan for one downhill stretch is no more a pace than being behind for one
   * uphill one, and a lower bar on this side would make the app chattier in
   * exactly the situation the walker is least likely to want interrupting.
   */
  private isSustainedFast(now: number): boolean {
    const window = this.windowSamples(now, SUSTAINED_SLOW_WINDOW_MS);
    if (window.length < MIN_SAMPLES_FOR_SLOW_PACE) return false;
    if (!this.coversWindow(window, now, SUSTAINED_SLOW_WINDOW_MS)) return false;

    let distMeters = 0;
    for (let i = 1; i < window.length; i += 1) {
      distMeters += haversineDistance(window[i - 1].coordinates, window[i].coordinates);
    }
    if (distMeters < MIN_DISTANCE_FOR_PACE_METERS) return false;

    const durationMs = window[window.length - 1].timestamp - window[0].timestamp;
    if (durationMs <= 0) return false;

    const paceMinPerKm = durationMs / 60_000 / (distMeters / 1000);
    return paceMinPerKm < this.plannedPaceMinPerKm * FAST_PACE_RATIO;
  }
}
