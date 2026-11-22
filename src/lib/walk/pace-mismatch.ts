/**
 * "Planned at 2 km/h, walking 4.5": when is the plan's pace wrong enough to ask?
 *
 * A field walk planned at 2 km/h was walked at 4.5 km/h and nothing asked. The pace cards only
 * offer to add, lengthen or shorten; none of them re-bases the plan. This watches the live speed
 * (`SpeedEstimator`, already smoothed) against the plan's pace and, once the walker has been at
 * least `PACE_MISMATCH_RATIO` times faster for `PACE_MISMATCH_SUSTAIN_MS`, returns one offer.
 *
 * - 2x: a brisk-but-normal gap (4 vs 6 km/h) is the pace cards' business; 2 vs 4.5 is a wrong plan.
 * - 3 minutes: a quick start, a street crossing or a noisy fix must not ask.
 * - 1.5-10 km/h: below that is standing about, above it is a run or a bike, not a walking plan.
 * - Asked once: after the offer nothing more comes until it is answered. "Keep" stays quiet until
 *   the plan's pace changes (`setPlannedPace`); "Plan at it" is exactly that change.
 *
 * Time is the caller's fix clock, never `Date.now()`; a repeated or older timestamp says nothing new.
 */
export const PACE_MISMATCH_RATIO = 2;
export const PACE_MISMATCH_SUSTAIN_MS = 3 * 60_000;
export const PACE_MISMATCH_MIN_KMH = 1.5;
export const PACE_MISMATCH_MAX_KMH = 10;

export interface PaceMismatchOffer {
  /** Walking speed now, to the nearest 0.5 km/h. */
  measuredKmh: number;
  /** The plan's speed, km/h, to one decimal. */
  plannedKmh: number;
}

type Phase = "watching" | "offered" | "declined";

export class PaceMismatchWatcher {
  private phase: Phase = "watching";
  private since: number | null = null;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(private plannedPaceMinPerKm: number) {}

  /** The plan was re-timed (the walker accepted, or said "N km/h"): a new question is allowed. */
  setPlannedPace(minPerKm: number): void {
    if (!Number.isFinite(minPerKm) || minPerKm <= 0) return;
    this.plannedPaceMinPerKm = minPerKm;
    this.phase = "watching";
    this.since = null;
  }

  /** The walker chose to keep the plan's pace: stay quiet until it changes. */
  decline(): void {
    this.phase = "declined";
    this.since = null;
  }

  /** Feed one reading. Returns the offer exactly once, when the gap has been sustained. */
  update(sample: { kmh: number | null; moving: boolean; atMs: number }): PaceMismatchOffer | null {
    if (sample.atMs <= this.lastAt) return null;
    this.lastAt = sample.atMs;
    if (this.phase !== "watching") return null;
    // No rule for a gap in the looks: a dead GPS or a hidden page leaves the speed estimator
    // with no recent fix, it reports no speed, and that already breaks the run below. (A gap
    // rule would also break under the simulator, whose fix clock runs 10x between ticks.)

    const { kmh } = sample;
    const plannedKmh = 60 / this.plannedPaceMinPerKm;
    if (
      !sample.moving ||
      kmh === null ||
      kmh < PACE_MISMATCH_MIN_KMH ||
      kmh > PACE_MISMATCH_MAX_KMH ||
      kmh < plannedKmh * PACE_MISMATCH_RATIO
    ) {
      this.since = null;
      return null;
    }

    if (this.since === null) this.since = sample.atMs;
    if (sample.atMs - this.since < PACE_MISMATCH_SUSTAIN_MS) return null;

    this.phase = "offered";
    this.since = null;
    return {
      measuredKmh: Math.round(kmh * 2) / 2,
      plannedKmh: Math.round(plannedKmh * 10) / 10,
    };
  }
}
