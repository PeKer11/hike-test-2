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

  it("never runs a tool the builder was not offered (set_start, remember, set_walk_params)", async () => {
    const { runTool } = await import("@/lib/assistant/tools");
    vi.mocked(runTool).mockClear();
    const hijacked = {
      content: null,
      inTok: 1,
      outTok: 1,
      toolCalls: ["set_start", "set_walk_params", "remember"].map((name, i) => ({ id: `h${i}`, type: "function", function: { name, arguments: "{}" } })),
    };
    const call = vi.fn().mockResolvedValueOnce(hijacked).mockResolvedValueOnce(toolCall(["k1", "k2"]));
    const out = await runAiBuild(req, choice, undefined, call as never);
    expect(out.stops).toHaveLength(2);
    expect(vi.mocked(runTool).mock.calls.map((c) => c[0])).toEqual(["build_walk"]);
    const replies = call.mock.calls[1][0].messages.filter((m: { role: string }) => m.role === "tool");
    expect(replies.slice(0, 3).map((m: { content: string }) => m.content)).toEqual(Array(3).fill(JSON.stringify({ error: "tool not available" })));
  });

  it("stops at its cost ceiling, reporting what it already spent", async () => {
    const call = vi.fn().mockResolvedValue({ content: "hmm", inTok: 40_000, outTok: 0, toolCalls: [] });
    const err = await runAiBuild(req, { provider: "openai", model: "gpt-6.1-sol" } as never, undefined, call as never, undefined, 100_000).catch((e) => e);
    expect(err.name).toBe("BilledFailureError");
    expect(err.billedMicros).toBeGreaterThan(0);
    expect(call.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("fails when the model never builds", async () => {
    const call = vi.fn().mockResolvedValue({ content: "hmm", inTok: 1, outTok: 1, toolCalls: [] });
    await expect(runAiBuild(req, choice, undefined, call as never)).rejects.toThrow();
  });
});
