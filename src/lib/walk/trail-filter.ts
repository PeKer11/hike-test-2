import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { SPEED_MAX_JUMP_MPS, TRAIL_MAX_ACCURACY_M, TRAIL_MIN_STEP_M } from "@/lib/walk/walk-cadence";

/** Same rule as the speed estimator: this many consistent rejected jumps in a row mean the walker really moved. */
const MAX_CONSECUTIVE_REJECTS = 3;

/**
 * Decides which GPS fixes become points of the walked trail, so a phone standing
 * still draws no scribble. Time is the fix timestamp, never the wall clock.
 */
export class TrailFilter {
  private last: { coordinates: Coordinates; timestamp: number } | null = null;
  private rejectAnchor: Coordinates | null = null;
  private rejects = 0;

  reset(): void {
    this.last = null;
    this.rejectAnchor = null;
    this.rejects = 0;
  }

  /** True when the fix should be added to the trail. */
  accept(coordinates: Coordinates, timestamp: number, accuracyM: number): boolean {
    if (!(accuracyM <= TRAIL_MAX_ACCURACY_M)) return false;
    if (!this.last) return this.keep(coordinates, timestamp);

    const dist = haversineDistance(this.last.coordinates, coordinates);
    if (dist < Math.max(TRAIL_MIN_STEP_M, accuracyM)) return false;

    const dtSec = (timestamp - this.last.timestamp) / 1000;
    const jumpMps = dtSec > 0 ? dist / dtSec : Infinity;
    if (jumpMps > SPEED_MAX_JUMP_MPS) {
      const consistent = this.rejectAnchor !== null && haversineDistance(this.rejectAnchor, coordinates) <= Math.max(TRAIL_MIN_STEP_M, accuracyM);
      this.rejects = consistent ? this.rejects + 1 : 1;
      this.rejectAnchor = coordinates;
      if (this.rejects < MAX_CONSECUTIVE_REJECTS) return false;
    }
    return this.keep(coordinates, timestamp);
  }

  private keep(coordinates: Coordinates, timestamp: number): true {
    this.last = { coordinates, timestamp };
    this.rejectAnchor = null;
    this.rejects = 0;
    return true;
  }
}
