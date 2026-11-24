import type { Coordinates } from "@/lib/types";
import { bearingBetween, haversineDistance } from "@/lib/utils/geo";

/** The browser's own heading is trusted only at or above this device speed, m/s (below it the OS reports null, NaN or noise). */
export const HEADING_MIN_SPEED_MPS = 0.7;
/** Without a usable device heading: the direction between two fixes at least this far apart, metres. */
export const HEADING_CHORD_MIN_M = 8;
/** ...and only between fixes at least this accurate, metres. A looser fix says nothing about direction. */
export const HEADING_MAX_ACCURACY_M = 25;
/** The last heading is held this long (fix clock) once nothing valid arrives; after that there is no arrow rather than a wrong one. */
export const HEADING_HOLD_MS = 20_000;
/** Below this device speed the walker is standing: GPS jitter must not turn the arrow. */
const STANDING_SPEED_MPS = 0.3;
/** Weight of each new heading; two fixes cover most of a turn (0.35 took three to five seconds and read as lag). */
const ALPHA = 0.5;

export interface HeadingSample {
  position: Coordinates;
  accuracyM: number;
  /** The fix's own timestamp, ms. */
  timestamp: number;
  /** `coords.heading`: degrees clockwise from north, when the device has one. */
  headingDeg?: number;
  /** `coords.speed`, m/s, when the device has one. */
  speedMps?: number;
}

const normalise = (deg: number): number => ((deg % 360) + 360) % 360;
/** The signed shortest turn from one bearing to another, -180..180. */
const turn = (from: number, to: number): number => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * Which way the walker faces, for the arrow on the dot. Pure, and fed one fix at a time.
 *
 * A walker at 1.4 m/s with 5 to 15 m of GPS error has no usable bearing between two consecutive fixes, so
 * (in priority order) it takes the device's own heading while moving, else the chord between two accurate
 * fixes far enough apart to mean something, else holds the last answer and gives up after `HEADING_HOLD_MS`.
 * The result is smoothed on the circle, and returned unwrapped (it may leave 0..360) so a marker rotated by
 * CSS turns through the short way from 359 to 1 instead of spinning round.
 */
export class HeadingSmoother {
  private smoothed: number | null = null;
  private lastValidAt = Number.NEGATIVE_INFINITY;
  private anchor: HeadingSample | null = null;

  push(sample: HeadingSample): void {
    const standing = sample.speedMps !== undefined && Number.isFinite(sample.speedMps) && sample.speedMps < STANDING_SPEED_MPS;
    const accurate = sample.accuracyM <= HEADING_MAX_ACCURACY_M;
    let target: number | null = null;

    const deviceHeading = sample.headingDeg;
    if (
      deviceHeading !== undefined &&
      Number.isFinite(deviceHeading) &&
      deviceHeading >= 0 &&
      deviceHeading <= 360 &&
      sample.speedMps !== undefined &&
      Number.isFinite(sample.speedMps) &&
      sample.speedMps >= HEADING_MIN_SPEED_MPS
    ) {
      target = normalise(deviceHeading);
      if (accurate) this.anchor = sample;
    } else if (!accurate || standing) {
      // A loose fix says nothing about direction, and a standing walker has none: never start a chord from either.
      if (standing) this.anchor = accurate ? sample : this.anchor;
    } else if (this.anchor === null) {
      this.anchor = sample;
    } else {
      // The farther apart two fixes are, the less their error matters; a looser fix needs a longer chord.
      const needed = Math.max(HEADING_CHORD_MIN_M, this.anchor.accuracyM, sample.accuracyM);
      if (haversineDistance(this.anchor.position, sample.position) >= needed) {
        target = bearingBetween(this.anchor.position, sample.position);
        this.anchor = sample;
      }
    }

    if (target === null) return;
    // After a long gap the old heading is history, not something to blend with.
    if (this.smoothed !== null && sample.timestamp - this.lastValidAt > HEADING_HOLD_MS) this.smoothed = null;
    this.smoothed = this.smoothed === null ? target : this.smoothed + ALPHA * turn(normalise(this.smoothed), target);
    this.lastValidAt = sample.timestamp;
  }

  /** The smoothed heading (unwrapped degrees), or null when there is none yet or none valid for 20 s. */
  current(atMs: number): number | null {
    if (this.smoothed === null || atMs - this.lastValidAt > HEADING_HOLD_MS) return null;
    return this.smoothed;
  }

  reset(): void {
    this.smoothed = null;
    this.lastValidAt = Number.NEGATIVE_INFINITY;
    this.anchor = null;
  }
}
