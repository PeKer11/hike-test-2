import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createBudgetGuard, type UsageStore } from "@/lib/llm/budget";
import { CANDIDATES_MAX_CHARS, fitListToChars } from "@/lib/llm/fit";
import { runLlm } from "@/lib/llm/llm-client";
import { estimateCostMicros } from "@/lib/llm/pricing";
import { UNTRUSTED_HARD_MAX_CHARS, UNTRUSTED_MAX_CHARS, wrapUntrusted } from "@/lib/llm/sanitize";
import { buildPlanTask } from "@/lib/llm/tasks/plan";
import type { LlmTask, ProviderCall } from "@/lib/llm/types";

const task = (): LlmTask<string> => ({
  name: "eval",
  system: "SYS",
  user: "USER",
  schema: z.object({ a: z.string() }),
  parse: (t) => (JSON.parse(t) as { a: string }).a,
  maxOutputTokens: 100,
  tier: 1,
});

function guard() {
  const bumps: Array<{ calls: number; micros: number }> = [];
  const store: UsageStore = {
    bump: async (_k, _d, calls, micros) => {
      bumps.push({ calls, micros });
      return { callerCalls: 1, callerCostMicros: 0, globalCostMicros: 0 };
    },
  };
  return { bumps, budget: createBudgetGuard(store) };
}

describe("budget settles billed attempts that did not produce an answer (R1)", () => {
  const ctx = { userId: "u1", ip: "1.1.1.1" };
  const bad: ProviderCall = async () => ({ text: "not json", inTok: 1000, outTok: 500 });
  const good: ProviderCall = async () => ({ text: '{"a":"x"}', inTok: 10, outTok: 5 });
  const model = "gemini-2.5-flash-lite";

  it("records the cost of a parse failure that is rethrown", async () => {
    const { bumps, budget } = guard();
    await expect(runLlm(task(), ctx, { budget, providers: { gemini: bad }, choice: { provider: "gemini", model } })).rejects.toBeInstanceOf(SyntaxError);
    expect(bumps.at(-1)?.micros).toBe(estimateCostMicros(model, 1000, 500));
  });

  it("records the failed primary AND the fallback that answered", async () => {
    const { bumps, budget } = guard();
    const r = await runLlm(task(), ctx, {
      budget,
      env: { LLM_PROVIDER: "gemini", LLM_MODEL_T1: model, LLM_FALLBACK_PROVIDER: "openai", LLM_FALLBACK_MODEL: "gpt-4o-mini" },
      providers: { gemini: bad, openai: good },
    });
    expect(r.usedFallback).toBe(true);
    const total = bumps.reduce((a, b) => a + b.micros, 0);
    expect(total).toBe(estimateCostMicros(model, 1000, 500) + estimateCostMicros("gpt-4o-mini", 10, 5));
  });
});

describe("untrusted block caps by structure (R1)", () => {
  it("shortens a candidate list by count, never mid-JSON, and only trusts the ids it sent", () => {
    const candidates = Array.from({ length: 400 }, (_, i) => ({ id: `c${i}`, name: `Place number ${i}`, tags: "x".repeat(40) }));
    const t = buildPlanTask({ request: "r", candidates, escalationReason: "e", uiLang: "en", askBudget: 0 });
    const block = t.untrusted!.find((u) => u.source === "candidates")!;
    const wrapped = wrapUntrusted(block);
    const json = wrapped.slice(wrapped.indexOf(">") + 1, wrapped.lastIndexOf("<"));
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed.length).toBeGreaterThan(20);
    expect(parsed.length).toBeLessThan(400);
    expect(json.length).toBeLessThanOrEqual(CANDIDATES_MAX_CHARS);
    // A stop outside the sent list is rejected even though the app had it.
    const plan = { decision: "plan", stops: [{ placeId: "c399", role: "anchor", reason: "r" }], constraints: {}, question: null, warnings: [], summary: "s", draftChanges: [], injectionDetected: false };
    expect(() => t.parse(JSON.stringify(plan))).toThrow(/candidate/);
  });

  it("default cap is unchanged; maxChars raises it up to a hard ceiling", () => {
    const text = "z".repeat(50_000);
    expect(wrapUntrusted({ source: "a", text }).length).toBeLessThan(UNTRUSTED_MAX_CHARS + 60);
    expect(wrapUntrusted({ source: "a", text, maxChars: 5_000 }).length).toBeGreaterThan(5_000);
    expect(wrapUntrusted({ source: "a", text, maxChars: 10 ** 9 }).length).toBeLessThan(UNTRUSTED_HARD_MAX_CHARS + 60);
  });

  it("fitListToChars keeps a prefix", () => {
    expect(fitListToChars(["aa", "bb", "cc"], 12)).toEqual(["aa", "bb"]);
    expect(fitListToChars([], 12)).toEqual([]);
  });
});
