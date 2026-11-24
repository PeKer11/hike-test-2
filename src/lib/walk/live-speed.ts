import {
  SPEED_LIVE_TAU_MS,
  SPEED_LIVE_WINDOW_MS,
  SPEED_MOVE_ABOVE_MPS,
  SPEED_STOP_BELOW_MPS,
} from "@/lib/walk/walk-cadence";
import type { SpeedState } from "@/lib/walk/speed-estimator";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The speed the walker sees, from the device's Doppler speed only (positions are never used,
 * so GPS jitter cannot fake a walk or a stop). A short median, a stop/move verdict with
 * hysteresis, and a light time-based smoothing. "unknown" when there is no recent reading:
 * the caller then falls back to the sustained SpeedEstimator.
 */
export class LiveSpeed {
  private readings: Array<{ timestamp: number; mps: number }> = [];
  private state: "moving" | "paused" = "paused";
  private shownMps = 0;
  private lastTs: number | null = null;

  record(sample: { timestamp: number; speedMps?: number | null }): void {
    const v = sample.speedMps;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return;
    if (this.lastTs !== null && sample.timestamp <= this.lastTs) return;

    const dt = this.lastTs === null ? 0 : sample.timestamp - this.lastTs;
    this.lastTs = sample.timestamp;
    this.readings.push({ timestamp: sample.timestamp, mps: v });
    const cutoff = sample.timestamp - SPEED_LIVE_WINDOW_MS;
    this.readings = this.readings.filter((r) => r.timestamp > cutoff);
    const raw = median(this.readings.map((r) => r.mps));

    if (this.state === "moving") {
      if (raw < SPEED_STOP_BELOW_MPS) {
        this.state = "paused";
        this.shownMps = 0;
      } else {
        const a = 1 - Math.exp(-dt / SPEED_LIVE_TAU_MS);
        this.shownMps += a * (raw - this.shownMps);
      }
    } else if (raw >= SPEED_MOVE_ABOVE_MPS) {
      this.state = "moving";
      this.shownMps = raw;
    }
  }

  current(now: number): { kmh: number | null; state: SpeedState } {
    if (this.lastTs === null || now - this.lastTs > SPEED_LIVE_WINDOW_MS) {
      return { kmh: null, state: "unknown" };
    }
    if (this.state === "paused") return { kmh: 0, state: "paused" };
    return { kmh: this.shownMps * 3.6, state: "moving" };
  }

  reset(): void {
    this.readings = [];
    this.state = "paused";
    this.shownMps = 0;
    this.lastTs = null;
  }
}
