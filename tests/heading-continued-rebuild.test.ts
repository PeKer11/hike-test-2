/**
 * The silence path end to end, over the position stream the app actually runs
 * on.
 *
 * Nothing here is a stand-in for the pieces under test: a real
 * `SimulatedWalkTracker` walks a real route and a real ORS-shaped detour,
 * emitting the same `PaceUpdate`s `WalkPlannerApp` subscribes to; those go
 * through the real `detectDeviation` and the real `HeadingMonitor`, and the
 * verdict feeds the real request builder. `fetch` is the only fake, at the
 * network boundary, exactly as in `tests/simulated-walk-tracker.test.ts`.
 *
 * This is the equivalent of watching the simulator in the browser, which the
 * stray buttons cannot quite stage on their own: the detour they ask ORS for
 * comes back down whatever streets exist, so whether it reads as a held
 * direction is the street grid's answer rather than the test's. Both answers
 * matter, so both are staged here — a side street that keeps going, and one
 * that turns.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates } from "@/lib/types";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import { angleDifference } from "@/lib/utils/geo";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import { HeadingMonitor } from "@/lib/walk/heading-monitor";
import {
  buildDeviationRebuildRequest,
  buildHeadingContinuedRebuildRequest,
  type PaceRebuildState,
  type RebuildInput,
} from "@/lib/walk/planner-actions";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";

// A straight kilometre due north, for the same reason the sibling suite uses
// one: a route that doubles back can measure a stray against the wrong segment.
const ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.089, lng: 34.78 },
];

const PACE_MIN_PER_KM = 15;
const SPEED = 10;
const TICK_MS = 500;
// One tick is 500 real ms, which the simulator reports as 5 s of walk time,
// covering ~5.6 m — about 1.1 m/s, an ordinary unhurried pace.
const SIM_MS_PER_TICK = TICK_MS * SPEED;

/**
 * A side street that keeps going: due east, well past the 50 m threshold, and
 * long enough to fill the heading window without a corner in it. This is the
 * walker who has decided to go somewhere else.
 */
const STRAIGHT_SIDE_STREET: Coordinates[] = [
  { lat: 32.0805, lng: 34.78 },
  { lat: 32.0805, lng: 34.7845 },
];

/**
 * A side street that turns: 60 m east — far enough to trip the 50 m threshold
 * — then a right angle north, then back west onto the route. This is the
 * walker who went round a block rather than one who left, and the corner has
 * to land inside the heading window for the test to be about anything, which
 * is why the legs are short. The default detour the simulator asks ORS for
 * runs its first leg ~190 m, long enough that a walker on it genuinely *is*
 * holding a direction — see the note on the straight case above.
 */
const AROUND_THE_BLOCK: Coordinates[] = [
  { lat: 32.0805, lng: 34.78 },
  { lat: 32.0805, lng: 34.78064 },
  { lat: 32.08117, lng: 34.78064 },
  { lat: 32.08117, lng: 34.78 },
];

function encodeSignedValue(value: number): string {
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (remaining >= 0x20) {
    encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
    remaining >>= 5;
  }
  return encoded + String.fromCharCode(remaining + 63);
}

function encodePolyline(coords: Coordinates[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let encoded = "";
  for (const coord of coords) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);
    encoded +=
      encodeSignedValue(lat - lastLat) + encodeSignedValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return encoded;
}

function mockDirections(geometry: Coordinates[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ routes: [{ geometry: encodePolyline(geometry) }] }),
    })),
  );
}

/**
 * Walk the simulator down a detour, feeding every emitted fix through the same
 * two readers `WalkPlannerApp` feeds them through, and report what the app
 * would know when the banner lapses.
 */
async function walkOffRoute(
  detour: Coordinates[],
  ticks: number,
): Promise<{
  heading: number | null;
  offRoute: boolean;
  lastFix: PaceUpdate;
}> {
  mockDirections(detour);

  const updates: PaceUpdate[] = [];
  const tracker = new SimulatedWalkTracker(
    ROUTE,
    (update) => updates.push(update),
    [],
    PACE_MIN_PER_KM,
    SPEED,
    TICK_MS,
  );

  tracker.start();
  // A few ticks on the planned route first, so the heading window holds the
  // run-up as well as the excursion — which is what the app records.
  vi.advanceTimersByTime(TICK_MS * 3);
  await tracker.strayOffRoute(80, 1_000);
  vi.advanceTimersByTime(TICK_MS * ticks);
  tracker.stop();

  const monitor = new HeadingMonitor();
  let offRoute = false;
  let previousSegment: number | null = null;

  for (const update of updates) {
    monitor.record(update.currentPosition, update.timestamp);
    const deviation = detectDeviation(
      update.currentPosition,
      ROUTE,
      previousSegment,
    );
    previousSegment = deviation.closestSegmentIndex;
    offRoute = deviation.needsReroute;
  }

  const lastFix = updates[updates.length - 1];
  return {
    heading: monitor.sustainedHeading(lastFix.timestamp),
    offRoute,
    lastFix,
  };
}

// The walk the drifting walker is on: three stops left, spread around the
// route they have abandoned.
function stopAt(id: string, lat: number, lng: number): Attraction {
  return {
    id,
    name: `Stop ${id}`,
    category: "landmark",
    coordinates: { lat, lng },
    avgVisitMinutes: 10,
    score: 1,
    tags: {},
  };
}

const AHEAD_EAST = stopAt("east", 32.0805, 34.79);
const BACK_NORTH = stopAt("north", 32.0885, 34.78);
const BACK_SOUTH = stopAt("south", 32.0795, 34.78);

interface TestInput extends RebuildInput {
  walkingPaceMinPerKm: number;
  radiusMeters: number;
}

const WALK_START = 1_700_000_000_000;

function rebuildState(position: Coordinates): PaceRebuildState<TestInput> {
  return {
    originalInput: {
      origin: ROUTE[0],
      availableMinutes: 90,
      walkingPaceMinPerKm: PACE_MIN_PER_KM,
      radiusMeters: 2000,
    },
    walkStartTime: WALK_START,
    now: WALK_START + 30 * 60_000,
    currentPosition: position,
    settings: DEFAULT_WALK_SETTINGS,
    currentAttractions: [AHEAD_EAST, BACK_NORTH, BACK_SOUTH],
    pinnedIds: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a simulated walker who genuinely left the route", () => {
  // 12 ticks is 60 s of walk time, comfortably past the 45 s window.
  const TICKS = 12;

  it("is still off route and holding a direction when the banner lapses", async () => {
    const { heading, offRoute } = await walkOffRoute(
      STRAIGHT_SIDE_STREET,
      TICKS,
    );

    expect(offRoute).toBe(true);
    expect(heading).not.toBeNull();
    // Due east down the side street, give or take where the detour joined it.
    expect(angleDifference(heading as number, 90)).toBeLessThan(30);
  });

  it("gets a walk built round the way they are going, not the plan they left", async () => {
    const { heading, lastFix } = await walkOffRoute(
      STRAIGHT_SIDE_STREET,
      TICKS,
    );

    const { input, options } = buildHeadingContinuedRebuildRequest(
      rebuildState(lastFix.currentPosition),
      heading as number,
    );

    // Neither of the two old outcomes. Not the stale plan: the stops back up
    // and down the route are gone. Not a blind redraw from a standing start:
    // the origin is where they have actually got to, discovery is on to
    // replace what was dropped, and the finish is still pinned to the car.
    expect((options.keepAttractions ?? []).map((a) => a.id)).toEqual(["east"]);
    expect(options.fillRemainingTime).toBe(true);
    expect(input.origin).toEqual(lastFix.currentPosition);
    expect(input.endAnchor).toEqual(ROUTE[0]);
  });

  it("is not what the plain redraw would have built from the same position", async () => {
    const { lastFix } = await walkOffRoute(STRAIGHT_SIDE_STREET, TICKS);

    const { options } = buildDeviationRebuildRequest(
      rebuildState(lastFix.currentPosition),
    );

    expect((options.keepAttractions ?? []).map((a) => a.id)).toEqual([
      "east",
      "north",
      "south",
    ]);
    expect(options.fillRemainingTime).toBe(false);
  });
});

describe("a simulated walker who went round a block", () => {
  it("gets no heading once the corner is inside the window, so the route stands", async () => {
    // 16 ticks is 80 s of walk time: the last 45 s of it span the turn from
    // east to north. Off route the whole time, and still nothing to act on —
    // which is the old silence behaviour, unchanged.
    const { heading, offRoute } = await walkOffRoute(AROUND_THE_BLOCK, 16);

    expect(offRoute).toBe(true);
    expect(heading).toBeNull();
  });

  it("did hold a direction earlier, before the corner entered the window", async () => {
    // The pair matters: without this the test above would pass just as well
    // against a monitor that never answers at all.
    const { heading } = await walkOffRoute(AROUND_THE_BLOCK, 10);

    expect(heading).not.toBeNull();
  });
});

describe("a simulated walker who never left", () => {
  it("has no bearing verdict to act on, because the banner never comes up", async () => {
    const updates: PaceUpdate[] = [];
    const tracker = new SimulatedWalkTracker(
      ROUTE,
      (update) => updates.push(update),
      [],
      PACE_MIN_PER_KM,
      SPEED,
      TICK_MS,
    );

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 15);
    tracker.stop();

    const monitor = new HeadingMonitor();
    for (const update of updates) {
      monitor.record(update.currentPosition, update.timestamp);
      expect(detectDeviation(update.currentPosition, ROUTE).needsReroute).toBe(
        false,
      );
    }

    // Walking the planned route *is* holding a direction — the route is a
    // straight kilometre due north — which is the point of the still-off-route
    // guard in `WalkPlannerApp`. The heading on its own decides nothing.
    const last = updates[updates.length - 1];
    expect(monitor.sustainedHeading(last.timestamp)).not.toBeNull();
  });

  it("covers enough ground per window for the chord rule to be satisfiable", async () => {
    // A guard on the simulator's own numbers rather than on the monitor: if a
    // tick ever covered much less ground, every test above would pass by
    // never producing a heading at all.
    const updates: PaceUpdate[] = [];
    const tracker = new SimulatedWalkTracker(
      ROUTE,
      (update) => updates.push(update),
      [],
      PACE_MIN_PER_KM,
      SPEED,
      TICK_MS,
    );

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    expect(updates[1].timestamp - updates[0].timestamp).toBe(SIM_MS_PER_TICK);
  });
});
