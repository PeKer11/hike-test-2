import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

import { clampPace, PACE_FACTOR, type PaceWord } from "./pace";

/** What the walker said about one stop: how long to stay, and how fast to walk the leg that arrives at it ("end" = the leg back to the start). */
export interface BreakPlan {
  /** Rest after this many minutes / km walked without a stop (a stop with a long enough stay counts as a rest). */
  everyMin?: number;
  everyKm?: number;
  /** Length of each rest. */
  minutes: number;
}

export interface StopPlan {
  dwellMin?: number;
  pace?: PaceWord | number;
  /** Earliest / latest arrival, as "HH:MM" on the day of the start. */
  arriveAfter?: string;
  arriveBefore?: string;
}

export const MAX_DWELL_MIN = 600;

/** Minutes per km for the leg that arrives at `stopId`. */
export function legPace(plans: Record<string, StopPlan> | undefined, stopId: string, basePace: number): number {
  const p = plans?.[stopId]?.pace;
  if (typeof p === "number" && Number.isFinite(p)) return clampPace(p);
  if (typeof p === "string" && p in PACE_FACTOR) return clampPace(basePace * PACE_FACTOR[p]);
  return basePace;
}

/** Minutes at a stop: the walker's own number when given (0 = just pass by), else the default for its kind. */
export function dwellMinutes(plans: Record<string, StopPlan> | undefined, stopId: string, fallback: number): number {
  const d = plans?.[stopId]?.dwellMin;
  return typeof d === "number" && Number.isFinite(d) && d >= 0 ? Math.min(d, MAX_DWELL_MIN) : fallback;
}

/**
 * Extra minutes for climbing (Naismith, scaled to the walker's pace): 1 min per 10 m at 12 min/km.
 * The first 5 m per km are ignored: the elevation data (~90 m grid) is noisy on city streets. Descents are not credited.
 */
export function climbMinutes(ascentM: number, legKm: number, paceMinPerKm: number): number {
  return Math.max(0, ascentM - 5 * legKm) * (paceMinPerKm / 120);
}

export interface TimelineStop {
  id: string;
  /** Default minutes there when the walker said nothing. */
  visitMin: number;
}

export interface Timeline {
  legs: Array<{ to: string; km: number; pace: number; min: number; restMin: number }>;
  /** Minutes since the start at which the walker reaches and leaves each stop (rests and earlier stays included). */
  at: Array<{ id: string; arriveMin: number; leaveMin: number }>;
  /** Minutes of rest put on the legs by the break plan. */
  restMin: number;
  /** Walking minutes including the extra time for climbing. */
  walkMin: number;
  climbMin: number;
  /** False when the router gave no heights, so climbing is not counted. */
  climbKnown: boolean;
  visitMin: number;
  totalMin: number;
  /** Plans for stops that are not in this walk (kept in state, applied again if the stop returns). */
  ignored: string[];
}

/**
 * Walking and visiting time for one walk. `legKms[i]` is the distance to `stops[i]`; one extra entry is the leg back to the start.
 * With no plans this is exactly km x base pace + the default visit times.
 */
export function timeline(
  stops: TimelineStop[],
  legKms: number[],
  plans: Record<string, StopPlan> | undefined,
  basePace: number,
  /** Metres climbed on each leg (same length as legKms), when known. */
  ascentsM?: number[] | null,
  breaks?: BreakPlan,
): Timeline {
  const climbKnown = Boolean(ascentsM && ascentsM.length === legKms.length);
  let sinceMin = 0;
  let sinceKm = 0;
  const legs: Timeline["legs"] = legKms.map((km, i) => {
    const to = stops[i]?.id ?? "end";
    const pace = legPace(plans, to, basePace);
    const min = km * pace + (climbKnown ? climbMinutes(ascentsM![i], km, pace) : 0);
    let restMin = 0;
    // A stop that is itself long enough to rest at replaces the rest before it.
    const stopIsRest = Boolean(breaks && stops[i] && dwellMinutes(plans, stops[i].id, stops[i].visitMin) >= breaks.minutes);
    if (breaks && breaks.minutes > 0 && to !== "end" && !stopIsRest) {
      if ((breaks.everyMin && sinceMin + min > breaks.everyMin) || (breaks.everyKm && sinceKm + km > breaks.everyKm)) {
        restMin = breaks.minutes;
        sinceMin = 0;
        sinceKm = 0;
      }
    }
    sinceMin += min;
    sinceKm += km;
    if (breaks && stops[i] && dwellMinutes(plans, stops[i].id, stops[i].visitMin) >= breaks.minutes) {
      sinceMin = 0;
      sinceKm = 0;
    }
    return { to, km, pace, min, restMin };
  });
  const climbMin = climbKnown ? legs.reduce((a, l, i) => a + climbMinutes(ascentsM![i], l.km, l.pace), 0) : 0;
  const walkMin = legs.reduce((a, l) => a + l.min, 0);
  const visitMin = stops.reduce((a, s) => a + dwellMinutes(plans, s.id, s.visitMin), 0);
  const inWalk = new Set([...stops.map((s) => s.id), "end"]);
  const ignored = Object.keys(plans ?? {}).filter((id) => !inWalk.has(id));
  const restMin = legs.reduce((a, l) => a + l.restMin, 0);
  let clock = 0;
  const at: Timeline["at"] = stops.map((s, i) => {
    clock += legs[i].min + legs[i].restMin;
    const arriveMin = clock;
    clock += dwellMinutes(plans, s.id, s.visitMin);
    return { id: s.id, arriveMin, leaveMin: clock };
  });
  return { legs, at, restMin, walkMin, climbMin, climbKnown, visitMin, totalMin: walkMin + visitMin + restMin, ignored };
}

/**
 * Distance of each leg along a route that passes `waypoints[1..]` in order (waypoints[0] is the start).
 * Each waypoint is matched to the nearest route point at or after the previous match.
 */
export function legKmsFromGeometry(geometry: Coordinates[], waypoints: Coordinates[]): number[] {
  if (geometry.length < 2 || waypoints.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) cum.push(cum[i - 1] + haversineDistance(geometry[i - 1], geometry[i]));
  const matched: number[] = [0];
  let from = 0;
  waypoints.slice(1).forEach((w, k) => {
    const last = k === waypoints.length - 2;
    let best = last ? geometry.length - 1 : from;
    if (!last) {
      let bestD = Infinity;
      for (let i = from; i < geometry.length; i++) {
        const d = haversineDistance(geometry[i], w);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    matched.push(best);
    from = best;
  });
  return matched.slice(1).map((idx, i) => (cum[idx] - cum[matched[i]]) / 1000);
}
