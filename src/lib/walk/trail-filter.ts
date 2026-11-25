import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  ENGINE_MAX_ACCURACY_M,
  SPEED_MAX_JUMP_MPS,
  TRAIL_MAX_ACCURACY_M,
  TRAIL_MAX_STEP_M,
  TRAIL_MIN_STEP_M,
  TRAIL_SMOOTH_ABOVE_ACCURACY_M,
  TRAIL_SMOOTH_FIXES,
  TRAIL_SMOOTH_WINDOW_MS,
} from "@/lib/walk/walk-cadence";

/** Same rule as the speed estimator: this many consistent rejected jumps in a row mean the walker really moved. */
const MAX_CONSECUTIVE_REJECTS = 3;

/** After this long with no good fix, the first fix back is only believed once a second fix agrees with it. */
const STALE_GOOD_MS = 10_000;

/** How far from the last kept point a fix must be to become a trail point. */
const stepFor = (accuracyM: number) => Math.max(TRAIL_MIN_STEP_M, Math.min(accuracyM, TRAIL_MAX_STEP_M));

/**
 * Decides which GPS fixes become points of the walked trail, so a phone standing
 * still draws no scribble. Time is the fix timestamp, never the wall clock.
 *
 * A fix worse than TRAIL_SMOOTH_ABOVE_ACCURACY_M is judged by the average of the last few fixes, because with a
 * step smaller than the reported accuracy a single noisy fix would otherwise draw points while standing still.
 */
export class TrailFilter {
  private last: { coordinates: Coordinates; timestamp: number } | null = null;
  /** The newest fix that was not a jump. Speed is measured from here, not from the last kept point. */
  private good: { coordinates: Coordinates; timestamp: number } | null = null;
  /** The first fix after a silence, waiting for a second one that agrees with it. */
  private pending: { coordinates: Coordinates; timestamp: number } | null = null;
  private rejectAnchor: Coordinates | null = null;
  private rejects = 0;
  private recent: Array<{ coordinates: Coordinates; timestamp: number }> = [];

  reset(): void {
    this.last = null;
    this.good = null;
    this.pending = null;
    this.rejectAnchor = null;
    this.rejects = 0;
    this.recent = [];
  }

  /** The fix itself when it is good; otherwise the mean of the recent fixes (including it). */
  private reference(coordinates: Coordinates, timestamp: number, accuracyM: number): Coordinates {
    this.recent.push({ coordinates, timestamp });
    this.recent = this.recent.filter((r) => timestamp - r.timestamp <= TRAIL_SMOOTH_WINDOW_MS).slice(-TRAIL_SMOOTH_FIXES);
    if (accuracyM <= TRAIL_SMOOTH_ABOVE_ACCURACY_M || this.recent.length < 2) return coordinates;
    const n = this.recent.length;
    return {
      lat: this.recent.reduce((s, r) => s + r.coordinates.lat, 0) / n,
      lng: this.recent.reduce((s, r) => s + r.coordinates.lng, 0) / n,
    };
  }

  /**
   * The point to add to the trail, or null when the fix adds nothing. That is the filter's own point (the mean of
   * the recent fixes for a poor fix), never the raw fix: the smoothing only protects the line when that is drawn.
   */
  accept(coordinates: Coordinates, timestamp: number, accuracyM: number): Coordinates | null {
    if (!(accuracyM <= TRAIL_MAX_ACCURACY_M)) return null;
    const step = stepFor(accuracyM);
    if (!this.good || !this.last) {
      const ref = this.reference(coordinates, timestamp, accuracyM);
      this.good = { coordinates, timestamp };
      return this.keep(ref, timestamp);
    }

    // After a silence the last good fix is stale: any jump would pass the speed test. The first fix back must be
    // corroborated by a second one before it anchors anything.
    if (timestamp - this.good.timestamp > STALE_GOOD_MS) {
      const p = this.pending;
      this.pending = { coordinates, timestamp };
      if (!p || timestamp - p.timestamp > STALE_GOOD_MS || haversineDistance(p.coordinates, coordinates) > step) return null;
      this.pending = null;
      this.good = { coordinates, timestamp };
      this.rejects = 0;
      this.rejectAnchor = null;
      this.recent = [];
    }

    const ref = this.reference(coordinates, timestamp, accuracyM);
    const dtSec = Math.max(1, (timestamp - this.good.timestamp) / 1000);
    const jumpMps = haversineDistance(this.good.coordinates, coordinates) / dtSec;
    if (jumpMps > SPEED_MAX_JUMP_MPS) {
      const consistent = this.rejectAnchor !== null && haversineDistance(this.rejectAnchor, coordinates) <= step;
      this.rejects = consistent ? this.rejects + 1 : 1;
      this.rejectAnchor = coordinates;
      if (this.rejects < MAX_CONSECUTIVE_REJECTS) return null;
      this.good = { coordinates, timestamp };
    } else {
      this.good = { coordinates, timestamp };
      this.rejects = 0;
      this.rejectAnchor = null;
    }
    if (haversineDistance(this.last.coordinates, ref) < step) return null;
    return this.keep(ref, timestamp);
  }

  private keep(coordinates: Coordinates, timestamp: number): Coordinates {
    this.last = { coordinates, timestamp };
    this.rejectAnchor = null;
    this.rejects = 0;
    return coordinates;
  }
}

/**
 * The walked trail as it is drawn: the kept points plus the dot as the last vertex, so the gold line always meets the
 * dot instead of ending up to a step behind it. Pure. A trail with no point yet, a dot that is not engine-grade, or a
 * dot already on the last point leave the trail untouched (same array).
 */
export function withLiveTail(walked: Coordinates[], dot: Coordinates | undefined | null, accuracyM: number | null | undefined): Coordinates[] {
  if (!dot || walked.length === 0) return walked;
  if (!(typeof accuracyM === "number" && accuracyM <= ENGINE_MAX_ACCURACY_M)) return walked;
  const end = walked[walked.length - 1];
  if (end.lat === dot.lat && end.lng === dot.lng) return walked;
  return [...walked, dot];
}
