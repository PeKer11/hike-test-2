import type { Coordinates } from "@/lib/types";
import {
  bearingBetween,
  closestPointOnSegment,
  haversineDistance,
} from "@/lib/utils/geo";

/** Distance along the geometry to each vertex; `[0]` is always 0. */
export function cumulativeDistances(geometry: Coordinates[]): number[] {
  const result: number[] = [];
  let total = 0;
  for (let i = 0; i < geometry.length; i += 1) {
    if (i > 0) total += haversineDistance(geometry[i - 1], geometry[i]);
    result.push(total);
  }
  return result;
}

/** How far along the route the walker is, given the matched segment and point. */
export function progressAlong(
  geometry: Coordinates[],
  segmentIndex: number,
  closestPoint: Coordinates,
): { walkedM: number; remainingM: number } {
  if (geometry.length < 2) return { walkedM: 0, remainingM: 0 };
  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1];
  const idx = Math.min(Math.max(segmentIndex, 0), geometry.length - 2);
  const walkedM = Math.min(
    total,
    cumulative[idx] + haversineDistance(geometry[idx], closestPoint),
  );
  return { walkedM, remainingM: Math.max(0, total - walkedM) };
}

/**
 * Minutes left. The measured speed is only believed when it is within 0.5x–1.5x
 * of the planned one; outside that it is more likely a stop, a lull or noise
 * than a new pace, so the plan's own pace is used instead.
 */
export function timeToFinishMin(args: {
  remainingM: number;
  kmh: number | null;
  plannedPace: number;
  remainingVisitMin: number;
}): number {
  const plannedKmh = 60 / args.plannedPace;
  const usable =
    args.kmh !== null &&
    args.kmh >= plannedKmh * 0.5 &&
    args.kmh <= plannedKmh * 1.5;
  const kmh = usable ? (args.kmh as number) : plannedKmh;
  return (args.remainingM / 1000 / kmh) * 60 + args.remainingVisitMin;
}

export type PaceTone = "good" | "warn" | "bad";

/** Slower than plan is what costs the walker; faster is never flagged. */
export function paceBarTone(kmh: number | null, plannedPace: number): PaceTone {
  if (kmh === null) return "good";
  if (kmh <= 0) return "bad";
  const slowness = 60 / plannedPace / kmh; // 1 = on plan, >1 = slower
  if (slowness <= 1.15) return "good";
  if (slowness <= 1.3) return "warn";
  return "bad";
}

/** Whether `position` is within `radiusM` of any of the given stops. */
export function isNearAnyStop(
  position: Coordinates,
  stops: ReadonlyArray<{ coordinates: Coordinates }>,
  radiusM: number,
): boolean {
  return stops.some((s) => haversineDistance(position, s.coordinates) <= radiusM);
}

// A stop further than this from the line is not "on" the route, so it does not
// bound where a rejoin may happen.
const STOP_ON_ROUTE_METERS = 80;

/**
 * Route distance, from the walker's matched point, to the nearest stop still
 * ahead of them — or null if none is. A rejoin must not land past it, or it
 * would skip a stop the walker has not visited.
 */
export function nextStopAlongM(
  geometry: Coordinates[],
  segmentIndex: number,
  matchedPoint: Coordinates,
  stops: Coordinates[],
): number | null {
  if (geometry.length < 2) return null;
  const cumulative = cumulativeDistances(geometry);
  const startSeg = Math.min(Math.max(segmentIndex, 0), geometry.length - 2);
  const walkedM =
    cumulative[startSeg] + haversineDistance(geometry[startSeg], matchedPoint);

  let best: number | null = null;
  for (const stop of stops) {
    let nearest = Number.POSITIVE_INFINITY;
    let stopAlong = 0;
    for (let seg = startSeg; seg < geometry.length - 1; seg += 1) {
      const p = closestPointOnSegment(stop, geometry[seg], geometry[seg + 1]);
      const d = haversineDistance(stop, p);
      if (d < nearest) {
        nearest = d;
        stopAlong = cumulative[seg] + haversineDistance(geometry[seg], p);
      }
    }
    if (nearest > STOP_ON_ROUTE_METERS) continue;
    const ahead = stopAlong - walkedM;
    if (ahead < 0) continue;
    if (best === null || ahead < best) best = ahead;
  }
  return best;
}

/**
 * Which way the route runs just ahead of `point` (bearing over the next
 * `lookaheadM` metres, default 30). Steadier than a heading taken from GPS
 * fixes, so it is what "left / right / ahead" is measured against on the route.
 * Null if the route has nothing ahead.
 */
export function routeDirectionDeg(
  geometry: Coordinates[],
  segmentIndex: number,
  point: Coordinates,
  lookaheadM = 30,
): number | null {
  if (geometry.length < 2) return null;
  const startSeg = Math.min(Math.max(segmentIndex, 0), geometry.length - 2);
  let from = point;
  let travelled = 0;
  for (let seg = startSeg; seg < geometry.length - 1; seg += 1) {
    const to = geometry[seg + 1];
    const len = haversineDistance(from, to);
    if (travelled + len >= lookaheadM && len > 0) {
      const t = (lookaheadM - travelled) / len;
      const target = {
        lat: from.lat + t * (to.lat - from.lat),
        lng: from.lng + t * (to.lng - from.lng),
      };
      return bearingBetween(point, target);
    }
    travelled += len;
    from = to;
  }
  const end = geometry[geometry.length - 1];
  return haversineDistance(point, end) >= 1 ? bearingBetween(point, end) : null;
}

// Allowance for the detour not being a straight line.
const DETOUR_WINDING = 1.25;

/**
 * Minutes a visit costs: out to the place and back (with a winding allowance)
 * at the walker's planned pace, plus the time spent there.
 */
export function detourMinutes(
  distanceM: number,
  plannedPaceMinPerKm: number,
  avgVisitMinutes: number,
): number {
  const metersPerMin = 1000 / plannedPaceMinPerKm;
  return Math.round((2 * distanceM * DETOUR_WINDING) / metersPerMin + avgVisitMinutes);
}
