import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import { DEFAULT_PACE_MIN_PER_KM } from "@/lib/walk/pace";

import { LOOP_END_M, previewPathOf } from "./walk-history";
import type { SavedStop, SavedWalk } from "./saved-walks";

/** Close enough to the start to just begin. */
export const START_NOW_M = 250;
/** "Near": the start, the route, or the next stop is within a short walk. */
export const NEAR_M = 1500;
/** Beyond this it is another city: a new walk in the same style, not this route. */
export const FAR_M = 15000;
/** Approach plus walk over the original time by more than this is worth one line. */
export const OVER_BUDGET_RATIO = 1.2;

export type WalkAgainMode =
  | "start_now"
  | "resume"
  | "join_nearest"
  | "walk_to_start"
  | "reroute_from_here"
  | "same_style_here"
  | "transit_to_start"
  | "reverse"
  | "original_start_no_location";

export interface WalkAgainOption {
  mode: WalkAgainMode;
  /** Minutes to get to where the walk begins (approach), when the option has one. */
  approachMin?: number;
  /** Stops passed before the join point, which a join skips. */
  skippedStops?: number;
  /** resume: index (in the saved stops) of the next stop the walker had not reached. */
  nextStopIndex?: number;
}

export interface WalkAgainDecision {
  /** Nothing to choose: just start. */
  chooser: boolean;
  primary: WalkAgainOption;
  /** At most two. */
  alternatives: WalkAgainOption[];
  dStartM: number | null;
  dJoinM: number | null;
  dEndM: number | null;
  /** The approach plus the walk is well over the walk's own time: say so once. */
  overBudget: boolean;
}

export interface LastRun {
  finished: boolean;
  /** Index of the next stop the walker had not reached. */
  nextStopIndex: number;
}

const minutesFor = (meters: number, pace = DEFAULT_PACE_MIN_PER_KM) => Math.max(1, Math.round((meters / 1000) * pace));

/** The route to measure against: the stored one, else start, stops (and back to the start for a loop). */
export function routeOf(walk: SavedWalk): Coordinates[] {
  return walk.geometry && walk.geometry.length >= 2 ? walk.geometry : previewPathOf(walk);
}

export function isLoopWalk(walk: SavedWalk): boolean {
  if (typeof walk.isLoop === "boolean") return walk.isLoop;
  const path = previewPathOf(walk);
  const last = path[path.length - 1];
  return path.length > 1 && haversineDistance(walk.start, last) <= LOOP_END_M;
}

const walkPace = (walk: SavedWalk): number => {
  const p = walk.params?.walkingPaceMinPerKm;
  return typeof p === "number" && p > 0 ? p : DEFAULT_PACE_MIN_PER_KM;
};

/**
 * What to offer someone who wants to walk a saved walk again from where they are.
 * One default, at most two alternatives. A pure function: location, the walk, and how the last run went.
 */
export function decideWalkAgain(walk: SavedWalk, here: Coordinates | null, lastRun?: LastRun): WalkAgainDecision {
  if (!here) {
    return {
      chooser: false,
      primary: { mode: "original_start_no_location" },
      alternatives: [],
      dStartM: null,
      dJoinM: null,
      dEndM: null,
      overBudget: false,
    };
  }
  const route = routeOf(walk);
  const loop = isLoopWalk(walk);
  const pace = walkPace(walk);
  const end = walk.end ?? route[route.length - 1] ?? walk.start;
  const dStart = haversineDistance(here, walk.start);
  const dEnd = haversineDistance(here, end);
  const dJoin = route.length >= 2 ? detectDeviation(here, route, null).deviationMeters : dStart;

  const facts = { dStartM: Math.round(dStart), dJoinM: Math.round(dJoin), dEndM: Math.round(dEnd) };
  const toStart: WalkAgainOption = { mode: "walk_to_start", approachMin: minutesFor(dStart, pace) };
  const join: WalkAgainOption = { mode: "join_nearest", approachMin: minutesFor(dJoin, pace), skippedStops: skippedBy(walk, here) };
  const reverse: WalkAgainOption = { mode: "reverse" };

  const budgetMin = typeof walk.totalMin === "number" ? walk.totalMin : null;
  const over = (approachMin: number) => budgetMin !== null && budgetMin > 0 && budgetMin + approachMin > budgetMin * OVER_BUDGET_RATIO;
  const build = (primary: WalkAgainOption, alternatives: WalkAgainOption[], chooser = true): WalkAgainDecision => ({
    chooser,
    primary,
    alternatives: alternatives.slice(0, 2),
    ...facts,
    overBudget: over(primary.approachMin ?? 0),
  });

  if (dStart <= START_NOW_M) return build({ mode: "start_now" }, [], false);

  if (lastRun && !lastRun.finished && walk.stops[lastRun.nextStopIndex]) {
    const next = walk.stops[lastRun.nextStopIndex];
    if (haversineDistance(here, { lat: next.lat, lng: next.lng }) <= NEAR_M) {
      return build({ mode: "resume", nextStopIndex: lastRun.nextStopIndex }, [toStart, join]);
    }
  }

  if (loop && dJoin <= NEAR_M) return build(join, [toStart, reverse]);
  if (!loop && dStart <= NEAR_M) return build(toStart, [join]);
  if (!loop && dJoin <= NEAR_M) return build(join, dEnd < dStart ? [toStart, reverse] : [toStart]);

  if (dJoin <= FAR_M) {
    return build({ mode: "reroute_from_here" }, [toStart, { mode: "transit_to_start" }]);
  }
  return build({ mode: "same_style_here" }, [{ mode: "transit_to_start" }]);
}

/** Stops the walker has already passed, given where they join the route. */
function skippedBy(walk: SavedWalk, here: Coordinates): number {
  return splitStopsAtJoin(walk, here).passed.length;
}

/**
 * The stops ahead of a join point and the ones already passed, in walking order. A loop joined mid-way
 * continues round (ahead, then passed); a point-to-point walk drops what was passed.
 */
export function splitStopsAtJoin(walk: SavedWalk, here: Coordinates): { ahead: SavedStop[]; passed: SavedStop[] } {
  const route = routeOf(walk);
  if (route.length < 2) return { ahead: walk.stops, passed: [] };
  const joinIndex = detectDeviation(here, route, null).closestSegmentIndex;
  const ahead: SavedStop[] = [];
  const passed: SavedStop[] = [];
  for (const stop of walk.stops) {
    const at = detectDeviation({ lat: stop.lat, lng: stop.lng }, route, null).closestSegmentIndex;
    (at >= joinIndex ? ahead : passed).push(stop);
  }
  return { ahead, passed };
}

/** The stops to build through when joining at the nearest point. */
export function stopsForJoin(walk: SavedWalk, here: Coordinates): SavedStop[] {
  const { ahead, passed } = splitStopsAtJoin(walk, here);
  return isLoopWalk(walk) ? [...ahead, ...passed] : ahead;
}

/** A stop at the start, so a walk that begins where the walker is first goes there, then follows the original. */
export function startAsStop(walk: SavedWalk): SavedStop {
  return { name: walk.title, category: "other", lat: walk.start.lat, lng: walk.start.lng, visitMinutes: 0 };
}

/** The Google Maps link that takes the walker to the walk's start by public transport. */
export function transitLinkTo(start: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${start.lat},${start.lng}&travelmode=transit`;
}

/**
 * Only a build that follows the saved stops in order from the saved start is the original route, so only
 * those may be written back onto the saved walk. "From here" builds (join, walk to start, reroute) are not.
 */
export function mayBackfillGeometry(mode: WalkAgainMode): boolean {
  return mode === "start_now" || mode === "original_start_no_location";
}
