import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance, routeDistanceBetween } from "@/lib/utils/geo";
import type { PaceUpdateHandler, PaceUpdate } from "./walk-tracker";

export class SimulatedWalkTracker {
  private geometry: Coordinates[];
  private attractions: Attraction[];
  private paceMinPerKm: number;
  private speedMultiplier: number;
  private tickMs: number;
  private onUpdate: PaceUpdateHandler;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private distanceCovered: number = 0;
  private simulatedTime: number = 0;
  private cumulativeDist: number[];
  private totalDistance: number;

  constructor(
    geometry: Coordinates[],
    onUpdate: PaceUpdateHandler,
    attractions: Attraction[] = [],
    paceMinPerKm: number = 15,
    speedMultiplier: number = 10,
    tickMs: number = 500,
  ) {
    this.geometry = geometry;
    this.attractions = attractions;
    this.paceMinPerKm = paceMinPerKm;
    this.speedMultiplier = speedMultiplier;
    this.tickMs = tickMs;
    this.onUpdate = onUpdate;
    this.cumulativeDist = this.buildCumulativeDist(geometry);
    this.totalDistance = this.cumulativeDist[this.cumulativeDist.length - 1] ?? 0;
  }

  start(): void {
    if (this.geometry.length === 0) return;
    this.distanceCovered = 0;
    this.simulatedTime = Date.now();

    // e.g. 15 min/km → 1.11 m/s real → ×10 = 11.1 m/s simulated
    const metersPerTick =
      (1000 / (this.paceMinPerKm * 60)) * this.speedMultiplier * (this.tickMs / 1000);
    const simMsPerTick = this.tickMs * this.speedMultiplier;

    this.intervalId = setInterval(() => {
      this.distanceCovered = Math.min(
        this.distanceCovered + metersPerTick,
        this.totalDistance,
      );
      this.simulatedTime += simMsPerTick;

      const position = this.interpolatePosition(this.distanceCovered);

      const update: PaceUpdate = {
        currentPosition: position,
        accuracyMeters: 5,
        paceMinPerKm: this.paceMinPerKm,
        timestamp: this.simulatedTime,
        attractionDistances: this.computeAttractionDistances(position),
      };

      this.onUpdate(update);

      if (this.distanceCovered >= this.totalDistance) {
        this.stop();
      }
    }, this.tickMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.distanceCovered = 0;
  }

  private buildCumulativeDist(coords: Coordinates[]): number[] {
    const result = [0];
    for (let i = 1; i < coords.length; i++) {
      result.push(result[i - 1] + haversineDistance(coords[i - 1], coords[i]));
    }
    return result;
  }

  private interpolatePosition(dist: number): Coordinates {
    if (this.geometry.length === 1) return this.geometry[0];

    let lo = 0;
    let hi = this.cumulativeDist.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumulativeDist[mid + 1] < dist) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    const segStart = this.cumulativeDist[lo];
    const segEnd = this.cumulativeDist[lo + 1];
    const segLen = segEnd - segStart;
    if (segLen === 0) return this.geometry[lo];

    const t = (dist - segStart) / segLen;
    const a = this.geometry[lo];
    const b = this.geometry[lo + 1];
    return {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    };
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
}
