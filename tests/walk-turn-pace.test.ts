import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paceLine, runWalkTurn } from "@/lib/assistant/walk-turn";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;
const timing = (spareMin: number | null) => ({
  elapsedMin: 20, remainingMin: 30, availableMin: 50, overBudget: false, plannedKmh: 2, measuredKmh: 4, spareMin,
});

describe("paceLine (both directions)", () => {
  it("ahead: never cut, offer to add", () => {
    const l = paceLine(timing(25));
    expect(l).toMatch(/AHEAD/);
    expect(l).toMatch(/never propose cutting/);
    expect(l).toMatch(/planned at 2 km\/h.*4 km\/h/);
  });
  it("behind: more time or skip one stop", () => {
    const l = paceLine(timing(-25));
    expect(l).toMatch(/BEHIND/);
    expect(l).toMatch(/more time or skipping one stop/);
  });
  it("says nothing within 8 minutes either way, or with no number", () => {
    expect(paceLine(timing(5))).toBe("");
    expect(paceLine(timing(-5))).toBe("");
    expect(paceLine(timing(null))).toBe("");
  });
});

function skipModel() {
  let n = 0;
  const seenSystem: string[] = [];
  const call = vi.fn(async (req: { messages: Array<{ role: string; content: string | null }> }) => {
    seenSystem.push(String(req.messages[0].content));
    n += 1;
    if (n === 1)
      return {
        content: null, inTok: 10, outTok: 10,
        toolCalls: [{ id: "t1", type: "function" as const, function: { name: "propose_skip_stop", arguments: JSON.stringify({ stop_number: 1 }) } }],
      };
    return { content: "ok", toolCalls: [], inTok: 10, outTok: 10 };
  });
  return { call, seenSystem };
}
const turn = (spareMin: number, text: string) => {
  const m = skipModel();
  return runWalkTurn(
    { history: [{ role: "user", content: text }], position: { lat: 32, lng: 34 }, stops: ["A", "B"], timing: timing(spareMin), choice },
    m.call as never,
  ).then((r) => ({ ...r, m }));
};

describe("runWalkTurn skip guard", () => {
  it("ahead by 25 and no skip intent: the model's skip is dropped", async () => {
    const r = await turn(25, "what else is nearby?");
    expect(r.actions).toEqual([]);
    expect(r.m.seenSystem[0]).toMatch(/AHEAD/);
  });
  it("ahead by 25 but the walker asked to skip: kept", async () => {
    const r = await turn(25, "skip the first stop");
    expect(r.actions).toEqual([{ kind: "skip-stop", stopIndex: 0 }]);
  });
  it("behind by 25: kept", async () => {
    const r = await turn(-25, "what else is nearby?");
    expect(r.actions).toEqual([{ kind: "skip-stop", stopIndex: 0 }]);
  });
});
