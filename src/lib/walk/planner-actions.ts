/**
 * Decisions the planner screen makes on the walker's behalf, pulled out of the
 * component so they can be exercised without a map, a GPS stream, or a render.
 * Nothing here touches React state — callers pass in what they have and apply
 * what comes back.
 */

import type { Attraction, Coordinates } from "@/lib/types";
import type { WalkSettings } from "@/lib/types/walk-settings";
import { replanPaceDirection, type ReplanReason } from "@/lib/walk/replan-trigger";
import type { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";

/**
 * The only fields a pace rebuild reads. Deliberately narrower than the caller's
 * full walk input, which is carried through unchanged so the rebuild can't drop
 * a field it doesn't know about.
 */
export interface RebuildInput {
  origin: Coordinates;
  availableMinutes: number;
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
  const { originalInput: orig } = state;
  const elapsedMinutes = (state.now - state.walkStartTime) / 60_000;
  const remainingMinutes = Math.max(
    MIN_REBUILD_MINUTES,
    orig.availableMinutes - elapsedMinutes,
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
      fillRemainingTime: replanPaceDirection(reason) === "fast",
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
 */
export function toggleSimulatedStray(
  tracker: SimulatedWalkTracker,
  strayMeters: number,
): boolean {
  if (tracker.isStraying) {
    tracker.returnToRoute();
    return false;
  }

  tracker.strayOffRoute(strayMeters);
  return true;
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
