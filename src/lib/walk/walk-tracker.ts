import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance, routeDistanceBetween } from "@/lib/utils/geo";
import { geolocationSupported, locate, type LocateFix, type LocateState } from "@/lib/geo/locate";
import { DOT_MAX_ACCURACY_M, ENGINE_MAX_ACCURACY_M } from "@/lib/walk/walk-cadence";

/**
 * Compass bearing (degrees, 0 = north, clockwise) from a to b.
 */
function computeBearing(a: Coordinates, b: Coordinates): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface PositionSample {
  coordinates: Coordinates;
  timestamp: number; // ms since epoch
  accuracyMeters: number;
}

export interface PaceUpdate {
  currentPosition: Coordinates;
  accuracyMeters: number;
  paceMinPerKm: number | null; // null until enough samples
  timestamp: number;
  attractionDistances: Record<string, number>; // attraction ID → meters
  bearing?: number; // compass bearing from previous accepted sample, degrees (0=north)
  /** The device's own speed (`coords.speed`), m/s. Absent when it has none. */
  speedMps?: number;
  /** The device's own heading (`coords.heading`), degrees clockwise from north, when it reports a real one. */
  headingDeg?: number;
}

export type PaceUpdateHandler = (update: PaceUpdate) => void;
export interface PaceError {
  code: number;
  message: string;
  isTimeout: boolean;
}
export type PaceErrorHandler = (error: PaceError) => void;
export type GpsStateHandler = (state: LocateState) => void;

// Minimum distance between samples to compute a meaningful pace (avoids GPS noise)
const MIN_DISTANCE_FOR_PACE_METERS = 10;
// Keep last N samples for pace averaging
const PACE_SAMPLE_WINDOW = 5;
// The very first fix may be this coarse (shown as a dot with a halo) so the screen is never empty
// while the GPS locks; after that only fixes within DOT_MAX_ACCURACY_M reach the dot.
const FIRST_FIX_MAX_ACCURACY_METERS = 2000;

export class WalkTracker {
  private locator: { stop(): void } | null = null;
  private onState?: GpsStateHandler;
  private hasEmitted = false;
  private samples: PositionSample[] = [];
  private onUpdate: PaceUpdateHandler;
  private onError?: PaceErrorHandler;
  private attractions: Attraction[];
  private geometry: Coordinates[];
  private lastAcceptedPosition: Coordinates | null = null;

  constructor(
    onUpdate: PaceUpdateHandler,
    onError?: PaceErrorHandler,
    attractions: Attraction[] = [],
    geometry: Coordinates[] = [],
    onState?: GpsStateHandler,
  ) {
    this.onState = onState;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.attractions = attractions;
    this.geometry = geometry;
  }

  start(): void {
    if (!geolocationSupported()) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    this.locator = locate({
      purpose: "walk",
      onUpdate: (fix) => this.handleFix(fix),
      onState: (state) => this.onState?.(state),
      onError: (err) => this.onError?.(err),
    });
  }

  /** Swap in new route geometry mid-walk (a local rejoin spliced the route). */
  updateGeometry(geometry: Coordinates[]): void {
    this.geometry = geometry;
  }

  stop(): void {
    this.locator?.stop();
    this.locator = null;
    this.hasEmitted = false;
    this.samples = [];
    this.lastAcceptedPosition = null;
  }

  private handleFix(fix: LocateFix): void {
    const accuracy = fix.accuracyMeters;

    // The dot takes any fix up to DOT_MAX_ACCURACY_M (with a halo of that size); the first fix
    // may be coarser. Pace, bearing and everything built on them only trust ENGINE_MAX_ACCURACY_M.
    const tooPoor = accuracy > DOT_MAX_ACCURACY_M;
    if (tooPoor && (this.hasEmitted || accuracy > FIRST_FIX_MAX_ACCURACY_METERS)) return;
    this.hasEmitted = true;

    const engineGrade = accuracy <= ENGINE_MAX_ACCURACY_M;
    const sample: PositionSample = {
      coordinates: fix.coordinates,
      timestamp: fix.timestamp,
      accuracyMeters: accuracy,
    };

    let bearing: number | undefined;
    if (engineGrade) {
      bearing =
        this.lastAcceptedPosition !== null
          ? computeBearing(this.lastAcceptedPosition, sample.coordinates)
          : undefined;
      this.lastAcceptedPosition = sample.coordinates;
      this.samples.push(sample);
      if (this.samples.length > PACE_SAMPLE_WINDOW) {
        this.samples.shift();
      }
    }

    this.onUpdate({
      currentPosition: sample.coordinates,
      accuracyMeters: accuracy,
      paceMinPerKm: engineGrade ? this.computePace() : null,
      timestamp: sample.timestamp,
      attractionDistances: this.computeAttractionDistances(sample.coordinates),
      bearing,
      speedMps: fix.speedMps,
      headingDeg: fix.headingDeg,
    });
  }

  private computeAttractionDistances(position: Coordinates): Record<string, number> {
    const result: Record<string, number> = {};
    for (const attraction of this.attractions) {
      result[attraction.id] = this.geometry.length >= 2
        ? routeDistanceBetween(this.geometry, position, attraction.coordinates)
        : haversineDistance(position, attraction.coordinates);
    }
    return result;
  }

  private computePace(): number | null {
    if (this.samples.length < 2) return null;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];

    // Sum the distance walked between consecutive samples. Measuring the straight
    // line from the first to the last sample under-counts every turn in the path
    // and makes the walker look slower than they are (false slow-pace rebuilds).
    let distMeters = 0;
    for (let i = 1; i < this.samples.length; i += 1) {
      distMeters += haversineDistance(
        this.samples[i - 1].coordinates,
        this.samples[i].coordinates,
      );
    }
    if (distMeters < MIN_DISTANCE_FOR_PACE_METERS) return null;

    const durationMs = last.timestamp - first.timestamp;
    if (durationMs <= 0) return null;

    const speedMps = distMeters / (durationMs / 1000);
    const paceMinPerKm = 1000 / 60 / speedMps;

    // Sanity clamp: 5 min/km (brisk walk) to 30 min/km (very slow)
    if (paceMinPerKm < 5 || paceMinPerKm > 30) return null;

    return paceMinPerKm;
  }
}
