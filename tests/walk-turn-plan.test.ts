import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const search = vi.fn();
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: (...a: unknown[]) => search(...a),
  searchNearbyPlaces: vi.fn(async () => []),
}));

import { runWalkTurn, WALK_SYSTEM } from "@/lib/assistant/walk-turn";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;
const place = (name: string, i: number) => ({ name, coordinates: { lat: 32 + i / 1000, lng: 34 } });
const tc = (id: string, name: string, args: object) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });
type Req = { messages: Array<{ role: string; content: string | null }>; tools: Array<{ function: { name: string } }> };

/** Script of model steps; each gets the request so far. */
function model(steps: Array<(req: Req) => { content: string | null; toolCalls: ReturnType<typeof tc>[] }>) {
  let n = 0;
  const reqs: Req[] = [];
  const call = vi.fn(async (req: Req) => {
    reqs.push(req);
    const step = steps[Math.min(n, steps.length - 1)];
    n += 1;
    return { ...step(req), inTok: 1, outTok: 1 };
  });
  return { call, reqs };
}
const find = () => ({ content: null, toolCalls: [tc("f", "find_places", { query: "view" })] });
const run = (m: ReturnType<typeof model>, extra: Record<string, unknown> = {}) =>
  runWalkTurn({ history: [{ role: "user", content: "add something" }], position: { lat: 32, lng: 34 }, stops: ["A", "B", "C"], choice, ...extra }, m.call as never);

describe("propose_plan", () => {
  it("offers propose_plan and nothing_found, and none of the old propose_ tools", async () => {
    const m = model([() => ({ content: "hi", toolCalls: [] })]);
    await run(m);
    const names = m.reqs[0].tools.map((t) => t.function.name);
    expect(names).toEqual(expect.arrayContaining(["propose_plan", "nothing_found", "find_places", "remember"]));
    expect(names.some((n) => n.startsWith("propose_") && n !== "propose_plan")).toBe(false);
  });

  it("returns the proposal with an empty reply even if the model wrote prose", async () => {
    search.mockResolvedValue([place("Erez", 1), place("Khan", 2)]);
    const m = model([find, () => ({ content: "I added Erez, does it fit?", toolCalls: [tc("p", "propose_plan", { add: ["p1"], skip: [2] })] })]);
    const r = await run(m);
    expect(r.reply).toBe("");
    expect(r.proposal).toEqual({ adds: [{ name: "Erez", coordinates: place("Erez", 1).coordinates, distM: expect.any(Number) }], skipStopIndexes: [1], headBack: false });
  });

  it("the last propose_plan of a turn wins", async () => {
    search.mockResolvedValue([place("Erez", 1), place("Khan", 2)]);
    const m = model([find, () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1"], skip: [] }), tc("b", "propose_plan", { add: ["p2"], skip: [] })] })]);
    const r = await run(m);
    expect(r.proposal?.adds.map((a) => a.name)).toEqual(["Khan"]);
  });

  it("caps adds at three", async () => {
    search.mockResolvedValue([1, 2, 3, 4, 5].map((i) => place(`P${i}`, i)));
    const m = model([find, () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1", "p2", "p3", "p4"], skip: [] })] })]);
    expect((await run(m)).proposal?.adds).toHaveLength(3);
  });

  it("head_back together with add or skip is an error the model sees, and nothing is proposed from it", async () => {
    search.mockResolvedValue([place("Erez", 1)]);
    let toolReply = "";
    const m = model([
      find,
      () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1"], skip: [], head_back: true })] }),
      (req) => {
        toolReply = String(req.messages.at(-1)?.content);
        return { content: "sorry", toolCalls: [] };
      },
    ]);
    const r = await run(m);
    expect(toolReply).toContain("error");
    expect(r.proposal).toBeUndefined();
  });

  it("head_back alone is a proposal", async () => {
    const m = model([() => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: [], skip: [], head_back: true })] })]);
    expect((await run(m)).proposal).toEqual({ adds: [], skipStopIndexes: [], headBack: true });
  });

  it("an unknown place id or stop number is an error, not a proposal", async () => {
    const m = model([
      () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p9"], skip: [] })] }),
      () => ({ content: null, toolCalls: [tc("b", "propose_plan", { add: [], skip: [7] })] }),
      () => ({ content: "no", toolCalls: [] }),
    ]);
    expect((await run(m)).proposal).toBeUndefined();
  });

  it("nothing_found returns noMatch with an empty reply", async () => {
    const m = model([() => ({ content: "Sorry, nothing", toolCalls: [tc("n", "nothing_found", { reason: "outside_radius" })] })]);
    const r = await run(m);
    expect(r.noMatch).toBe("outside_radius");
    expect(r.proposal).toBeUndefined();
    expect(r.reply).toBe("");
  });

  it("puts the open proposal in the prompt as fenced data", async () => {
    const m = model([() => ({ content: "ok", toolCalls: [] })]);
    await run(m, { pending: { adds: ["Erez Lookout"], drops: ["Old Khan"], headBack: false } });
    const background = String(m.reqs[0].messages[1].content);
    expect(background).toContain("Erez Lookout");
    expect(background).toContain("Old Khan");
    expect(background).toContain("<data");
  });
});

describe("the walk prompt", () => {
  it("no longer asks whether it fits, mentions hours, or carries a command line", () => {
    expect(WALK_SYSTEM).not.toMatch(/whether it fits/);
    expect(WALK_SYSTEM).not.toMatch(/You do not know opening hours/);
    expect(WALK_SYSTEM).not.toMatch(/The walker must tap/);
    expect(WALK_SYSTEM).toMatch(/call propose_plan ONCE with the complete change and write no text/);
    expect(WALK_SYSTEM).toMatch(/call nothing_found and write no text/);
    expect(WALK_SYSTEM).toMatch(/Never mention opening hours, prices, crowds or accessibility unless the walker asked about them/);
    expect(WALK_SYSTEM).toMatch(/open proposal/);
  });

  it("with maxAdds 1, two ids is an error the model sees; one id then becomes the proposal", async () => {
    search.mockResolvedValue([place("Erez", 1), place("Khan", 2)]);
    let toolReply = "";
    const m = model([
      find,
      () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1", "p2"], skip: [] })] }),
      (req) => {
        toolReply = String(req.messages.at(-1)?.content);
        return { content: null, toolCalls: [tc("b", "propose_plan", { add: ["p1"], skip: [] })] };
      },
    ]);
    const r = await run(m, { maxAdds: 1 });
    expect(toolReply).toContain("the walker asked for 1 place(s): propose exactly 1");
    expect(r.proposal?.adds.map((a) => a.name)).toEqual(["Erez"]);
  });

  it("with maxAdds 2, one id is fine (fewer than asked is never an error) and three is an error", async () => {
    search.mockResolvedValue([1, 2, 3].map((i) => place(`P${i}`, i)));
    const ok = model([find, () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1"], skip: [] })] })]);
    expect((await run(ok, { maxAdds: 2 })).proposal?.adds).toHaveLength(1);
    const bad = model([find, () => ({ content: null, toolCalls: [tc("a", "propose_plan", { add: ["p1", "p2", "p3"], skip: [] })] }), () => ({ content: "no", toolCalls: [] })]);
    expect((await run(bad, { maxAdds: 2 })).proposal).toBeUndefined();
  });

  it("the prompt asks for exactly what was asked and never an unrequested add", () => {
    expect(WALK_SYSTEM).toMatch(/smallest/);
    expect(WALK_SYSTEM).not.toMatch(/Be natural and free/);
    expect(WALK_SYSTEM).not.toMatch(/offer to add a stop or a longer loop/);
  });
});
