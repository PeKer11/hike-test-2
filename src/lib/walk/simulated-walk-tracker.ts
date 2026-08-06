import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance, routeDistanceBetween } from "@/lib/utils/geo";
import type { PaceUpdateHandler, PaceUpdate } from "./walk-tracker";

/** Metres per degree of latitude. Close enough anywhere for a simulated stray. */
const METERS_PER_DEGREE_LAT = 111_320;

/** A stretch of the simulated walk spent off the planned line. */
interface SimulatedStray {
  offsetMeters: number;
  /**
   * Distance along the route at which the walker rejoins it. `Infinity` means
   * they never do, which is the shape of a walker who has genuinely taken the
   * wrong street rather than stepped around a market stall.
   */
  untilDistance: number;
}

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
  private stray: SimulatedStray | null = null;

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

      const position = this.positionAt(this.distanceCovered);

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
    this.stray = null;
  }

  /**
   * Walk off the planned line, starting on the next tick.
   *
   * The point is that the deviation → re-route → notification chain has never
   * been exercisable without real GPS drift: this tracker only ever reported
   * positions interpolated along the route's own geometry, so
   * `detectDeviation` measured zero by construction and `OffRouteNotification`
   * could only be seen by faking the state it renders from. What comes out of
   * here is still an ordinary position stream through the same
   * `PaceUpdateHandler` — nothing downstream is told it is being tested.
   *
   * The offset is applied perpendicular to the segment the walker is on, which
   * is exactly `offsetMeters` from *that* segment. Where the route doubles back
   * on itself the nearest point may lie on a different segment and the measured
   * deviation come out smaller — a straight stretch is the honest place to
   * point this at.
   *
   * @param offsetMeters how far off the line. The re-route threshold is 50 m.
   * @param forMeters   route distance to cover before rejoining. Omit to stray
   *                    for the rest of the walk.
   */
  strayOffRoute(offsetMeters: number, forMeters: number = Infinity): void {
    if (!Number.isFinite(offsetMeters) || offsetMeters === 0) return;

    this.stray = {
      offsetMeters,
      untilDistance:
        forMeters === Infinity ? Infinity : this.distanceCovered + forMeters,
    };
  }

  /** Rejoin the route now, whatever `strayOffRoute` said about when. */
  returnToRoute(): void {
    this.stray = null;
  }

  /** Whether the reported position is currently off the planned line. */
  get isStraying(): boolean {
    return this.stray !== null;
  }

  /**
   * The position to report for a distance along the route: on the line, or
   * offset from it while a stray is running. A stray that has run its course
   * is cleared here rather than on a timer, so it ends where it said it would
   * however fast the simulation is playing.
   */
  private positionAt(dist: number): Coordinates {
    const onRoute = this.interpolatePosition(dist);

    if (this.stray === null) return onRoute;
    if (dist >= this.stray.untilDistance) {
      this.stray = null;
      return onRoute;
    }

    return this.offsetFromRoute(onRoute, dist, this.stray.offsetMeters);
  }

  /** `onRoute` pushed sideways off the segment it sits on. */
  private offsetFromRoute(
    onRoute: Coordinates,
    dist: number,
    offsetMeters: number,
  ): Coordinates {
    const index = this.segmentIndexAt(dist);
    const a = this.geometry[index];
    const b = this.geometry[index + 1];
    if (!a || !b) return onRoute;

    const metersPerLng =
      METERS_PER_DEGREE_LAT * Math.cos((onRoute.lat * Math.PI) / 180);
    if (metersPerLng === 0) return onRoute;

    const eastward = (b.lng - a.lng) * metersPerLng;
    const northward = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
    const length = Math.hypot(eastward, northward);
    if (length === 0) return onRoute;

    // The heading rotated a quarter turn. Which of the two sides it picks does
    // not matter — the detector measures distance from the route, not which
    // way the walker left it.
    return {
      lat: onRoute.lat + ((eastward / length) * offsetMeters) / METERS_PER_DEGREE_LAT,
      lng: onRoute.lng - ((northward / length) * offsetMeters) / metersPerLng,
    };
  }

  private buildCumulativeDist(coords: Coordinates[]): number[] {
    const result = [0];
    for (let i = 1; i < coords.length; i++) {
      result.push(result[i - 1] + haversineDistance(coords[i - 1], coords[i]));
    }
    return result;
  }

  /** Index of the geometry segment a distance along the route falls in. */
  private segmentIndexAt(dist: number): number {
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
    return lo;
  }

  private interpolatePosition(dist: number): Coordinates {
    if (this.geometry.length === 1) return this.geometry[0];

    const lo = this.segmentIndexAt(dist);

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
