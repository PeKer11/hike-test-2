import type { Attraction, Coordinates, OrsDirectionsResponse } from "@/lib/types";
import { haversineDistance, routeDistanceBetween, toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type { PaceUpdateHandler, PaceUpdate } from "./walk-tracker";

/** Metres per degree of latitude. Close enough anywhere for a simulated stray. */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * How far along the planned route a detour rejoins it when the caller does not
 * say. A routed detour has to end somewhere — ORS is asked for a path, not for
 * a direction to wander in — so `Infinity` is not a thing it can express. 300 m
 * is roughly two or three urban blocks: far enough that the routed way back is
 * a genuinely different set of streets rather than a U-turn on the same one,
 * and short enough that at the simulator's 10× playback the whole detour is
 * over in well under a minute of watching.
 */
export const DEFAULT_DETOUR_METERS = 300;

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

/**
 * A real walkable path away from the route and back, as ORS routed it.
 *
 * The tracker walks this geometry instead of the planned one while it is set,
 * with its own cumulative-distance table, and picks the planned route back up
 * at `rejoinDistance` when it runs out.
 */
interface ActiveDetour {
  geometry: Coordinates[];
  cumulativeDist: number[];
  totalDistance: number;
  distanceAlong: number;
  /** Distance along the *planned* route where this detour comes back. */
  rejoinDistance: number;
}

/** Where a stray is in its life: nothing, waiting on ORS, or being walked. */
export type StrayStatus = "idle" | "loading" | "active";

/** What a stray ended up being: a real routed path, or the synthetic offset. */
export type StrayMode = "detour" | "synthetic" | null;

export class SimulatedWalkTracker {
  private geometry: Coordinates[];
  private attractions: Attraction[];
  private paceMinPerKm: number;
  private readonly plannedPaceMinPerKm: number;
  private speedMultiplier: number;
  private tickMs: number;
  private onUpdate: PaceUpdateHandler;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private distanceCovered: number = 0;
  private simulatedTime: number = 0;
  private cumulativeDist: number[];
  private totalDistance: number;
  private stray: SimulatedStray | null = null;
  private detour: ActiveDetour | null = null;
  private detourLoading: boolean = false;
  private detourError: string | null = null;
  /**
   * Bumped by anything that cancels a stray. An in-flight detour fetch compares
   * the value it started with against this before installing itself, so a
   * `returnToRoute()` or `stop()` during the request wins over the response
   * that lands afterwards.
   */
  private strayGeneration: number = 0;
  private detourAbort: AbortController | null = null;

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
    this.plannedPaceMinPerKm = paceMinPerKm;
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

    // Time compression is the walker's own doing, not the pace's: a tick is
    // always the same slice of simulated time, whatever speed they walk it at.
    const simMsPerTick = this.tickMs * this.speedMultiplier;

    this.intervalId = setInterval(() => {
      this.simulatedTime += simMsPerTick;

      const position = this.advance();

      const update: PaceUpdate = {
        currentPosition: position,
        accuracyMeters: 5,
        paceMinPerKm: this.paceMinPerKm,
        timestamp: this.simulatedTime,
        attractionDistances: this.computeAttractionDistances(position),
      };

      this.onUpdate(update);

      if (this.detour === null && this.distanceCovered >= this.totalDistance) {
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
    this.cancelStray();
    this.paceMinPerKm = this.plannedPaceMinPerKm;
  }

  /**
   * Move the walker on by one tick and say where they now are.
   *
   * Two geometries, one clock: while a detour is installed the tick spends its
   * metres on the detour's own cumulative table and the planned route's
   * `distanceCovered` is left exactly where the walker left it. Running out of
   * detour is what puts them back — at `rejoinDistance`, the planned route's
   * distance for the point the detour was routed to, so the walk carries on
   * from where they actually came out rather than from where they went in.
   */
  private advance(): Coordinates {
    const detour = this.detour;
    if (detour !== null) {
      detour.distanceAlong += this.metersPerTick();

      if (detour.distanceAlong < detour.totalDistance) {
        return interpolateAlong(
          detour.geometry,
          detour.cumulativeDist,
          detour.distanceAlong,
        );
      }

      this.detour = null;
      this.distanceCovered = Math.min(detour.rejoinDistance, this.totalDistance);
      return this.positionAt(this.distanceCovered);
    }

    // Read the pace per tick, not once at `start`, so `setPace` takes effect
    // mid-walk.
    this.distanceCovered = Math.min(
      this.distanceCovered + this.metersPerTick(),
      this.totalDistance,
    );
    return this.positionAt(this.distanceCovered);
  }

  /** e.g. 15 min/km → 1.11 m/s real → ×10 = 11.1 m/s simulated. */
  private metersPerTick(): number {
    return (1000 / (this.paceMinPerKm * 60)) * this.speedMultiplier * (this.tickMs / 1000);
  }

  /**
   * Walk the rest of the route at a different pace, starting on the next tick.
   *
   * This moves how far the walker actually gets per tick, not just the
   * `paceMinPerKm` field on the update — and that is the whole point rather
   * than an implementation detail. `ReplanTrigger` derives the pace it judges
   * from the positions and timestamps it is handed; it never reads the reported
   * pace field. A drift that only relabelled that field would leave the walker
   * covering exactly as much ground as before and nothing downstream would move.
   * So the dot does visibly slow down or speed up, which is also the honest
   * picture: a slow walker covers less ground in the same time. Time compression
   * stays `speedMultiplier`'s job alone, so the *simulated* pace the trigger
   * measures is exactly what was asked for here, at any playback speed.
   *
   * @param paceMinPerKm minutes per kilometre. The re-plan thresholds are 1.3×
   *                     the planned pace on the slow side and 0.77× on the fast.
   */
  setPace(paceMinPerKm: number): void {
    if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) return;
    this.paceMinPerKm = paceMinPerKm;
  }

  /** Back to the pace the walk was planned at. */
  resetPace(): void {
    this.paceMinPerKm = this.plannedPaceMinPerKm;
  }

  /** The pace currently being walked and reported. */
  get currentPaceMinPerKm(): number {
    return this.paceMinPerKm;
  }

  /** The pace the walk was planned at, whatever is being walked now. */
  get plannedPace(): number {
    return this.plannedPaceMinPerKm;
  }

  /**
   * Walk off the planned line and back, along streets ORS actually routed.
   *
   * The point is that the deviation → re-route → notification chain has never
   * been exercisable without real GPS drift: this tracker only ever reported
   * positions interpolated along the route's own geometry, so
   * `detectDeviation` measured zero by construction and `OffRouteNotification`
   * could only be seen by faking the state it renders from. What comes out of
   * here is still an ordinary position stream through the same
   * `PaceUpdateHandler` — nothing downstream is told it is being tested.
   *
   * This used to be a perpendicular offset applied to the reported position:
   * a parallel line that tracked the route exactly and snapped back onto it.
   * It read as a dot sliding sideways and returning, not as somebody walking a
   * different street, so the whole thing was asked for again as a real detour.
   * Three points go to ORS:
   *
   * - **A** — where the walker is now.
   * - **B** — `offsetMeters` perpendicular to the segment under A, used only as
   *   a target for ORS to route *through*. It is passed at face value: ORS
   *   snaps it to the nearest walkable way, so how far off the route the
   *   detour really goes is the street grid's answer, not this number's, and
   *   inflating it would just pick a different street.
   * - **C** — `forMeters` further along the planned route, where they rejoin.
   *
   * Awaiting this resolves when the detour is installed (or has failed over);
   * `strayStatus` is `"loading"` until then and the walker stays on the line.
   *
   * @param offsetMeters how far off the line B is placed. The re-route
   *                     threshold the detector applies is 50 m.
   * @param forMeters    route distance between A and the rejoin point C.
   * @returns whether a real routed detour is now being walked. `false` means
   *          the synthetic offset took over — the walk never stops for this.
   */
  async strayOffRoute(
    offsetMeters: number,
    forMeters: number = DEFAULT_DETOUR_METERS,
  ): Promise<boolean> {
    if (!Number.isFinite(offsetMeters) || offsetMeters === 0) return false;
    if (this.geometry.length < 2) return false;

    const generation = ++this.strayGeneration;
    this.detourLoading = true;
    this.detourError = null;

    const span = Number.isFinite(forMeters) ? forMeters : DEFAULT_DETOUR_METERS;
    const startDistance = this.distanceCovered;
    const rejoinDistance = Math.min(startDistance + span, this.totalDistance);

    const a = this.interpolatePosition(startDistance);
    const b = this.offsetFromRoute(a, startDistance, offsetMeters);
    const c = this.interpolatePosition(rejoinDistance);

    const abort = new AbortController();
    this.detourAbort = abort;

    try {
      const geometry = await fetchDetourGeometry([a, b, c], abort.signal);

      // Cancelled while the request was in flight — the walker is back on the
      // route by now and installing this would drag them off it again.
      if (generation !== this.strayGeneration) return false;

      this.detour = {
        geometry,
        cumulativeDist: buildCumulativeDist(geometry),
        totalDistance: 0,
        distanceAlong: 0,
        rejoinDistance,
      };
      this.detour.totalDistance =
        this.detour.cumulativeDist[this.detour.cumulativeDist.length - 1] ?? 0;
      this.stray = null;
      return true;
    } catch (error) {
      if (generation !== this.strayGeneration) return false;

      // Best-effort, like the rest of this codebase's network work: a walk
      // simulation that dies because a routing key is missing in dev is worse
      // than one that falls back to the old sideways nudge. The caller can
      // still tell the two apart via `strayMode` / `detourError`.
      this.detourError =
        error instanceof Error ? error.message : "Could not route a detour.";
      this.stray = {
        offsetMeters,
        untilDistance: rejoinDistance,
      };
      return false;
    } finally {
      if (generation === this.strayGeneration) {
        this.detourLoading = false;
        this.detourAbort = null;
      }
    }
  }

  /** Rejoin the route now, whatever `strayOffRoute` said about when. */
  returnToRoute(): void {
    this.cancelStray();
  }

  /** Drop every trace of a stray, in flight or on the ground. */
  private cancelStray(): void {
    this.strayGeneration += 1;
    this.detourAbort?.abort();
    this.detourAbort = null;
    this.detourLoading = false;
    this.detour = null;
    this.stray = null;
  }

  /**
   * Whether a stray is running at all — including one still waiting on ORS, so
   * that a second click on the button cancels a slow request rather than
   * queueing another one behind it.
   */
  get isStraying(): boolean {
    return this.stray !== null || this.detour !== null || this.detourLoading;
  }

  /** Where the stray is in its life, for a button that has to say so. */
  get strayStatus(): StrayStatus {
    if (this.detourLoading) return "loading";
    return this.stray !== null || this.detour !== null ? "active" : "idle";
  }

  /** Whether the running stray is a real routed detour or the fallback offset. */
  get strayMode(): StrayMode {
    if (this.detour !== null) return "detour";
    return this.stray !== null ? "synthetic" : null;
  }

  /** Why the last detour request failed, if it did. */
  get lastDetourError(): string | null {
    return this.detourError;
  }

  /**
   * The position to report for a distance along the route: on the line, or
   * offset from it while the *synthetic* fallback stray is running. A stray
   * that has run its course is cleared here rather than on a timer, so it ends
   * where it said it would however fast the simulation is playing. A real
   * routed detour never reaches this — it is walked by `advance()` instead.
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
    return buildCumulativeDist(coords);
  }

  /** Index of the geometry segment a distance along the route falls in. */
  private segmentIndexAt(dist: number): number {
    return segmentIndexAt(this.cumulativeDist, dist);
  }

  private interpolatePosition(dist: number): Coordinates {
    return interpolateAlong(this.geometry, this.cumulativeDist, dist);
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

function buildCumulativeDist(coords: Coordinates[]): number[] {
  const result = [0];
  for (let i = 1; i < coords.length; i++) {
    result.push(result[i - 1] + haversineDistance(coords[i - 1], coords[i]));
  }
  return result;
}

/** Index of the segment a distance along `cumulativeDist` falls in. */
function segmentIndexAt(cumulativeDist: number[], dist: number): number {
  let lo = 0;
  let hi = cumulativeDist.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeDist[mid + 1] < dist) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * A point a given distance along a polyline. Takes its geometry and table as
 * arguments rather than reading the tracker's, because a detour is walked the
 * same way as the planned route and only differs in which pair it is handed.
 */
function interpolateAlong(
  geometry: Coordinates[],
  cumulativeDist: number[],
  dist: number,
): Coordinates {
  if (geometry.length === 1) return geometry[0];

  const lo = segmentIndexAt(cumulativeDist, dist);

  const segStart = cumulativeDist[lo];
  const segEnd = cumulativeDist[lo + 1];
  const segLen = segEnd - segStart;
  if (segLen === 0) return geometry[lo];

  const t = (dist - segStart) / segLen;
  const a = geometry[lo];
  const b = geometry[lo + 1];
  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

interface DirectionsErrorResponse {
  error?: string;
}

/**
 * The walkable path through A → B → C, as ORS routes it.
 *
 * Goes through `/api/directions` rather than `@/lib/api/ors-client` directly,
 * for the same reason `route-planner.ts` does: the client is `server-only` and
 * holds the key, and the tracker runs in the browser.
 */
async function fetchDetourGeometry(
  waypoints: Coordinates[],
  signal: AbortSignal,
): Promise<Coordinates[]> {
  const response = await fetch("/api/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile: "foot-walking",
      instructions: false,
      coordinates: waypoints.map(toOrsCoord),
    }),
    signal,
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({}))) as DirectionsErrorResponse;
    throw new Error(body.error ?? `Detour request failed (${response.status})`);
  }

  const directions = (await response.json()) as OrsDirectionsResponse;
  const route = directions.routes?.[0];
  if (!route) {
    throw new Error("No walkable detour exists around this point.");
  }

  const geometry = decodePolyline(route.geometry);
  if (geometry.length < 2) {
    throw new Error("The routing service returned an empty detour.");
  }

  return geometry;
}
