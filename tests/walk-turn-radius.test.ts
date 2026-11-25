import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const searchTextPlaces = vi.fn();
const searchNearbyPlaces = vi.fn();
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: (...a: unknown[]) => searchTextPlaces(...a),
  searchNearbyPlaces: (...a: unknown[]) => searchNearbyPlaces(...a),
}));

import { runWalkTurn } from "@/lib/assistant/walk-turn";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;
const position = { lat: 32, lng: 34.8 };
const M = 111_320;
const place = (name: string, northM: number) => ({ name, coordinates: { lat: 32 + northM / M, lng: 34.8 } });

/** A scripted model: asks find_places with the given args, then adds the first place it was offered. */
function scripted(findArgs: Record<string, unknown>) {
  const seen: string[] = [];
  let toolOutput = "";
  let step = 0;
  const call = vi.fn(async (req: { messages: Array<{ role: string; content: string | null }> }) => {
    if (step === 0) seen.push(String(req.messages[0].content));
    step += 1;
    if (step === 1) {
      return { content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "find_places", arguments: JSON.stringify(findArgs) } }], inTok: 1, outTok: 1 };
    }
    if (step === 2) {
      toolOutput = String(req.messages.at(-1)?.content);
      return { content: null, toolCalls: [{ id: "c2", type: "function", function: { name: "propose_plan", arguments: JSON.stringify({ add: ["p1"], skip: [] }) } }], inTok: 1, outTok: 1 };
    }
    return { content: "added", toolCalls: [], inTok: 1, outTok: 1 };
  });
  return { call, seen, output: () => toolOutput };
}

beforeEach(() => {
  searchTextPlaces.mockReset();
  searchNearbyPlaces.mockReset();
  searchTextPlaces.mockResolvedValue([place("Far Museum", 1200), place("Near Fountain", 300)]);
});

describe("a radius the walker asked for", () => {
  it("is told to the model, passed to the text search as its bias, and filters the places it offers", async () => {
    const s = scripted({ query: "attraction" });
    const r = await runWalkTurn({ history: [{ role: "user", content: "x" }], position, stops: [], choice, radiusM: 500 }, s.call as never);
    expect(s.seen[0]).toContain("within 500 m");
    expect(searchTextPlaces.mock.calls[0][4]).toBe(500);
    const offered = JSON.parse(s.output()) as Array<{ name: string; dist_m: number }>;
    expect(offered.map((p) => p.name)).toEqual(["Near Fountain"]);
    expect(r.proposal?.adds).toEqual([{ name: "Near Fountain", coordinates: place("Near Fountain", 300).coordinates, distM: expect.any(Number) }]);
  });

  it("overrides a larger radius_m the model passes", async () => {
    const s = scripted({ query: "attraction", radius_m: 3000 });
    await runWalkTurn({ history: [{ role: "user", content: "x" }], position, stops: [], choice, radiusM: 500 }, s.call as never);
    expect((JSON.parse(s.output()) as unknown[]).length).toBe(1);
  });

  it("a radius_m the model chose itself also filters a text search; without any radius a text search is not filtered", async () => {
    const own = scripted({ query: "attraction", radius_m: 500 });
    await runWalkTurn({ history: [{ role: "user", content: "x" }], position, stops: [], choice }, own.call as never);
    expect((JSON.parse(own.output()) as unknown[]).length).toBe(1);

    const none = scripted({ query: "attraction" });
    await runWalkTurn({ history: [{ role: "user", content: "x" }], position, stops: [], choice }, none.call as never);
    expect((JSON.parse(none.output()) as unknown[]).length).toBe(2);
    expect(none.seen[0]).not.toContain("The walker asked for places within");
  });

  it("says nothing was found when every place is beyond the radius", async () => {
    searchTextPlaces.mockResolvedValue([place("Far Museum", 1200)]);
    const s = scripted({ query: "attraction" });
    await runWalkTurn({ history: [{ role: "user", content: "x" }], position, stops: [], choice, radiusM: 500 }, s.call as never);
    expect(s.output()).toContain("nothing found");
  });
});
