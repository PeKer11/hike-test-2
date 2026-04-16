import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

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

  constructor(onUpdate: PaceUpdateHandler, onError?: PaceErrorHandler) {
    this.onUpdate = onUpdate;
    this.onError = onError;
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

    this.samples.push(sample);
    if (this.samples.length > PACE_SAMPLE_WINDOW) {
      this.samples.shift();
    }

    this.onUpdate({
      currentPosition: sample.coordinates,
      accuracyMeters: accuracy,
      paceMinPerKm: this.computePace(),
      timestamp: sample.timestamp,
    });
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
