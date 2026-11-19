import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn(async () => { throw new Error("no network in tests"); }) }));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn() }));

import { currentWalkNote, parseCurrentWalk, seedCurrentWalk } from "@/lib/assistant/current-walk";
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
