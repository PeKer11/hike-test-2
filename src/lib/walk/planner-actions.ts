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
import {
  angleDifference,
  bearingBetween,
  haversineDistance,
} from "@/lib/utils/geo";

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
 * Half-angle of the cone that counts as "still ahead of me".
 *
 * 90° is not a tuned number, it is the definition: the question a heading asks
 * of a stop is only ever "is this behind me?", and behind is the half-plane, so
 * the boundary is the perpendicular. A stop at 85° off the heading is directly
 * to the walker's side — reaching it is a turn, not a walk back the way they
 * came — and dropping it would throw away a stop they can still have.
 *
 * Deliberately wider than `PoiAlerter`'s `DIRECTION_TOLERANCE_DEG` of 70, which
 * answers a different question. That one decides whether to interrupt someone
 * about a POI they would have to look for, so it wants things comfortably in
 * front. This one decides whether to delete a stop the walker already chose,
 * where the cost of being wrong runs the other way.
 */
export const HEADING_FORWARD_CONE_DEG = 90;

/**
 * The stops a walker heading this way can still reach without turning round.
 *
 * Pins survive the cone whatever their bearing, and that ordering is the point:
 * a pin is something the walker said, a heading is something we inferred from
 * their GPS trace. When the two disagree — they pinned the cathedral and then
 * walked away from it — the one they typed wins. It is the same rule the
 * planner already follows in refusing to drop a pinned stop even when it makes
 * the plan infeasible.
 */
export function stopsAheadOfHeading(
  from: Coordinates,
  heading: number,
  stops: Attraction[],
  pinnedIds: string[],
): Attraction[] {
  const pinned = new Set(pinnedIds);

  return stops.filter((stop) => {
    if (pinned.has(stop.id)) return true;

    return (
      angleDifference(bearingBetween(from, stop.coordinates), heading) <=
      HEADING_FORWARD_CONE_DEG
    );
  });
}

/**
 * What an *unanswered* off-route question should rebuild, for a walker who has
 * kept walking the same way while it stood.
 *
 * The third answer to a question that used to have two. Silence has always
 * meant "keep the old route", because rebuilding someone's walk when they did
 * not look at their phone is the wrong default — but a walker who spent the
 * whole 90 seconds holding one direction away from the route is not a walker
 * who missed the banner, and the route they are being kept on is one they have
 * visibly stopped walking. The other old answer is no better: redrawing from
 * wherever they were standing anchors the new plan at a point and ignores that
 * they are still moving.
 *
 * Composes with `buildDeviationRebuildRequest` rather than replacing it —
 * origin is still the current position, the end anchor is still wherever the
 * car is, the clock is still re-timed against what is left. Two things differ,
 * and both follow from the heading being evidence about *stops*, not about
 * geometry:
 *
 *   - the kept stops are cut down to the ones still ahead (see
 *     `stopsAheadOfHeading`), because a stop behind the walker is the stale
 *     plan in miniature, and
 *   - discovery is allowed to run, which the plain deviation rebuild forbids.
 *     That rule was written for a walker who is *lost* and wants what they
 *     already chose redrawn to reach them. This walker is the opposite: they
 *     are going somewhere on purpose, and cutting stops out has just left a
 *     hole in their walk that only discovery can fill.
 *
 * What it deliberately does not do is aim that discovery. Ranking candidates by
 * direction as well as by distance is a real change to the ranker's scoring and
 * belongs with that file, not here; what this can honestly promise is that
 * nothing behind the walker is carried forward, and that the search is centred
 * on where they now are rather than where they were.
 */
export function buildHeadingContinuedRebuildRequest<
  TInput extends RebuildInput,
>(
  state: PaceRebuildState<TInput>,
  heading: number,
): { input: TInput; options: BuildWalkOptions } {
  return buildMidWalkRebuildRequest(state, {
    fillRemainingTime: true,
    continueHeading: heading,
  });
}

/**
 * A stop that was on the walk and is not any more.
 *
 * The reason is carried because the two are not the same loss and should not
 * read as one. `"nofit"` is a stop the planner could not fit in the time that
 * was left — getting it back costs something, and the walker is choosing to
 * spend it. `"behind"` is a stop a heading-continued rebuild cut for being
 * behind the walker: still open, still worth an hour, just not the way they are
 * currently pointing, and getting it back costs a turn rather than a budget.
 */
export interface LostStop {
  attraction: Attraction;
  reason: "nofit" | "behind";
}

export interface LostStopsInput {
  /** What was already known to be lost, so a second rebuild doesn't erase the first's casualties. */
  alreadyLost: LostStop[];
  /** The stops the walker was on before this rebuild. */
  before: Attraction[];
  /**
   * The stops this rebuild actually asked the planner to keep. Anything in
   * `before` and missing here never reached the server at all — today that is
   * only the heading cone, which is why its absence is what names the reason.
   * `undefined` means the rebuild kept nothing on purpose (ordinary discovery).
   */
  requested: Attraction[] | undefined;
  /** The stops that came back. */
  after: Attraction[];
  /** Stops already reached. A stop the walker finished is done, never lost. */
  visitedIds: ReadonlySet<string>;
}

/**
 * What a rebuild cost the walker, as a running total for the whole walk.
 *
 * Deliberately a before/after diff of the walk itself rather than a read of the
 * plan's own `droppedAttractions`, which is the field this first looked like it
 * should ride on. Two reasons, and either alone would settle it. `droppedAttractions`
 * is *wider* than the question — on a rebuild that runs discovery it is full of
 * candidates Overpass turned up and the planner declined, which the walker never
 * had and cannot have "lost". And it is *narrower* than the question — the
 * heading cone (`stopsAheadOfHeading`) removes stops on the client, before the
 * request is built, so the server never sees them and never reports them
 * dropped, yet they are exactly the stops that vanished from under the walker.
 * The diff answers precisely the asked question and nothing else: was it on my
 * walk, and is it still.
 *
 * Accumulating rather than replacing, because a rebuild is not the only thing
 * that can happen in the ninety seconds before the walker looks at their phone.
 * If a pace rebuild drops the museum and a deviation rebuild fires two minutes
 * later, the museum is still gone; a list that only ever showed the last
 * rebuild's casualties would have quietly dropped it a second time.
 *
 * Two ways off the list, and both are the stop stopping being lost rather than
 * the walker giving up on it: it is back in the plan (recalled, or rediscovered
 * on its own), or it has been visited after all.
 *
 * A stop already on the list keeps the reason it first went for, because a later
 * rebuild's `before` is the previous rebuild's `after` and so cannot contain it —
 * the one thing that can wind the plan backwards is a revert, which puts the
 * stops back and clears the list outright.
 */
export function stopsLostInRebuild({
  alreadyLost,
  before,
  requested,
  after,
  visitedIds,
}: LostStopsInput): LostStop[] {
  const afterIds = new Set(after.map((a) => a.id));
  const requestedIds =
    requested === undefined ? null : new Set(requested.map((a) => a.id));

  const lost = new Map<string, LostStop>();
  for (const stop of alreadyLost) lost.set(stop.attraction.id, stop);

  for (const attraction of before) {
    lost.set(attraction.id, {
      attraction,
      reason:
        requestedIds !== null && !requestedIds.has(attraction.id)
          ? "behind"
          : "nofit",
    });
  }

  return [...lost.values()].filter(
    (stop) =>
      !afterIds.has(stop.attraction.id) && !visitedIds.has(stop.attraction.id),
  );
}

/**
 * What "wait, I wanted that one back" should rebuild.
 *
 * Recall is a pin, and deliberately nothing more exotic: the mechanism that
 * already means "this stop stays whatever else changes" is the one the walker
 * is reaching for, and reusing it means the recalled stop is protected from
 * every *later* rebuild too, not just from this one. So the stop goes back into
 * the kept set and its id goes into the pins, and the rest of the request is
 * the plain redraw — same current-position origin, same end anchor, same
 * re-timing.
 *
 * Discovery stays off. The walker asked for one particular stop, not for the
 * walk to be topped up around it, and a rebuild that answered "here is your
 * museum, and also three cafés" would be answering a question nobody asked at
 * the moment the budget is already known to be tight.
 *
 * No heading either, even when this is undoing a heading-continued rebuild's
 * cut. Passing one would run the same cone that removed the stop in the first
 * place, and while the pin would survive it (pins beat the cone), the *other*
 * stops behind the walker would be cut a second time — turning "give me the
 * museum back" into "give me the museum and take everything else". The pin is
 * the only thing this is allowed to change.
 *
 * What it does not do is promise the stop fits. It cannot: a pin is exactly the
 * thing the planner refuses to drop, so forcing one back in can return a plan
 * over budget — and that is reported rather than hidden, by the same
 * pinned-stop warning that already covers a pin made from the list.
 */
export function buildRecallRebuildRequest<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
  recalled: Attraction,
): { input: TInput; options: BuildWalkOptions } {
  const kept = state.currentAttractions ?? [];

  return buildMidWalkRebuildRequest(
    {
      ...state,
      currentAttractions: kept.some((a) => a.id === recalled.id)
        ? kept
        : [...kept, recalled],
      pinnedIds: state.pinnedIds.includes(recalled.id)
        ? state.pinnedIds
        : [...state.pinnedIds, recalled.id],
    },
    { fillRemainingTime: false },
  );
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

/**
 * The three things a mid-walk rebuild is allowed to vary. Everything else — the
 * origin, the end anchor, the re-timing, the pins — is the same question
 * whoever is asking, which is why every path above comes through here.
 *
 *   fillRemainingTime          may discovery run, or is this a redraw of the
 *                              stops the walker already has?
 *   extendToFitRemainingStops  may the clock grow past what the walker asked
 *                              for, to keep every stop?
 *   continueHeading            a compass bearing the walker has been holding.
 *                              Present only on the heading-continued path, and
 *                              the only option that can *remove* stops.
 */
interface MidWalkRebuildOptions {
  fillRemainingTime: boolean;
  extendToFitRemainingStops?: boolean;
  continueHeading?: number;
}

function buildMidWalkRebuildRequest<TInput extends RebuildInput>(
  state: PaceRebuildState<TInput>,
  {
    fillRemainingTime,
    extendToFitRemainingStops = false,
    continueHeading,
  }: MidWalkRebuildOptions,
): { input: TInput; options: BuildWalkOptions } {
  const { originalInput: orig } = state;
  const elapsedMinutes = (state.now - state.walkStartTime) / 60_000;
  const remainingMinutes = Math.max(
    MIN_REBUILD_MINUTES,
    orig.availableMinutes - elapsedMinutes,
    extendToFitRemainingStops ? minutesToFinishRemainingStops(state) : 0,
  );

  const origin = state.currentPosition ?? orig.origin;

  // Undefined stays undefined rather than collapsing to an empty array: the
  // caller reads "no kept stops" as "run ordinary discovery", and a rebuild
  // that never had a stop list must not start claiming it has an empty one.
  const keepAttractions =
    continueHeading === undefined || state.currentAttractions === undefined
      ? state.currentAttractions
      : stopsAheadOfHeading(
          origin,
          continueHeading,
          state.currentAttractions,
          state.pinnedIds,
        );

  return {
    input: {
      ...orig,
      origin,
      availableMinutes: remainingMinutes,
      // The walk moved; the car did not. Pin the end-distance constraint to
      // wherever it was already anchored, or to the start of this walk if this
      // is the first rebuild — never to the walker's current position.
      endAnchor: orig.endAnchor ?? orig.origin,
    },
    options: {
      autoResume: true,
      resumeTracking: state.settings.autoResumeAfterRebuild,
      // Keep the walk the user is already on rather than rediscovering it —
      // minus anything the walker has turned their back on, when a heading says
      // which way that is.
      keepAttractions,
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
