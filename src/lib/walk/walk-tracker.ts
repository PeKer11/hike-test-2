import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance, routeDistanceBetween } from "@/lib/utils/geo";

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
}

export type PaceUpdateHandler = (update: PaceUpdate) => void;
export interface PaceError {
  code: number;
  message: string;
  isTimeout: boolean;
}
export type PaceErrorHandler = (error: PaceError) => void;

// Minimum distance between samples to compute a meaningful pace (avoids GPS noise)
const MIN_DISTANCE_FOR_PACE_METERS = 10;
// Keep last N samples for pace averaging
const PACE_SAMPLE_WINDOW = 5;
// Ignore positions with accuracy worse than this
const MAX_ACCURACY_METERS = 100;

export class WalkTracker {
  private watchId: number | null = null;
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
  ) {
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.attractions = attractions;
    this.geometry = geometry;
  }

  start(): void {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => {
        this.onError?.({
          code: err.code,
          message: err.message,
          isTimeout: err.code === err.TIMEOUT,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.samples = [];
    this.lastAcceptedPosition = null;
  }

  private handlePosition(pos: GeolocationPosition): void {
    const accuracy = pos.coords.accuracy;

    // Discard low-accuracy readings
    if (accuracy > MAX_ACCURACY_METERS) return;

    const sample: PositionSample = {
      coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      timestamp: pos.timestamp,
      accuracyMeters: accuracy,
    };

    const bearing =
      this.lastAcceptedPosition !== null
        ? computeBearing(this.lastAcceptedPosition, sample.coordinates)
        : undefined;

    this.lastAcceptedPosition = sample.coordinates;

    this.samples.push(sample);
    if (this.samples.length > PACE_SAMPLE_WINDOW) {
      this.samples.shift();
    }

    this.onUpdate({
      currentPosition: sample.coordinates,
      accuracyMeters: accuracy,
      paceMinPerKm: this.computePace(),
      timestamp: sample.timestamp,
      attractionDistances: this.computeAttractionDistances(sample.coordinates),
      bearing,
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

    const distMeters = haversineDistance(
      first.coordinates,
      last.coordinates,
    );
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
