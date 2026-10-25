import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({
  getMatrix: vi.fn(async () => {
    throw new Error("no network in tests");
  }),
}));
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: vi.fn(),
  searchNearbyPlaces: vi.fn(),
}));

import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";
import { runAssistantTurn } from "@/lib/assistant/turn";

const habima = {
  placeId: "g1",
  name: "הבימה",
  coordinates: { lat: 32.07, lng: 34.77 },
  primaryType: null,
  types: [],
};

afterEach(() => vi.clearAllMocks());

describe("assistant tools", () => {
  it("search_place stores the candidate and shows the model only a compact list", async () => {
    vi.mocked(searchTextPlaces).mockResolvedValue([habima]);
    const run = await runTool("search_place", JSON.stringify({ query: "הבימה תל אביב" }), EMPTY_STATE);
    expect(JSON.parse(run.output)).toEqual([{ id: "c1", name: "הבימה", kind: "other" }]);
    expect(run.output).not.toMatch(/32\.07/);
    expect(run.state.candidates[0].coordinates).toEqual(habima.coordinates);
  });

  it("find_nearby without a start point asks the model to ask the walker", async () => {
    const run = await runTool("find_nearby", JSON.stringify({ category: "food" }), EMPTY_STATE);
    expect(run.output).toMatch(/no start point/);
    expect(searchNearbyPlaces).not.toHaveBeenCalled();
  });

  it("set_walk_params records only what was stated", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ time_minutes: 120 }), EMPTY_STATE);
    expect(run.state.params).toEqual({ timeMinutes: 120 });
  });

  it("build_walk refuses a walk too long to be real (a wrong start point)", async () => {
    vi.mocked(searchTextPlaces).mockResolvedValue([habima]);
    const found = await runTool("search_place", JSON.stringify({ query: "x" }), { ...EMPTY_STATE, origin: { lat: 32, lng: 34 } });
    const run = await runTool("build_walk", JSON.stringify({ stop_ids: ["c1"] }), { ...found.state, limitsSettled: true });
    expect(run.action).toBeUndefined();
    expect(run.output).toMatch(/too long to walk/);
  });

  it("build_walk returns an action with real coordinates and ignores unknown ids", async () => {
    vi.mocked(searchTextPlaces).mockResolvedValue([habima]);
    const found = await runTool("search_place", JSON.stringify({ query: "x" }), {
      ...EMPTY_STATE,
      origin: { lat: 32.06, lng: 34.77 },
    });
    const run = await runTool("build_walk", JSON.stringify({ stop_ids: ["c1", "zzz"] }), {
      ...found.state,
      limitsSettled: true,
    });
    expect(run.action?.stops).toHaveLength(1);
    expect(run.action?.origin).toEqual({ lat: 32.06, lng: 34.77 });
  });

  it("a failing lookup becomes an answer, not an exception", async () => {
    vi.mocked(searchTextPlaces).mockRejectedValue(new Error("boom"));
    const run = await runTool("search_place", JSON.stringify({ query: "x" }), EMPTY_STATE);
    expect(run.output).toMatch(/failed/);
  });
});

describe("runAssistantTurn", () => {
  it("runs a tool call, then returns the model's reply", async () => {
    vi.mocked(searchTextPlaces).mockResolvedValue([habima]);
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: "t1", type: "function", function: { name: "search_place", arguments: '{"query":"הבימה"}' } },
        ],
        inTok: 100,
        outTok: 10,
      })
      .mockResolvedValueOnce({ content: "מצאתי את הבימה, מתאים?", toolCalls: [], inTok: 150, outTok: 12 });

    const result = await runAssistantTurn(
      {
        summary: null,
        history: [{ role: "user", content: "אני רוצה את הבימה" }],
        state: EMPTY_STATE,
        choice: { provider: "openai", model: "gpt-6.1-sol" },
      },
      { call },
    );
    expect(result.reply).toBe("מצאתי את הבימה, מתאים?");
    expect(result.state.candidates).toHaveLength(1);
    expect(call).toHaveBeenCalledTimes(2);
    // The tool result handed back to the model is the compact one.
    const second = call.mock.calls[1][0].messages.at(-1);
    expect(second.role).toBe("tool");
    expect(second.content).not.toMatch(/lat/);
  });

  it("stops after a build and returns the action", async () => {
    const state = {
      ...EMPTY_STATE,
      limitsSettled: true,
      origin: { lat: 1, lng: 1 },
      candidates: [{ id: "c1", name: "A", coordinates: { lat: 1, lng: 1 }, category: "food" as const, placeId: "p" }],
    };
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: "t1", type: "function", function: { name: "build_walk", arguments: '{"stop_ids":["c1"]}' } }],
        inTok: 1,
        outTok: 1,
      })
      .mockResolvedValueOnce({ content: "בונה!", toolCalls: [], inTok: 1, outTok: 1 });
    const result = await runAssistantTurn(
      { summary: "s", history: [{ role: "user", content: "yes" }], state, choice: { provider: "openai", model: "gpt-6.1-sol" } },
      { call },
    );
    expect(result.action?.type).toBe("build");
    expect(result.reply).toBe("בונה!");
  });
});
