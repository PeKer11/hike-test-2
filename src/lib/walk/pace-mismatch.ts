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
/** An offer nobody answered comes back no sooner than this (fix clock), as a fresh question. */
export const PACE_MISMATCH_REASK_MS = 10 * 60_000;
/** Spare minutes (at the offered pace) from which the card also offers to lengthen the walk. */
export const PACE_MISMATCH_LENGTHEN_MIN_SPARE = 10;

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
  private quietUntil = Number.NEGATIVE_INFINITY;

  constructor(private plannedPaceMinPerKm: number) {}

  /** The pace the plan is judged against now: a watcher is only carried to the next leg while this is unchanged. */
  get plannedPace(): number {
    return this.plannedPaceMinPerKm;
  }

  /** The plan was re-timed (the walker accepted, or said "N km/h"): a new question is allowed. */
  setPlannedPace(minPerKm: number): void {
    if (!Number.isFinite(minPerKm) || minPerKm <= 0) return;
    this.plannedPaceMinPerKm = minPerKm;
    this.phase = "watching";
    this.since = null;
  }

  /**
   * The offer was shown and nobody answered it (the card expired). Not a "keep": it may come back,
   * but only as a new question after `PACE_MISMATCH_REASK_MS`, never straight away.
   */
  lapse(atMs: number): void {
    if (this.phase !== "offered") return;
    this.phase = "watching";
    this.since = null;
    this.quietUntil = atMs + PACE_MISMATCH_REASK_MS;
  }

  /**
   * A new leg of the same walk begins at `atMs` on the fix clock. A watcher carried over from the previous leg may hold
   * times from a clock that ran ahead of this one (the simulator's runs 10x): the "older timestamp says nothing new" rule
   * and the quiet period are re-based so it is not silent for the rest of the walk.
   */
  startLeg(atMs: number): void {
    this.lastAt = Number.NEGATIVE_INFINITY;
    this.since = null;
    this.quietUntil = Math.min(this.quietUntil, atMs + PACE_MISMATCH_REASK_MS);
  }

  /**
   * The card that was up went away without an answer because the route changed under it (not because the walker
   * ignored it): the question is open again, with no quiet period.
   */
  reopen(): void {
    if (this.phase === "offered") this.phase = "watching";
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
    if (sample.atMs < this.quietUntil) {
      this.since = null;
      return null;
    }
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
