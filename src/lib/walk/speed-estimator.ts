import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  PAUSED_MIN_MOVE_M,
  PAUSED_WINDOW_MS,
  SPEED_DOPPLER_WINDOW_MS,
  SPEED_MAX_ACCURACY_M,
  SPEED_MAX_JUMP_MPS,
  SPEED_POSITION_WINDOW_MS,
  SPEED_SMOOTHING_ALPHA,
} from "@/lib/walk/walk-cadence";

export interface SpeedSample {
  coordinates: Coordinates;
  /** Fix timestamp, ms. Never the wall clock. */
  timestamp: number;
  accuracyMeters: number;
  /** `coords.speed` from the Geolocation API, m/s. Often null. */
  speedMps?: number | null;
}

export type SpeedState = "moving" | "paused" | "unknown";

// After this many fixes in a row rejected as jumps, the baseline is the thing
// that is wrong (tunnel exit, a long GPS gap) — take the new fix as truth.
const MAX_CONSECUTIVE_REJECTS = 3;
// Positional speed needs at least this much time between its first and last fix.
const MIN_POSITION_SPAN_MS = 8_000;
// A paused verdict needs nearly the whole window of evidence.
const MIN_PAUSED_SPAN_MS = PAUSED_WINDOW_MS * 0.9;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Live walking speed from the fix stream: the device's own Doppler speed when it
 * has one (median of the last 10 s), otherwise displacement over a 30 s window.
 * Poor fixes and impossible jumps are dropped, and the shown value is smoothed.
 */
export class SpeedEstimator {
  private samples: SpeedSample[] = [];
  private lastAccepted: SpeedSample | null = null;
  private consecutiveRejects = 0;
  private smoothedMps: number | null = null;

  record(sample: SpeedSample): void {
    if (sample.accuracyMeters > SPEED_MAX_ACCURACY_M) return;

    const last = this.lastAccepted;
    if (last) {
      const dtS = (sample.timestamp - last.timestamp) / 1000;
      if (dtS <= 0) return;
      const jumpMps = haversineDistance(last.coordinates, sample.coordinates) / dtS;
      if (jumpMps > SPEED_MAX_JUMP_MPS) {
        this.consecutiveRejects += 1;
        if (this.consecutiveRejects < MAX_CONSECUTIVE_REJECTS) return;
        // Re-baseline on the new location: the old window describes somewhere else.
        this.samples = [];
        this.smoothedMps = null;
      }
    }
    this.consecutiveRejects = 0;
    this.lastAccepted = sample;
    this.samples.push(sample);

    const cutoff = sample.timestamp - Math.max(SPEED_POSITION_WINDOW_MS, PAUSED_WINDOW_MS);
    while (this.samples.length > 1 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }

    const raw = this.rawSpeed(sample.timestamp);
    if (raw !== null) {
      this.smoothedMps =
        this.smoothedMps === null
          ? raw
          : SPEED_SMOOTHING_ALPHA * raw + (1 - SPEED_SMOOTHING_ALPHA) * this.smoothedMps;
    }
  }

  current(now: number): { kmh: number | null; state: SpeedState } {
    const latest = this.samples[this.samples.length - 1];
    // No recent fix: say nothing rather than echo the last number forever.
    if (!latest || now - latest.timestamp > PAUSED_WINDOW_MS) {
      return { kmh: null, state: "unknown" };
    }

    if (this.isPaused(now)) return { kmh: 0, state: "paused" };
    if (this.smoothedMps === null) return { kmh: null, state: "unknown" };
    return { kmh: this.smoothedMps * 3.6, state: "moving" };
  }

  reset(): void {
    this.samples = [];
    this.lastAccepted = null;
    this.consecutiveRejects = 0;
    this.smoothedMps = null;
  }

  private isPaused(now: number): boolean {
    const window = this.samples.filter((s) => now - s.timestamp <= PAUSED_WINDOW_MS);
    if (window.length < 2) return false;
    const first = window[0];
    const last = window[window.length - 1];
    if (last.timestamp - first.timestamp < MIN_PAUSED_SPAN_MS) return false;

    // Furthest the walker got from where the window started — a walker who
    // leaves and returns has not been paused.
    let maxMove = 0;
    for (const s of window) {
      maxMove = Math.max(maxMove, haversineDistance(first.coordinates, s.coordinates));
    }
    const threshold = Math.max(PAUSED_MIN_MOVE_M, last.accuracyMeters);
    return maxMove < threshold;
  }

  private rawSpeed(now: number): number | null {
    const doppler = this.samples
      .filter(
        (s) =>
          now - s.timestamp <= SPEED_DOPPLER_WINDOW_MS &&
          typeof s.speedMps === "number" &&
          Number.isFinite(s.speedMps) &&
          s.speedMps >= 0,
      )
      .map((s) => s.speedMps as number);
    if (doppler.length > 0) return median(doppler);

    const window = this.samples.filter((s) => now - s.timestamp <= SPEED_POSITION_WINDOW_MS);
    if (window.length < 2) return null;
    const first = window[0];
    const last = window[window.length - 1];
    const spanMs = last.timestamp - first.timestamp;
    if (spanMs < MIN_POSITION_SPAN_MS) return null;
    return haversineDistance(first.coordinates, last.coordinates) / (spanMs / 1000);
  }
}
