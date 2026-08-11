import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates } from "@/lib/types";
import {
  DEFAULT_WALK_SETTINGS,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import {
  buildDeviationRebuildRequest,
  buildPaceRebuildRequest,
  promptWalkBuildOptions,
  toggleSimulatedStray,
  type PaceRebuildState,
  type RebuildInput,
} from "@/lib/walk/planner-actions";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";
import { detectDeviation } from "@/lib/walk/deviation-detector";

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
