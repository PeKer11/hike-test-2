import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/assistant/tools", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/assistant/tools")>();
  return {
    ...real,
    runTool: vi.fn(async (_name: string, _args: string, state: unknown) => ({
      state,
      output: JSON.stringify({
        ok: true,
        not_checked: [
          { rule: "open_hours", status: "not_checked" },
          { rule: "avoid_streets", status: "not_checked" },
        ],
      }),
      action: { origin: { lat: 1, lng: 1 }, params: {}, stops: [] },
    })),
  };
});

import { EMPTY_STATE } from "@/lib/assistant/state";
import { runAssistantTurn } from "@/lib/assistant/turn";

describe("the 'could not fully verify' footer", () => {
  it("leaves out opening hours with no data, keeps other unchecked rules", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: "t1", type: "function", function: { name: "build_walk", arguments: "{}" } }],
        inTok: 1,
        outTok: 1,
      })
      .mockResolvedValueOnce({ content: "Built.", toolCalls: [], inTok: 1, outTok: 1 });
    const result = await runAssistantTurn(
      { summary: null, history: [{ role: "user", content: "go" }], state: EMPTY_STATE, choice: { provider: "openai", model: "gpt-6.1-sol" } },
      { call },
    );
    expect(result.reply).toContain("Could not fully verify");
    expect(result.reply).not.toMatch(/opening hours/i);
    expect(result.reply).toMatch(/street/i);
  });
});
