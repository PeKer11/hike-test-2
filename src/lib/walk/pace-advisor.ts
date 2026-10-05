import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  ADVISOR_CARD_COOLDOWN_MS,
  ADVISOR_FAST_CLEAR_RATIO,
  ADVISOR_FAST_RATIO,
  ADVISOR_SLOW_CLEAR_RATIO,
  ADVISOR_SLOW_RATIO,
  PACE_ADVISOR_WINDOW_MS,
} from "@/lib/walk/walk-cadence";

export type PaceAdvice = "slow" | "fast";

export interface AdvisorSample {
  coordinates: Coordinates;
  /** Fix timestamp, ms. Never the wall clock. */
  timestamp: number;
}

// A window this empty cannot say "sustained". Lower than ReplanTrigger's 0.9: this
// only offers a card, so catching a real slowdown in ~5 minutes matters more than
// the odd early card.
const MIN_WINDOW_COVERAGE = 0.6;
const MIN_SAMPLES = 5;
// Hops shorter than this are GPS jitter, not walking, and are not summed.
const JITTER_FLOOR_METERS = 10;

/**
 * Cheap local pace check behind the "slower / faster than planned" cards.
 *
 * Unlike `ReplanTrigger` (15-minute window, rebuilds) this only ever *offers*:
 * a 5-minute window, hysteresis so it does not flap around a threshold, a
 * cooldown between cards of the same kind, and silence near a stop.
 */
export class PaceAdvisor {
  // `afterStop`: the first fix after an at-stop stretch. The hop to it, and the
  // dwell time it spans, are left out of the pace (a visit is not slowness).
  private samples: Array<AdvisorSample & { afterStop: boolean }> = [];
  private pendingStop = false;
  private state: PaceAdvice | null = null;
  private lastCardAt: Record<PaceAdvice, number> = {
    slow: Number.NEGATIVE_INFINITY,
    fast: Number.NEGATIVE_INFINITY,
  };

  constructor(private readonly plannedPaceMinPerKm: number) {}

  /**
   * `atStop`: the fix is within the quiet radius of a plan stop. A visit is not
   * slowness, so those fixes are dropped and the first fix after leaving is
   * flagged: the hop to it (and the dwell time) is excluded, while the walking
   * either side of the stop still counts, so closely spaced stops don't blind
   * the advisor.
   */
  record(sample: AdvisorSample, atStop = false): void {
    if (atStop) {
      this.state = null;
      this.pendingStop = this.samples.length > 0 || this.pendingStop;
      return;
    }
    this.samples.push({ ...sample, afterStop: this.pendingStop });
    this.pendingStop = false;
    const cutoff = sample.timestamp - PACE_ADVISOR_WINDOW_MS;
    while (this.samples.length > 0 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }

  /** The advice a card should be shown for right now, or null. */
  evaluate(now: number, nearStop: boolean): PaceAdvice | null {
    const ratio = this.paceRatio(now);
    if (ratio === null) return null;

    // Hysteresis: enter at the wide threshold, leave at the narrow one.
    if (this.state === "slow" && ratio < ADVISOR_SLOW_CLEAR_RATIO) this.state = null;
    else if (this.state === "fast" && ratio > ADVISOR_FAST_CLEAR_RATIO) this.state = null;

    if (this.state === null) {
      if (ratio > ADVISOR_SLOW_RATIO) this.state = "slow";
      else if (ratio < ADVISOR_FAST_RATIO) this.state = "fast";
    } else if (this.state === "slow" && ratio < ADVISOR_FAST_RATIO) {
      this.state = "fast";
    } else if (this.state === "fast" && ratio > ADVISOR_SLOW_RATIO) {
      this.state = "slow";
    }

    if (this.state === null || nearStop) return null;
    if (now - this.lastCardAt[this.state] < ADVISOR_CARD_COOLDOWN_MS) return null;

    this.lastCardAt[this.state] = now;
    return this.state;
  }

  reset(): void {
    this.samples = [];
    this.pendingStop = false;
    this.state = null;
    this.lastCardAt = {
      slow: Number.NEGATIVE_INFINITY,
      fast: Number.NEGATIVE_INFINITY,
    };
  }

  /** Measured pace ÷ planned pace over the window; >1 is slower. Null if unknown. */
  private paceRatio(now: number): number | null {
    const window = this.samples.filter(
      (s) => now - s.timestamp <= PACE_ADVISOR_WINDOW_MS,
    );
    if (window.length < MIN_SAMPLES) return null;

    let spanMs = 0;
    let anchor = window[0].coordinates;
    let distMeters = 0;
    for (let i = 1; i < window.length; i += 1) {
      if (window[i].afterStop) {
        anchor = window[i].coordinates;
        continue;
      }
      spanMs += window[i].timestamp - window[i - 1].timestamp;
      const hop = haversineDistance(anchor, window[i].coordinates);
      if (hop >= JITTER_FLOOR_METERS) {
        distMeters += hop;
        anchor = window[i].coordinates;
      }
    }
    if (spanMs < PACE_ADVISOR_WINDOW_MS * MIN_WINDOW_COVERAGE) return null;
    // Barely moved: that is a stop, which `SpeedEstimator` reports as Paused.
    if (distMeters < JITTER_FLOOR_METERS) return null;

    const paceMinPerKm = spanMs / 60_000 / (distMeters / 1000);
    return paceMinPerKm / this.plannedPaceMinPerKm;
  }
}
