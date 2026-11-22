import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn(async () => { throw new Error("no network in tests"); }) }));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn() }));

import { currentWalkNote, parseCurrentWalk, seedCurrentWalk, seedWalkingParams } from "@/lib/assistant/current-walk";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";

afterEach(() => vi.clearAllMocks());

const walk = (pace: unknown) => ({
  source: "walking",
  start: { lat: 32.07, lng: 34.77 },
  totalMin: 95,
  remainingMin: 40,
  pace,
  stops: [{ name: "A", coordinates: { lat: 32.071, lng: 34.771 }, category: "food" }],
});
const note = (pace: unknown) => currentWalkNote(seedCurrentWalk(EMPTY_STATE, parseCurrentWalk(walk(pace))!));

describe("speed in km/h", () => {
  it("speed_kmh 4 plans at 15 min/km and marks the pace as stated this turn", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ speed_kmh: 4 }), EMPTY_STATE);
    expect(run.state.params.paceMinPerKm).toBe(15);
    expect(run.state.paceSetThisTurn).toBe(true);
  });

  it("2 km/h is 30 min/km", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ speed_kmh: 2 }), EMPTY_STATE);
    expect(run.state.params.paceMinPerKm).toBe(30);
  });

  it("rejects a km/h number sent as min/km", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ pace_min_per_km: 4 }), EMPTY_STATE);
    expect(run.output).toMatch(/speed_kmh/);
    expect(run.state.params.paceMinPerKm).toBeUndefined();
  });

  it("a stored pace alone does not count as stated", async () => {
    const state = { ...EMPTY_STATE, params: { ...EMPTY_STATE.params, paceMinPerKm: 30 } };
    const run = await runTool("set_walk_params", JSON.stringify({ time_minutes: 90 }), state);
    expect(run.state.paceSetThisTurn).toBeUndefined();
  });
});

describe("the assistant is told ahead from behind", () => {
  it("ahead: offer to extend, never shorten", () => {
    const n = note({ plannedMinPerKm: 30, measuredKmh: 4, spareMin: 25 });
    expect(n).toMatch(/planned at 2 km\/h/);
    expect(n).toMatch(/moving at 4 km\/h/);
    expect(n).toMatch(/ahead of plan.*NEVER to shorten/);
  });

  it("behind: more time or skip one stop", () => {
    expect(note({ plannedMinPerKm: 12, measuredKmh: 2, spareMin: -25 })).toMatch(/behind plan.*more time or skipping one stop/);
  });

  it("says nothing about spare time within 8 minutes", () => {
    expect(note({ plannedMinPerKm: 12, measuredKmh: 5, spareMin: 5 })).not.toMatch(/Spare time/);
  });

  it("drops an out-of-range pace", () => {
    expect(parseCurrentWalk(walk({ plannedMinPerKm: 1 }))!.pace).toBeUndefined();
    expect(parseCurrentWalk(walk({ plannedMinPerKm: NaN }))!.pace).toBeUndefined();
  });
});

// P18 of docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md: mid-walk, estimates and builds are priced at the walk's own pace and time left.
describe("a live walk seeds the assistant's pace and time", () => {
  const parsed = (over: Record<string, unknown> = {}) => parseCurrentWalk({ ...walk({ plannedMinPerKm: 30, measuredKmh: 4 }), ...over })!;

  it("prices at the walk's pace (not the 15 min/km default) and counts the time that is left", () => {
    const state = seedWalkingParams({ ...EMPTY_STATE, params: { timeMinutes: 180 } }, parsed());
    expect(state.params.paceMinPerKm).toBe(30);
    expect(state.params.timeMinutes).toBe(40);
  });

  it("is not a statement: the turn is not marked as having set pace or time", () => {
    const state = seedWalkingParams(EMPTY_STATE, parsed());
    expect(state.paceSetThisTurn).toBeUndefined();
    expect(state.timeSetThisTurn).toBeUndefined();
  });

  it("leaves a planned or saved walk alone, and keeps what it has when the client sent no pace or time", () => {
    const params = { ...EMPTY_STATE.params, paceMinPerKm: 12, timeMinutes: 90 };
    expect(seedWalkingParams({ ...EMPTY_STATE, params }, parsed({ source: "plan" })).params).toEqual(params);
    expect(seedWalkingParams({ ...EMPTY_STATE, params }, parsed({ source: "saved" })).params).toEqual(params);
    const bare = parseCurrentWalk({ ...walk(undefined), remainingMin: undefined })!;
    expect(seedWalkingParams({ ...EMPTY_STATE, params }, bare).params).toEqual(params);
  });

  it("a speed the walker states afterwards still wins, and is what marks the turn", async () => {
    const seeded = seedWalkingParams(EMPTY_STATE, parsed());
    const run = await runTool("set_walk_params", JSON.stringify({ speed_kmh: 3 }), seeded);
    expect(run.state.params.paceMinPerKm).toBe(20);
    expect(run.state.paceSetThisTurn).toBe(true);
  });
});

describe("an end limit stated this turn", () => {
  it("marks the turn, so a mid-walk build applies it; a stored one does not", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ end_distance_km: 0 }), EMPTY_STATE);
    expect(run.state.params.endDistanceKm).toBe(0);
    expect(run.state.endSetThisTurn).toBe(true);

    const stored = { ...EMPTY_STATE, params: { ...EMPTY_STATE.params, endDistanceKm: 0 } };
    const other = await runTool("set_walk_params", JSON.stringify({ time_minutes: 90 }), stored);
    expect(other.state.endSetThisTurn).toBeUndefined();
  });
});
