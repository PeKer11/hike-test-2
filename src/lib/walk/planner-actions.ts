/**
 * Decisions the planner screen makes on the walker's behalf, pulled out of the
 * component so they can be exercised without a map, a GPS stream, or a render.
 * Nothing here touches React state — callers pass in what they have and apply
 * what comes back.
 */

import type { Attraction, Coordinates } from "@/lib/types";
import type { WalkSettings } from "@/lib/types/walk-settings";
import {
  replanPaceDirection,
  SLOW_PACE_RATIO,
  type ReplanReason,
} from "@/lib/walk/replan-trigger";
import type { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import { haversineDistance } from "@/lib/utils/geo";

/**
 * The only fields a pace rebuild reads. Deliberately narrower than the caller's
 * full walk input, which is carried through unchanged so the rebuild can't drop
 * a field it doesn't know about.
 */
export interface RebuildInput {
  origin: Coordinates;
  availableMinutes: number;
  /** Read only by the "more time" rebuild, as the floor for an unmeasured pace. */
  walkingPaceMinPerKm: number;
  endAnchor?: Coordinates;
}

/** The shape `handleBuildWalk` takes for how to build it. */
export interface BuildWalkOptions {
  autoResume?: boolean;
  resumeTracking?: boolean;
  keepAttractions?: Attraction[];
  pinnedIds?: string[];
  fillRemainingTime?: boolean;
}

/**
 * A pace rebuild never re-times a walk down to nothing: whatever the clock
 * says, the walker gets a route worth walking rather than a two-minute stub.
 */
export const MIN_REBUILD_MINUTES = 15;

export interface PaceRebuildState<TInput extends RebuildInput> {
  originalInput: TInput;
  /** When the current walk started, ms since epoch. */
  walkStartTime: number;
  /** Now, ms since epoch — injected so this stays deterministic. */
  now: number;
  /** Latest GPS fix, or null before one has arrived. */
  currentPosition: Coordinates | null;
  settings: WalkSettings;
  /** The stops the walker is currently heading to. */
  currentAttractions?: Attraction[];
  pinnedIds: string[];
  /**
   * The pace the walker is actually managing, min/km, from the latest
   * `PaceUpdate` — null until enough samples have accumulated, and null for a
   * walker who has stopped altogether.
   */
  currentPaceMinPerKm?: number | null;
}

/**
 * What a pace trigger should rebuild, given where the walk actually is.
 *
 * The direction decides whether discovery runs. Behind plan, the answer is to
 * re-time what is left. Ahead of plan, the whole offer — in the banner and in
 * the setting's own wording — is another stop, so the rebuild has to be allowed
 * to find one.
 */
export function buildPaceRebuildRequest<TInput extends RebuildInput>(
  reason: ReplanReason,
  state: PaceRebuildState<TInput>,
): { input: TInput; options: BuildWalkOptions } {
  return buildMidWalkRebuildRequest(state, {
    fillRemainingTime: replanPaceDirection(reason) === "fast",
  });
}

/**
 * What an off-route trigger should rebuild.
 *
 * Shares `buildMidWalkRebuildRequest` with the pace path rather than
 * reimplementing it, because the hard parts really are the same question:
 * start from where the walker actually is, keep the stops they have not
 * reached, re-time against the clock they have left, and leave the end anchor
 * where the car is. The only genuine difference is discovery — a walker who is
 * lost wants the route they already chose redrawn to reach them, not a longer
 * one with an extra stop bolted on — and that is one boolean, which is exactly
 * the seam the shared helper exposes.
 */
export function buildDeviationRebuildRequest<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
): { input: TInput; options: BuildWalkOptions } {
  return buildMidWalkRebuildRequest(state, { fillRemainingTime: false });
}

/**
 * Straight line to street network. Every leg below is measured as the crow
 * flies, but the walk is done on pavements that turn corners, so a budget built
 * from raw haversine legs would be short of the distance actually walked. The
 * planner itself measures with an ORS matrix and only falls back to haversine,
 * so this is the correction that keeps the two comparable — without it the
 * extension would be too small to hold the stops it was asked to hold.
 */
export const STRAIGHT_LINE_TO_STREET_FACTOR = 1.25;

/**
 * What a "give me more time" answer should rebuild.
 *
 * The plain slow-pace rebuild re-times the remaining stops against the budget
 * the walker set before they started — original total minus elapsed. For a
 * walker who has since slowed down that is *less* time than the same stops
 * needed at the original pace, which is precisely how a stop gets dropped. This
 * path answers the other question: not "what still fits in the time I said",
 * but "how much time do I actually need to keep all of it".
 *
 * The number is the planner's own feasibility sum, recomputed at the pace the
 * walker is really managing: for the chain current position → each remaining
 * stop in plan order, the crow-flies leg corrected to street distance, priced
 * at the measured pace, plus each stop's own visit minutes. No return leg — the
 * end anchor is a distance constraint, not a stop, and the planner does not
 * bill for it either.
 *
 * Never returns less than the plain rebuild would: "more time" is an answer
 * that can only add. When the pace has not been measured yet (too few samples,
 * or a full stop, where the measured pace is null or meaningless), the floor is
 * the slowest pace that could have raised the question at all —
 * `SLOW_PACE_RATIO` × the planned one. That is a real, conservative reading of
 * the trigger rather than an invented constant, and a walker who is slower than
 * that still gets a longer walk than the plain path would have given them.
 */
export function buildExtendedTimeRebuildRequest<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
): { input: TInput; options: BuildWalkOptions } {
  return buildMidWalkRebuildRequest(state, {
    fillRemainingTime: false,
    extendToFitRemainingStops: true,
  });
}

function minutesToFinishRemainingStops<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
): number {
  const stops = state.currentAttractions ?? [];
  if (stops.length === 0) return 0;

  const { originalInput: orig } = state;
  const measured = state.currentPaceMinPerKm;
  const paceMinPerKm =
    measured !== null && measured !== undefined && measured > 0
      ? Math.max(measured, orig.walkingPaceMinPerKm * SLOW_PACE_RATIO)
      : orig.walkingPaceMinPerKm * SLOW_PACE_RATIO;

  let from = state.currentPosition ?? orig.origin;
  let walkMinutes = 0;
  let visitMinutes = 0;
  for (const stop of stops) {
    const legMeters =
      haversineDistance(from, stop.coordinates) * STRAIGHT_LINE_TO_STREET_FACTOR;
    walkMinutes += (legMeters / 1000) * paceMinPerKm;
    visitMinutes += stop.avgVisitMinutes;
    from = stop.coordinates;
  }

  return walkMinutes + visitMinutes;
}

function buildMidWalkRebuildRequest<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
  {
    fillRemainingTime,
    extendToFitRemainingStops = false,
  }: { fillRemainingTime: boolean; extendToFitRemainingStops?: boolean },
): { input: TInput; options: BuildWalkOptions } {
  const { originalInput: orig } = state;
  const elapsedMinutes = (state.now - state.walkStartTime) / 60_000;
  const remainingMinutes = Math.max(
    MIN_REBUILD_MINUTES,
    orig.availableMinutes - elapsedMinutes,
    extendToFitRemainingStops ? minutesToFinishRemainingStops(state) : 0,
  );

  return {
    input: {
      ...orig,
      origin: state.currentPosition ?? orig.origin,
      availableMinutes: remainingMinutes,
      // The walk moved; the car did not. Pin the end-distance constraint to
      // wherever it was already anchored, or to the start of this walk if this
      // is the first rebuild — never to the walker's current position.
      endAnchor: orig.endAnchor ?? orig.origin,
    },
    options: {
      autoResume: true,
      resumeTracking: state.settings.autoResumeAfterRebuild,
      // Keep the walk the user is already on rather than rediscovering it.
      keepAttractions: state.currentAttractions,
      pinnedIds: state.pinnedIds,
      fillRemainingTime,
    },
  };
}

/**
 * How a user-initiated build treats the stops named in the place prompt.
 *
 * Returns `undefined` when there is nothing named, which is what tells the API
 * to run ordinary discovery. Leftover time on its own is never a reason to
 * insert more stops — only the walker ticking the box is.
 */
export function promptWalkBuildOptions(
  promptAttractions: Attraction[] | null,
  fillRemainingTime: boolean,
): BuildWalkOptions | undefined {
  if (!promptAttractions || promptAttractions.length === 0) return undefined;

  return {
    keepAttractions: promptAttractions,
    fillRemainingTime,
  };
}

/**
 * Flip the simulated walker on or off the planned line, and report where it
 * ended up so the button's label can follow.
 *
 * Asynchronous because sending them off it means asking ORS for a real path
 * away and back; it resolves once the detour is walkable, or once the
 * synthetic-offset fallback has taken over for a routing call that failed.
 * Rejoining stays immediate, and cancels an in-flight request.
 */
export async function toggleSimulatedStray(
  tracker: SimulatedWalkTracker,
  strayMeters: number,
): Promise<boolean> {
  if (tracker.isStraying) {
    tracker.returnToRoute();
    return false;
  }

  await tracker.strayOffRoute(strayMeters);
  return tracker.isStraying;
}

/** Which way the simulated walker's pace has been pushed, if at all. */
export type SimulatedPaceDrift = "slow" | "fast" | null;

/**
 * Comfortably past the 1.3× / 0.77× re-plan ratios rather than sitting on them,
 * so the trigger fires on the drift and not on where GPS noise rounded.
 */
export const SIMULATED_SLOW_PACE_FACTOR = 1.6;
export const SIMULATED_FAST_PACE_FACTOR = 0.6;

/**
 * Put the simulated walker on a drifted pace, or back on the planned one, and
 * report which so the buttons' state can follow.
 */
export function setSimulatedPaceDrift(
  tracker: SimulatedWalkTracker,
  drift: SimulatedPaceDrift,
): SimulatedPaceDrift {
  if (drift === null) {
    tracker.resetPace();
    return null;
  }

  const factor =
    drift === "slow" ? SIMULATED_SLOW_PACE_FACTOR : SIMULATED_FAST_PACE_FACTOR;
  tracker.setPace(tracker.plannedPace * factor);
  return drift;
}
