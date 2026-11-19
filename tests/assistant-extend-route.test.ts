import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn(async () => { throw new Error("no network in tests"); }) }));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn() }));

import { currentWalkNote, parseCurrentWalk, seedCurrentWalk } from "@/lib/assistant/current-walk";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";
import { runAssistantTurn } from "@/lib/assistant/turn";

afterEach(() => vi.clearAllMocks());

const choice = { provider: "openai" as const, model: "gpt-6.1-sol" };
const walk = {
  source: "plan",
  start: { lat: 32.07, lng: 34.77 },
  totalMin: 95,
  stops: [
    { name: "A", coordinates: { lat: 32.071, lng: 34.771 }, category: "food" },
    { name: "B", coordinates: { lat: 32.075, lng: 34.775 }, category: "weird" },
  ],
};

describe("a reply may not claim a change the map did not get", () => {
  const setParams = { id: "t1", type: "function", function: { name: "set_walk_params", arguments: '{"time_minutes":150}' } };

  it("adds the server line and a Build choice when no route was built", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ content: null, toolCalls: [setParams], inTok: 1, outTok: 1 })
      .mockResolvedValueOnce({ content: "הארכתי את המסלול בשעה", toolCalls: [], inTok: 1, outTok: 1 });
    const r = await runAssistantTurn({ summary: null, history: [{ role: "user", content: "נאריך, יש לי עוד שעה" }], state: EMPTY_STATE, choice }, { call });
    expect(r.action).toBeUndefined();
    expect(r.reply).toMatch(/המפה לא השתנתה/);
    expect(r.choices).toEqual(["בנו את המסלול"]);
  });

  it("stays silent when build_walk really ran", async () => {
    const state = { ...EMPTY_STATE, limitsSettled: true, origin: { lat: 1, lng: 1 }, candidates: [{ id: "c1", name: "A", coordinates: { lat: 1, lng: 1 }, category: "food" as const, placeId: "p" }] };
    const call = vi
      .fn()
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "t1", type: "function", function: { name: "build_walk", arguments: '{"stop_ids":["c1"]}' } }], inTok: 1, outTok: 1 })
      .mockResolvedValueOnce({ content: "הארכתי את המסלול", toolCalls: [], inTok: 1, outTok: 1 });
    const r = await runAssistantTurn({ summary: "s", history: [{ role: "user", content: "yes" }], state, choice }, { call });
    expect(r.action?.type).toBe("build");
    expect(r.reply).not.toMatch(/המפה לא השתנתה/);
  });
});

describe("add_minutes", () => {
  it("adds to the walk's real length", async () => {
    const state = seedCurrentWalk(EMPTY_STATE, parseCurrentWalk(walk)!);
    const run = await runTool("set_walk_params", JSON.stringify({ add_minutes: 60 }), state);
    expect(run.state.params.timeMinutes).toBe(155);
    expect(run.state.timeSetThisTurn).toBe(true);
  });

  it("adds to the time left during a live walk", async () => {
    const state = seedCurrentWalk(EMPTY_STATE, parseCurrentWalk({ ...walk, source: "walking", remainingMin: 20 })!);
    const run = await runTool("set_walk_params", JSON.stringify({ add_minutes: 60 }), state);
    expect(run.state.params.timeMinutes).toBe(80);
  });

  it("says so when there is no walk to extend", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ add_minutes: 60 }), EMPTY_STATE);
    expect(run.output).toMatch(/no walk on the map/);
    expect(run.state.params.timeMinutes).toBeUndefined();
  });
});

describe("the walk on the map", () => {
  it("drops bad input and caps the stops", () => {
    expect(parseCurrentWalk({ ...walk, source: "nope" })).toBeNull();
    expect(parseCurrentWalk({ ...walk, stops: [{ name: "x", coordinates: { lat: 999, lng: 0 } }] })).toBeNull();
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, coordinates: { lat: 32 + i / 1000, lng: 34 } }));
    expect(parseCurrentWalk({ ...walk, stops: many })!.stops).toHaveLength(12);
  });

  it("seeds ids, reuses a candidate within 40 m and does not collide", () => {
    const base = { ...EMPTY_STATE, candidates: [{ id: "c7", name: "Known A", coordinates: { lat: 32.071, lng: 34.771 }, category: "food" as const, placeId: "g" }] };
    const s = seedCurrentWalk(base, parseCurrentWalk(walk)!);
    expect(s.chosen).toEqual(["c7", "c8"]);
    expect(s.candidates.find((c) => c.id === "c8")?.category).toBe("other");
    expect(s.current).toMatchObject({ source: "plan", totalMin: 95 });
    expect(currentWalkNote(s)).toMatch(/c7 Known A; c8 B/);
  });
});
