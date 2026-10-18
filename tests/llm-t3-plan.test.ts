import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalkEscalationLimiter } from "@/lib/llm/escalation";
import {
  applyPlanOrder,
  countStatedConstraints,
  maybeReorderWithT3,
  t3PlanEnabled,
} from "@/lib/llm/plan-escalation";
import type { PlanResult } from "@/lib/llm/tasks/plan";
import type { ProviderCall } from "@/lib/llm/types";
import type { Attraction } from "@/lib/types";

const att = (id: string, over: Partial<Attraction> = {}): Attraction => ({
  id,
  name: `Name ${id}`,
  coordinates: { lat: 32.08, lng: 34.78 },
  category: "landmark",
  avgVisitMinutes: 20,
  tags: {},
  ...over,
});
const A = [att("a"), att("b"), att("c")];

const plan = (over: Partial<PlanResult> = {}): PlanResult => ({
  decision: "plan",
  stops: [
    { placeId: "c", role: "anchor", reason: "r" },
    { placeId: "a", role: "optional", reason: "r" },
  ],
  constraints: {},
  question: null,
  warnings: [],
  summary: "s",
  draftChanges: [],
  injectionDetected: false,
  ...over,
});

const ENV_ON = {
  LLM_T3_PLAN: "1",
  LLM_PROVIDER_T3: "openai",
  LLM_MODEL_T3: "gpt-6.1-sol",
};
const budget = { reserve: vi.fn(async () => {}), settle: vi.fn(async () => {}) };
const MANY = { constraintCount: 4 };

let provider: ReturnType<typeof vi.fn<ProviderCall>>;
beforeEach(() => {
  provider = vi.fn<ProviderCall>(async () => ({ text: JSON.stringify(plan()), inTok: 10, outTok: 10 }));
  budget.reserve.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function run(over: Partial<Parameters<typeof maybeReorderWithT3>[0]> = {}) {
  return maybeReorderWithT3({
    prompt: "three famous places, 2 hours, within 1km, and food",
    attractions: A,
    needIds: new Set(["c"]),
    signals: MANY,
    walkKey: "w1",
    ctx: { userId: "u", ip: "1.1.1.1" },
    env: ENV_ON,
    deps: { providers: { openai: provider }, budget },
    ...over,
  });
}

describe("T3 plan call site (extract-places)", () => {
  it("is off unless LLM_T3_PLAN=1: no call, same array, even with every trigger", async () => {
    for (const env of [{}, { ...ENV_ON, LLM_T3_PLAN: "0" }, { ...ENV_ON, LLM_T3_PLAN: "true" }]) {
      const out = await run({ env, signals: { constraintCount: 9, invalidOrNeedsPlanning: true } });
      expect(out).toBe(A);
    }
    expect(provider).not.toHaveBeenCalled();
    expect(t3PlanEnabled({ LLM_T3_PLAN: " 1 " })).toBe(true);
  });

  it("no trigger (3 constraints or fewer) -> no T3 call", async () => {
    expect(await run({ signals: { constraintCount: 3 } })).toBe(A);
    expect(await run({ signals: {} })).toBe(A);
    expect(provider).not.toHaveBeenCalled();
  });

  it("fewer than two candidates -> nothing to order, no call", async () => {
    const one = [A[0]];
    expect(await run({ attractions: one })).toBe(one);
    expect(provider).not.toHaveBeenCalled();
  });

  it("trigger -> called once in escalate mode, reorders only, and the request carries ids and verified data only", async () => {
    const out = await run({ mode: "escalate" });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(out.map((a) => a.id)).toEqual(["c", "a", "b"]);
    expect(out.map((a) => a.id).sort()).toEqual(["a", "b", "c"]); // a permutation
    expect(out[0]).toBe(A[2]); // the very same objects, not model-supplied copies

    const req = provider.mock.calls[0][0];
    expect(req.model).toBe("gpt-6.1-sol");
    expect(req.taskName).toBe("plan");
    expect(req.user).toContain("ESCALATION: many-constraints");
    expect(req.user).toContain("ASK_BUDGET: 0");
    const candidates = JSON.parse(/<data source="candidates">([\s\S]*?)<\/data>/.exec(req.user)?.[1] ?? "[]");
    expect(candidates.map((c: { id: string }) => Object.keys(c).sort())).toEqual(
      A.map(() => ["avgVisitMinutes", "category", "id", "name", "source"]),
    );
    expect(candidates.find((c: { id: string }) => c.id === "c").source).toBe("need");
    expect(budget.reserve).toHaveBeenCalledTimes(1);
  });

  it("once-per-walk mode caps it: the second request of the same walk keeps the draft", async () => {
    const limiter = new WalkEscalationLimiter();
    const first = await run({ mode: "once-per-walk", limiter });
    const second = await run({ mode: "once-per-walk", limiter });
    const other = await run({ mode: "once-per-walk", limiter, walkKey: "w2" });
    expect(provider).toHaveBeenCalledTimes(2);
    expect(first.map((a) => a.id)).toEqual(["c", "a", "b"]);
    expect(second).toBe(A);
    expect(other.map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("escalate mode has no cap: every complex request goes to T3", async () => {
    await run({ mode: "escalate" });
    await run({ mode: "escalate" });
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("an invalid placeId is rejected by parsePlan and the draft is kept (no fallback provider configured)", async () => {
    provider.mockResolvedValue({
      text: JSON.stringify(plan({ stops: [{ placeId: "invented", role: "anchor", reason: "r" }] })),
      inTok: 1,
      outTok: 1,
    });
    expect(await run()).toBe(A);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a provider error", () => provider.mockRejectedValue(new Error("boom"))],
    ["non-JSON", () => provider.mockResolvedValue({ text: "not json", inTok: 1, outTok: 1 })],
    ["a spent budget", () => budget.reserve.mockRejectedValueOnce(new Error("budget"))],
  ])("%s keeps the draft", async (_n, arrange) => {
    arrange();
    expect(await run()).toBe(A);
  });

  it("a model that asks, declines or flags injection changes nothing", () => {
    expect(applyPlanOrder(A, plan({ decision: "ask" }))).toBe(A);
    expect(applyPlanOrder(A, plan({ decision: "decline" }))).toBe(A);
    expect(applyPlanOrder(A, plan({ injectionDetected: true }))).toBe(A);
    expect(applyPlanOrder(A, plan({ stops: [] }))).toBe(A);
  });

  it("never drops or duplicates a stop, even when the model repeats ids or omits some", () => {
    const dup = plan({
      stops: ["b", "b", "a", "b"].map((placeId) => ({ placeId, role: "optional" as const, reason: "r" })),
    });
    expect(applyPlanOrder(A, dup).map((a) => a.id)).toEqual(["b", "a", "c"]);
  });
});

describe("countStatedConstraints", () => {
  it("counts each pinned-down thing once and every stated need", () => {
    expect(countStatedConstraints({})).toBe(0);
    expect(
      countStatedConstraints({
        durationMinutes: 120,
        stopCount: 3,
        notableOnly: true,
        maxEndDistanceKm: 1,
        searchRadiusKm: null,
        needs: ["food", "park"],
      }),
    ).toBe(6);
    expect(countStatedConstraints({ notableOnly: false, durationMinutes: null })).toBe(0);
  });
});

describe("habit data never reaches an LLM", () => {
  it("no LLM module or LLM-calling route imports the habit modules", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
      });
    const files = [
      ...walk("src/lib/llm"),
      "src/lib/api/gemini-client.ts",
      "src/app/api/extract-places/route.ts",
    ];
    const offenders = files.filter((f) =>
      /habit-model|habit-ticker|habit-hints|habit-ask-log|routine-habits|companion-memory/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
