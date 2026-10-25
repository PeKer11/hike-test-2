import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/assistant/tools", () => ({
  ASSISTANT_TOOLS: [{ type: "function", function: { name: "build_walk", description: "", parameters: {} } }],
  runTool: vi.fn(async (_name: string, raw: string, state: { candidates: unknown[] }) => {
    const ids = (JSON.parse(raw).stop_ids ?? []) as string[];
    const stops = ids.map((id) => (state.candidates as Array<{ id: string }>).find((c) => c.id === id)).filter(Boolean);
    return { output: "{}", state, action: { type: "build", origin: { lat: 0, lng: 0 }, params: {}, stops, ordered: true } };
  }),
}));

import { runAiBuild } from "@/lib/ai-builder/run";

const choice = { provider: "openai", model: "m" } as never;
const at = (id: string) => ({ id, name: id, coordinates: { lat: 1, lng: 1 }, category: "park" as const, avgVisitMinutes: 25, tags: {} });
const req = { origin: { lat: 0, lng: 0 }, reason: "test", params: {}, keep: [at("a"), at("b")], pinnedIds: ["b"], visitedIds: [] };
const toolCall = (ids: string[]) => ({ content: null, inTok: 1, outTok: 1, toolCalls: [{ id: "t", type: "function", function: { name: "build_walk", arguments: JSON.stringify({ stop_ids: ids }) } }] });

describe("runAiBuild", () => {
  it("returns the stops the model built, with the walker's own attractions restored", async () => {
    const call = vi.fn().mockResolvedValue(toolCall(["k1", "k2"]));
    const out = await runAiBuild(req, choice, undefined, call as never);
    expect(out.stops.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("sends the model back when a pinned stop was left out, then accepts the fixed walk", async () => {
    const call = vi.fn().mockResolvedValueOnce(toolCall(["k1"])).mockResolvedValueOnce(toolCall(["k1", "k2"]));
    const out = await runAiBuild(req, choice, undefined, call as never);
    expect(out.stops.map((s) => s.id)).toEqual(["a", "b"]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("fails when the model never builds", async () => {
    const call = vi.fn().mockResolvedValue({ content: "hmm", inTok: 1, outTok: 1, toolCalls: [] });
    await expect(runAiBuild(req, choice, undefined, call as never)).rejects.toThrow();
  });
});
