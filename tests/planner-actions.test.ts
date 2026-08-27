import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates, WalkPlanRequest } from "@/lib/types";
import { planWalkOrder } from "@/lib/optimization/tsp-planner";
import {
  DEFAULT_WALK_SETTINGS,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import {
  buildDeviationRebuildRequest,
  buildExtendedTimeRebuildRequest,
  buildHeadingContinuedRebuildRequest,
  buildPaceRebuildRequest,
  promptWalkBuildOptions,
  stopsAheadOfHeading,
  toggleSimulatedStray,
  type BuildWalkOptions,
  type PaceRebuildState,
  type RebuildInput,
} from "@/lib/walk/planner-actions";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";
import { detectDeviation } from "@/lib/walk/deviation-detector";

// The only mock in this file, and it stands at a network boundary: the planner
// orders stops on a real ORS walking matrix and falls back to straight lines
// when ORS is unreachable. Failing it deliberately is what keeps the expected
// distances below the plain haversine ones — same convention as
// `tests/tsp-planner.test.ts`.
vi.mock("@/lib/api/ors-client", () => ({
  getMatrix: async () => {
    throw new Error("ORS unavailable in tests");
  },
}));

const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const CURRENT: Coordinates = { lat: 32.085, lng: 34.782 };

function attraction(id: string): Attraction {
  return {
    id,
    name: `Stop ${id}`,
    category: "landmark",
    coordinates: { lat: 32.081, lng: 34.781 },
    avgVisitMinutes: 10,
    score: 1,
    tags: {},
  };
}

// The caller's real walk input is wider than `RebuildInput`. Keeping the extra
// fields here is what proves the rebuild carries them through untouched.
interface TestWalkInput extends RebuildInput {
  walkingPaceMinPerKm: number;
  radiusMeters: number;
}

const WALK_INPUT: TestWalkInput = {
  origin: ORIGIN,
  availableMinutes: 90,
  walkingPaceMinPerKm: 12,
  radiusMeters: 2000,
};

const START = 1_700_000_000_000;

function state(
  overrides: Partial<PaceRebuildState<TestWalkInput>> = {},
): PaceRebuildState<TestWalkInput> {
  return {
    originalInput: WALK_INPUT,
    walkStartTime: START,
    now: START + 30 * 60_000, // 30 minutes in
    currentPosition: CURRENT,
    settings: DEFAULT_WALK_SETTINGS,
    currentAttractions: [attraction("a"), attraction("b")],
    pinnedIds: ["a"],
    ...overrides,
  };
}

describe("buildPaceRebuildRequest", () => {
  it("re-times the walk to the minutes the walker has actually got left", () => {
    const { input } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(input.availableMinutes).toBe(60);
  });

  it("never re-plans a walk shorter than 15 minutes, however late it is", () => {
    const { input } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      state({ now: START + 88 * 60_000 }),
    );

    expect(input.availableMinutes).toBe(15);
  });

  it("rebuilds from the walker's current position, not where they set off", () => {
    const { input } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(input.origin).toEqual(CURRENT);
  });

  it("falls back to the walk's origin when no GPS fix has arrived yet", () => {
    const { input } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      state({ currentPosition: null }),
    );

    expect(input.origin).toEqual(ORIGIN);
  });

  it("anchors the end-distance constraint to the start, never to where the walker now is", () => {
    const { input } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(input.endAnchor).toEqual(ORIGIN);
  });

  it("keeps an end anchor that was already set across repeated rebuilds", () => {
    const parkedCar: Coordinates = { lat: 32.07, lng: 34.77 };
    const { input } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      state({ originalInput: { ...WALK_INPUT, endAnchor: parkedCar } }),
    );

    expect(input.endAnchor).toEqual(parkedCar);
  });

  it("carries through walk fields it does not itself decide", () => {
    const { input } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(input.walkingPaceMinPerKm).toBe(12);
    expect(input.radiusMeters).toBe(2000);
  });

  it("looks for another stop when the walker is ahead of plan", () => {
    const { options } = buildPaceRebuildRequest("sustained-fast-pace", state());

    expect(options.fillRemainingTime).toBe(true);
  });

  it("only re-times the remaining stops when the walker is behind plan", () => {
    const { options } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(options.fillRemainingTime).toBe(false);
  });

  it("only re-times the remaining stops after a full stop", () => {
    const { options } = buildPaceRebuildRequest("full-stop", state());

    expect(options.fillRemainingTime).toBe(false);
  });

  it("resumes live tracking when the walker asked for that", () => {
    const settings: WalkSettings = {
      ...DEFAULT_WALK_SETTINGS,
      autoResumeAfterRebuild: true,
    };
    const { options } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      state({ settings }),
    );

    expect(options.resumeTracking).toBe(true);
    // Still an automatic rebuild — the undo snapshot and visit history depend
    // on this staying true even when the walker opts out of auto-resume.
    expect(options.autoResume).toBe(true);
  });

  it("hands the walker the new plan instead of resuming when auto-resume is off", () => {
    const settings: WalkSettings = {
      ...DEFAULT_WALK_SETTINGS,
      autoResumeAfterRebuild: false,
    };
    const { options } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      state({ settings }),
    );

    expect(options.resumeTracking).toBe(false);
    expect(options.autoResume).toBe(true);
  });

  it("keeps the stops the walker is already heading to, and their pins", () => {
    const { options } = buildPaceRebuildRequest("sustained-slow-pace", state());

    expect(options.keepAttractions?.map((a) => a.id)).toEqual(["a", "b"]);
    expect(options.pinnedIds).toEqual(["a"]);
  });
});

describe("promptWalkBuildOptions", () => {
  it("leaves the walk to ordinary discovery when no stops were named", () => {
    expect(promptWalkBuildOptions(null, true)).toBeUndefined();
    expect(promptWalkBuildOptions([], true)).toBeUndefined();
  });

  it("adds no filler stops while the box is unticked", () => {
    const options = promptWalkBuildOptions([attraction("a")], false);

    expect(options?.fillRemainingTime).toBe(false);
    expect(options?.keepAttractions?.map((a) => a.id)).toEqual(["a"]);
  });

  it("fills the leftover time once the walker ticks the box", () => {
    const options = promptWalkBuildOptions([attraction("a")], true);

    expect(options?.fillRemainingTime).toBe(true);
    expect(options?.keepAttractions?.map((a) => a.id)).toEqual(["a"]);
  });
});

// A straight kilometre due north: a perpendicular offset is exactly that far
// from the segment it was taken off, with no doubling back to confuse it.
const ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.089, lng: 34.78 },
];
const STRAY_METERS = 80;

describe("toggleSimulatedStray", () => {
  let updates: PaceUpdate[];
  let tracker: SimulatedWalkTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    // The stray routes a real detour through `/api/directions` now. These tests
    // are about the toggle, not the detour, so routing is failed deliberately
    // and the tracker's synthetic 80 m offset is what the walker ends up on.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("no routing in this test");
      }),
    );
    updates = [];
    tracker = new SimulatedWalkTracker(
      ROUTE,
      (update) => updates.push(update),
      [],
      15,
      10,
      500,
    );
    tracker.start();
    vi.advanceTimersByTime(2_000);
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("puts the walker the requested distance off the planned line", async () => {
    await expect(toggleSimulatedStray(tracker, STRAY_METERS)).resolves.toBe(true);
    expect(tracker.isStraying).toBe(true);

    updates = [];
    vi.advanceTimersByTime(500);
    const reported = updates.at(-1)!.currentPosition;

    expect(detectDeviation(reported, ROUTE).deviationMeters).toBeCloseTo(
      STRAY_METERS,
      0,
    );
  });

  it("puts the walker back on the line on the second press", async () => {
    await toggleSimulatedStray(tracker, STRAY_METERS);

    await expect(toggleSimulatedStray(tracker, STRAY_METERS)).resolves.toBe(false);
    expect(tracker.isStraying).toBe(false);

    updates = [];
    vi.advanceTimersByTime(500);
    const reported = updates.at(-1)!.currentPosition;

    expect(detectDeviation(reported, ROUTE).deviationMeters).toBeLessThan(1);
  });
});

describe("buildDeviationRebuildRequest", () => {
  it("anchors the redrawn walk at the walker's actual off-route position", () => {
    const strayed: Coordinates = { lat: 32.09, lng: 34.79 };

    const { input } = buildDeviationRebuildRequest(
      state({ currentPosition: strayed }),
    );

    expect(input.origin).toEqual(strayed);
  });

  it("keeps the end anchor where the walk started, not where the walker wandered", () => {
    const { input } = buildDeviationRebuildRequest(
      state({ currentPosition: { lat: 32.09, lng: 34.79 } }),
    );

    // The car is still at the origin — a walker straying is not a reason to
    // move where the walk has to finish.
    expect(input.endAnchor).toEqual(ORIGIN);
  });

  it("keeps the stops the walker has not reached yet", () => {
    const remaining = [attraction("b"), attraction("c")];

    const { options } = buildDeviationRebuildRequest(
      state({ currentAttractions: remaining }),
    );

    expect(options.keepAttractions).toEqual(remaining);
    expect(options.pinnedIds).toEqual(["a"]);
  });

  it("re-times against the clock the walker has left, like a pace rebuild", () => {
    const { input } = buildDeviationRebuildRequest(state());

    expect(input.availableMinutes).toBe(60);
  });

  it("never adds a stop — being lost is not spare time", () => {
    const { options } = buildDeviationRebuildRequest(state());

    expect(options.fillRemainingTime).toBe(false);
  });

  it("honours the walker's auto-resume setting", () => {
    const optedOut: WalkSettings = {
      ...DEFAULT_WALK_SETTINGS,
      autoResumeAfterRebuild: false,
    };

    const { options } = buildDeviationRebuildRequest(
      state({ settings: optedOut }),
    );

    expect(options.resumeTracking).toBe(false);
  });

  it("carries fields it does not know about straight through", () => {
    const { input } = buildDeviationRebuildRequest(state());

    expect(input.walkingPaceMinPerKm).toBe(12);
    expect(input.radiusMeters).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Silence, from a walker who kept walking
// ---------------------------------------------------------------------------

// A ring of stops around one spot, so a heading picks between them purely on
// direction. `HERE` is where the walker is standing when the banner lapses.
const HERE: Coordinates = { lat: 32.09, lng: 34.79 };
const METERS_PER_DEG_LAT = 111_320;

function stopAt(id: string, bearingDeg: number, meters = 600): Attraction {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    ...attraction(id),
    coordinates: {
      lat: HERE.lat + (meters * Math.cos(rad)) / METERS_PER_DEG_LAT,
      lng:
        HERE.lng +
        (meters * Math.sin(rad)) /
          (METERS_PER_DEG_LAT * Math.cos((HERE.lat * Math.PI) / 180)),
    },
  };
}

function keptIds(options: BuildWalkOptions): string[] {
  return (options.keepAttractions ?? []).map((a) => a.id);
}

describe("stopsAheadOfHeading", () => {
  it("keeps a stop straight ahead", () => {
    const ahead = stopAt("ahead", 90);

    expect(stopsAheadOfHeading(HERE, 90, [ahead], [])).toEqual([ahead]);
  });

  it("drops a stop the walker has turned their back on", () => {
    expect(stopsAheadOfHeading(HERE, 90, [stopAt("behind", 270)], [])).toEqual(
      [],
    );
  });

  it("keeps a stop off to the side — a turn is not a walk back", () => {
    // 85° off the heading: reaching it means turning, not retracing. Dropping
    // it would throw away a stop the walker can still have.
    const beside = stopAt("beside", 175);

    expect(stopsAheadOfHeading(HERE, 90, [beside], [])).toEqual([beside]);
  });

  it("drops a stop just past the perpendicular", () => {
    expect(stopsAheadOfHeading(HERE, 90, [stopAt("past", 185)], [])).toEqual([]);
  });

  it("keeps a pinned stop the walker has walked away from", () => {
    // A pin is something the walker said; a heading is something we inferred
    // from their GPS trace. When the two disagree, the one they typed wins.
    const pinned = stopAt("pinned", 270);

    expect(stopsAheadOfHeading(HERE, 90, [pinned], ["pinned"])).toEqual([
      pinned,
    ]);
  });

  it("reads the cone across the 0°/360° seam", () => {
    // Heading due north, stop at 350°: ten degrees apart, not 350.
    const ahead = stopAt("ahead", 350);

    expect(stopsAheadOfHeading(HERE, 0, [ahead], [])).toEqual([ahead]);
  });
});

describe("buildHeadingContinuedRebuildRequest", () => {
  // The worked example: 30 minutes into a 90-minute walk, standing at HERE,
  // holding due east, four stops left — one ahead, one off to the side, one
  // behind, and one behind but pinned.
  const AHEAD = stopAt("ahead", 70);
  const BESIDE = stopAt("beside", 160);
  const BEHIND = stopAt("behind", 250);
  const PINNED_BEHIND = stopAt("pinned-behind", 290);

  function drifting() {
    return state({
      currentPosition: HERE,
      currentAttractions: [AHEAD, BESIDE, BEHIND, PINNED_BEHIND],
      pinnedIds: ["pinned-behind"],
    });
  }

  it("carries forward only the stops the walker has not turned away from", () => {
    const { options } = buildHeadingContinuedRebuildRequest(drifting(), 90);

    expect(keptIds(options)).toEqual(["ahead", "beside", "pinned-behind"]);
  });

  it("starts the new walk from where the walker is, not where they were", () => {
    const { input } = buildHeadingContinuedRebuildRequest(drifting(), 90);

    expect(input.origin).toEqual(HERE);
  });

  it("leaves the end anchor at the car, exactly like the plain redraw", () => {
    const { input } = buildHeadingContinuedRebuildRequest(drifting(), 90);

    expect(input.endAnchor).toEqual(ORIGIN);
  });

  it("re-times against the clock the walker has left", () => {
    const { input } = buildHeadingContinuedRebuildRequest(drifting(), 90);

    expect(input.availableMinutes).toBe(60);
  });

  it("lets discovery refill the hole that dropping stops just left", () => {
    // The one place this diverges from `buildDeviationRebuildRequest`, which
    // forbids discovery because a *lost* walker wants what they chose redrawn.
    // This walker is going somewhere on purpose and has just had stops removed.
    const { options } = buildHeadingContinuedRebuildRequest(drifting(), 90);

    expect(options.fillRemainingTime).toBe(true);
  });

  it("honours the walker's auto-resume setting like every other rebuild", () => {
    const optedOut: WalkSettings = {
      ...DEFAULT_WALK_SETTINGS,
      autoResumeAfterRebuild: false,
    };

    const { options } = buildHeadingContinuedRebuildRequest(
      state({ ...drifting(), settings: optedOut }),
      90,
    );

    expect(options.resumeTracking).toBe(false);
  });

  it("keeps every stop when the walker is heading the way the plan already went", () => {
    const { options } = buildHeadingContinuedRebuildRequest(
      state({
        currentPosition: HERE,
        currentAttractions: [AHEAD, BESIDE],
        pinnedIds: [],
      }),
      90,
    );

    expect(keptIds(options)).toEqual(["ahead", "beside"]);
  });

  it("asks for fresh discovery when every stop is behind the walker", () => {
    // Not an empty stop list dressed up as a kept one: the caller reads "no
    // kept stops" as "discover from scratch", which is the right answer when
    // there is nothing left ahead.
    const { options } = buildHeadingContinuedRebuildRequest(
      state({
        currentPosition: HERE,
        currentAttractions: [BEHIND, stopAt("also-behind", 230)],
        pinnedIds: [],
      }),
      90,
    );

    expect(options.keepAttractions).toEqual([]);
  });

  it("measures the cone from where the walker is now, not from where they set off", () => {
    // ORIGIN is well south-west of HERE. A stop due north of HERE is ahead of
    // a walker heading north from HERE, and would read quite differently from
    // the start of the walk — this is the bug of anchoring the cone at the
    // stale origin.
    const northOfHere = stopAt("north", 0);

    const { options } = buildHeadingContinuedRebuildRequest(
      state({
        currentPosition: HERE,
        currentAttractions: [northOfHere],
        pinnedIds: [],
      }),
      0,
    );

    expect(keptIds(options)).toEqual(["north"]);
  });

  it("leaves the plain redraw's stop list alone", () => {
    // The heading path is additive: no heading, no filtering, whatever the
    // walker is holding stays whole.
    const { options } = buildDeviationRebuildRequest(drifting());

    expect(keptIds(options)).toEqual([
      "ahead",
      "beside",
      "behind",
      "pinned-behind",
    ]);
  });
});

// ---------------------------------------------------------------------------
// "Give me more time"
// ---------------------------------------------------------------------------

// A kilometre apart each, straight up the same meridian, so the leg distances
// are the same whichever order the planner settles on.
const KM_APART = [32.089, 32.098, 32.107];
const SPREAD_STOPS: Attraction[] = KM_APART.map((lat, i) => ({
  ...attraction(`s${i + 1}`),
  coordinates: { lat, lng: 34.78 },
  avgVisitMinutes: 15,
}));

// The walker set off with 90 minutes at 12 min/km, is 30 minutes in (so the
// plain rebuild would offer 60), is standing back at the origin, and is
// actually managing 20 min/km. Three stops a kilometre apart, 15 minutes in
// each.
function slowWalkerState(
  overrides: Partial<PaceRebuildState<TestWalkInput>> = {},
): PaceRebuildState<TestWalkInput> {
  return state({
    currentPosition: ORIGIN,
    currentAttractions: SPREAD_STOPS,
    currentPaceMinPerKm: 20,
    ...overrides,
  });
}

describe("buildExtendedTimeRebuildRequest", () => {
  // 3002.26 m of straight-line legs × 1.25 for street corners = 3752.8 m, at
  // the 20 min/km the walker is really managing = 75.06 walking minutes, plus
  // 3 × 15 minutes standing in front of things = 120.06.
  it("buys exactly the minutes the remaining stops need at the measured pace", () => {
    const { input } = buildExtendedTimeRebuildRequest(slowWalkerState());

    expect(input.availableMinutes).toBeCloseTo(120.0566, 3);
  });

  it("leaves the plain rebuild timing the walk against the original budget", () => {
    const { input } = buildPaceRebuildRequest(
      "sustained-slow-pace",
      slowWalkerState(),
    );

    expect(input.availableMinutes).toBe(60);
  });

  // A walker who has stopped dead, or one whose GPS has not produced a pace
  // yet, still asked a real question. The slowest pace that could have raised
  // it — 1.3 × planned, i.e. 15.6 min/km here — is the honest floor.
  it("falls back to the pace that would have triggered the question at all", () => {
    const { input } = buildExtendedTimeRebuildRequest(
      slowWalkerState({ currentPaceMinPerKm: null }),
    );

    expect(input.availableMinutes).toBeCloseTo(103.5441, 3);
  });

  it("ignores a measured pace faster than the one that raised the question", () => {
    const { input } = buildExtendedTimeRebuildRequest(
      slowWalkerState({ currentPaceMinPerKm: 4 }),
    );

    expect(input.availableMinutes).toBeCloseTo(103.5441, 3);
  });

  // More time is an answer that can only add. A walker whose remaining stops
  // are a five-minute stroll away still keeps the clock they had.
  it("never hands back less time than the plain rebuild would have", () => {
    const { input } = buildExtendedTimeRebuildRequest(
      slowWalkerState({ currentAttractions: [attraction("a")] }),
    );

    expect(input.availableMinutes).toBe(60);
  });

  it("still never plans a walk shorter than 15 minutes", () => {
    const { input } = buildExtendedTimeRebuildRequest(
      slowWalkerState({
        now: START + 88 * 60_000,
        currentAttractions: [],
      }),
    );

    expect(input.availableMinutes).toBe(15);
  });

  it("rebuilds from where the walker is, keeping their stops and pins", () => {
    const { input, options } = buildExtendedTimeRebuildRequest(
      slowWalkerState({ currentPosition: CURRENT }),
    );

    expect(input.origin).toEqual(CURRENT);
    expect(input.endAnchor).toEqual(ORIGIN);
    expect(options.keepAttractions).toEqual(SPREAD_STOPS);
    expect(options.pinnedIds).toEqual(["a"]);
  });

  // Extending the clock is the whole answer — this path must never go looking
  // for extra stops to spend the new time on.
  it("adds time, never stops", () => {
    const { options } = buildExtendedTimeRebuildRequest(slowWalkerState());

    expect(options.fillRemainingTime).toBe(false);
  });
});

// The claim this feature actually makes: not "a bigger number", but "the stops
// survive". Run the real planner over both budgets and compare what comes back.
describe("what the two answers do to the walker's stops", () => {
  const planRequest = (availableMinutes: number): WalkPlanRequest => ({
    origin: ORIGIN,
    availableMinutes,
    walkingPaceMinPerKm: WALK_INPUT.walkingPaceMinPerKm,
    radiusMeters: WALK_INPUT.radiusMeters,
  });

  it("keeps a stop that 'adjust my route' would have dropped", async () => {
    const shortened = buildPaceRebuildRequest(
      "sustained-slow-pace",
      slowWalkerState(),
    ).input;
    const extended = buildExtendedTimeRebuildRequest(slowWalkerState()).input;

    const shortenedPlan = await planWalkOrder(
      planRequest(shortened.availableMinutes),
      SPREAD_STOPS,
    );
    const extendedPlan = await planWalkOrder(
      planRequest(extended.availableMinutes),
      SPREAD_STOPS,
    );

    expect(shortenedPlan.droppedAttractions.map((a) => a.id)).toEqual(["s3"]);
    expect(shortenedPlan.orderedAttractions.map((a) => a.id)).toEqual([
      "s1",
      "s2",
    ]);

    expect(extendedPlan.droppedAttractions).toEqual([]);
    expect(extendedPlan.orderedAttractions.map((a) => a.id)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
    expect(extendedPlan.feasible).toBe(true);
  });
});
