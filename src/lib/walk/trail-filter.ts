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

/** Doppler speeds at or above this are a moving walker; a median under STOPPED_MPS over 3+ fixes is a standing one. */
const MOVING_MPS = 0.6;
const STOPPED_MPS = 0.35;
const STOPPED_WINDOW_MS = 10_000;
/** Rejected fixes that agree for this long, with the phone not stopped, are a real move. */
const REBASE_AGREE_MS = 15_000;

/** The first trail point needs this accuracy, or a second fix that agrees with it. */
const SEED_MAX_ACCURACY_M = 20;

/** A fix with no device speed while this share of the last PROVIDER_WINDOW_MS carried one is a Wi-Fi or cell fix. */
const PROVIDER_WINDOW_MS = 20_000;
const PROVIDER_SHARE = 0.5;
const PROVIDER_MIN_FIXES = 5;

/** After this long with no good fix, the first fix back is only believed once a second fix agrees with it. */
const STALE_GOOD_MS = 10_000;

/** How far from the last kept point a fix must be to become a trail point. */
const stepFor = (accuracyM: number) => {
  const base = Math.max(TRAIL_MIN_STEP_M, Math.min(accuracyM, TRAIL_MAX_STEP_M));
  // A poor fix is judged by a mean of a few fixes whose own noise is still a good part of the accuracy: ask for a bit more.
  return accuracyM > TRAIL_SMOOTH_ABOVE_ACCURACY_M ? Math.max(base, Math.min(accuracyM * 0.6, TRAIL_MAX_STEP_M * 1.6)) : base;
};

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
  private good: { coordinates: Coordinates; timestamp: number; accuracyM: number } | null = null;
  /** The first fix after a silence, waiting for a second one that agrees with it. */
  private pending: { coordinates: Coordinates; timestamp: number } | null = null;
  /** The run of rejected fixes that agree with each other, with their Doppler speed. */
  private rejected: Array<{ coordinates: Coordinates; timestamp: number; speedMps?: number }> = [];
  private doppler: Array<{ timestamp: number; speedMps: number }> = [];
  /** Which recent fixes carried a device speed: a fix without one in a stream that has them is another provider. */
  private seen: Array<{ timestamp: number; hasSpeed: boolean }> = [];
  /** The last fix seen was a jump or a suspect: the dot may show it, the trail's tail must not follow it. */
  private lastWasJump = false;
  private recent: Array<{ coordinates: Coordinates; timestamp: number }> = [];

  reset(): void {
    this.last = null;
    this.good = null;
    this.pending = null;
    this.rejected = [];
    this.doppler = [];
    this.seen = [];
    this.lastWasJump = false;
    this.recent = [];
  }

  /** The phone is standing: at least 3 Doppler speeds in the last 10 s with a median under 0.35 m/s. */
  private stopped(timestamp: number): boolean {
    const w = this.doppler.filter((d) => timestamp - d.timestamp <= STOPPED_WINDOW_MS).map((d) => d.speedMps).sort((a, b) => a - b);
    return w.length >= 3 && w[Math.floor(w.length / 2)] < STOPPED_MPS;
  }

  /** Whether the live tail may be drawn from the trail's end to the dot. */
  tailAllowed(dot: Coordinates | undefined | null, accuracyM: number | null | undefined): boolean {
    if (!dot || !this.last || this.lastWasJump) return false;
    if (!(typeof accuracyM === "number" && accuracyM <= ENGINE_MAX_ACCURACY_M)) return false;
    return haversineDistance(this.last.coordinates, dot) <= 2 * TRAIL_MAX_STEP_M;
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
  accept(coordinates: Coordinates, timestamp: number, accuracyM: number, speedMps?: number): Coordinates | null {
    if (!(accuracyM <= TRAIL_MAX_ACCURACY_M)) return null;
    const step = stepFor(accuracyM);
    this.seen = this.seen.filter((x) => timestamp - x.timestamp <= PROVIDER_WINDOW_MS);
    const withSpeed = this.seen.filter((x) => x.hasSpeed).length;
    const providerSwitch =
      typeof speedMps !== "number" && this.seen.length >= PROVIDER_MIN_FIXES && withSpeed / this.seen.length >= PROVIDER_SHARE;
    this.seen.push({ timestamp, hasSpeed: typeof speedMps === "number" });
    if (providerSwitch) {
      // It may move the dot, never the trail: it does not anchor, draw, or count as a good fix.
      this.lastWasJump = true;
      return null;
    }
    if (typeof speedMps === "number") {
      this.doppler.push({ timestamp, speedMps });
      this.doppler = this.doppler.filter((d) => timestamp - d.timestamp <= STOPPED_WINDOW_MS);
    }
    if (!this.good || !this.last) {
      // The first point needs a good fix, or two poor ones that agree: a lone coarse fix must not start the trail.
      const ref = this.reference(coordinates, timestamp, accuracyM);
      if (accuracyM > SEED_MAX_ACCURACY_M) {
        const p = this.pending;
        this.pending = { coordinates, timestamp };
        if (!p || haversineDistance(p.coordinates, coordinates) > step) return null;
      }
      this.pending = null;
      this.good = { coordinates, timestamp, accuracyM };
      return this.keep(ref, timestamp);
    }

    // After a silence the last good fix is stale: any jump would pass the speed test. The first fix back must be
    // corroborated by a second one before it anchors anything.
    if (timestamp - this.good.timestamp > STALE_GOOD_MS) {
      const p = this.pending;
      this.pending = { coordinates, timestamp };
      if (!p || timestamp - p.timestamp > STALE_GOOD_MS || haversineDistance(p.coordinates, coordinates) > step) {
        this.lastWasJump = true;
        return null;
      }
      this.pending = null;
      this.good = { coordinates, timestamp, accuracyM };
      this.rejected = [];
      this.recent = [];
    }

    const dtSec = Math.max(1, (timestamp - this.good.timestamp) / 1000);
    // Two noisy fixes of a standing phone are apart by about their accuracy: that part is not movement.
    const allowanceM = (accuracyM + this.good.accuracyM) / 2;
    if (Math.max(0, haversineDistance(this.good.coordinates, coordinates) - allowanceM) / dtSec > SPEED_MAX_JUMP_MPS) {
      this.lastWasJump = true;
      const prev = this.rejected[this.rejected.length - 1];
      if (!prev || haversineDistance(prev.coordinates, coordinates) > step) this.rejected = [];
      this.rejected.push({ coordinates, timestamp, speedMps });
      if (this.rejected.length < MAX_CONSECUTIVE_REJECTS) return null;
      const span = timestamp - this.rejected[0].timestamp;
      const moving = this.rejected.filter((r) => typeof r.speedMps === "number" && r.speedMps >= MOVING_MPS).length >= MAX_CONSECUTIVE_REJECTS;
      if (!moving && !(span >= REBASE_AGREE_MS && !this.stopped(timestamp))) {
        // Standing still, and the GPS (real Doppler on every fix) keeps agreeing somewhere else: the anchor was the
        // wrong one. Move it without drawing a line to it.
        if (this.stopped(timestamp) && this.rejected.every((r) => typeof r.speedMps === "number")) {
          this.good = { coordinates, timestamp, accuracyM };
          this.last = { coordinates, timestamp };
          this.rejected = [];
          this.recent = [];
          this.lastWasJump = false;
        }
        return null;
      }
      this.rejected = [];
      this.recent = [];
    } else {
      this.rejected = [];
    }
    this.good = { coordinates, timestamp, accuracyM };
    this.lastWasJump = false;
    const ref = this.reference(coordinates, timestamp, accuracyM);
    if (this.stopped(timestamp)) return null; // Doppler freeze: a standing phone draws no new points
    if (haversineDistance(this.last.coordinates, ref) < step) return null;
    return this.keep(ref, timestamp);
  }

  private keep(coordinates: Coordinates, timestamp: number): Coordinates {
    this.last = { coordinates, timestamp };
    this.rejected = [];
    return coordinates;
  }
}

/**
 * The walked trail as it is drawn: the kept points plus the dot as the last vertex, so the gold line always meets the
 * dot instead of ending up to a step behind it. Pure. A trail with no point yet, a dot that is not engine-grade, or a
 * dot already on the last point leave the trail untouched (same array).
 */
export function withLiveTail(
  walked: Coordinates[],
  dot: Coordinates | undefined | null,
  accuracyM: number | null | undefined,
  tailAllowed = true,
): Coordinates[] {
  if (!dot || walked.length === 0 || !tailAllowed) return walked;
  if (!(typeof accuracyM === "number" && accuracyM <= ENGINE_MAX_ACCURACY_M)) return walked;
  const end = walked[walked.length - 1];
  if (end.lat === dot.lat && end.lng === dot.lng) return walked;
  return [...walked, dot];
}
