import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createBudgetGuard } from "@/lib/llm/budget";
import { resolveReasoningEffort, resolveT3Mode } from "@/lib/llm/config";
import {
  escalationReason,
  maybeEscalate,
  WalkEscalationLimiter,
} from "@/lib/llm/escalation";
import { runLlm } from "@/lib/llm/llm-client";
import { callOpenAi } from "@/lib/llm/providers/openai";
import { MissingKeyError } from "@/lib/llm/providers/http";
import { LlmBudgetExceededError, UNMETERED, type LlmResult, type LlmTask } from "@/lib/llm/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveReasoningEffort", () => {
  it("is per tier, with the tier var beating the global one", () => {
    const env = { LLM_REASONING_EFFORT: "low", LLM_REASONING_EFFORT_T1: "none" };
    expect(resolveReasoningEffort(1, "gpt-6-luna", env)).toBe("none");
    expect(resolveReasoningEffort(3, "gpt-6-luna", env)).toBe("low");
  });
  it("drops garbage and raises none to low for sol (which cannot disable reasoning)", () => {
    expect(resolveReasoningEffort(1, "m", { LLM_REASONING_EFFORT: "turbo" })).toBeUndefined();
    expect(resolveReasoningEffort(3, "gpt-6.1-sol", { LLM_REASONING_EFFORT_T3: "none" })).toBe("low");
    expect(resolveReasoningEffort(1, "gpt-6-luna", { LLM_REASONING_EFFORT_T1: "none" })).toBe("none");
  });
});

describe("openai request body", () => {
  it("sends the request's validated effort, not the process env", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("LLM_REASONING_EFFORT", "high");
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }));
    vi.stubGlobal("fetch", f);
    const base = { model: "gpt-6-luna", system: "s", user: "u", jsonSchema: {}, maxOutputTokens: 9, signal: new AbortController().signal, timeoutMs: 1, taskName: "eval" as const };
    await callOpenAi({ ...base, reasoningEffort: "none" });
    await callOpenAi(base);
    const bodies = f.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0].reasoning_effort).toBe("none");
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });
});

describe("fallback on a missing key", () => {
  const task: LlmTask<{ ok: boolean }> = {
    name: "eval", system: "s", user: "u", schema: z.object({ ok: z.boolean() }),
    parse: (t) => JSON.parse(t), maxOutputTokens: 10, tier: 1,
  };
  it("switches to the fallback provider when the primary has no key", async () => {
    const anthropic = vi.fn(async () => ({ text: '{"ok":true}', inTok: 1, outTok: 1 }));
    const r = await runLlm(task, UNMETERED, {
      env: { LLM_PROVIDER: "openai", LLM_MODEL: "gpt-6-luna", LLM_FALLBACK_PROVIDER: "anthropic" },
      providers: { openai: async () => { throw new MissingKeyError("OPENAI_API_KEY"); }, anthropic },
    });
    expect(r.usedFallback).toBe(true);
    expect(anthropic).toHaveBeenCalledOnce();
  });
});

describe("budget guard failing closed", () => {
  const ctx = { userId: null, ip: "1.1.1.1" };
  it("refuses when there is no usage store and failClosed is on", async () => {
    await expect(createBudgetGuard(null, { failClosed: true }).reserve(ctx)).rejects.toBeInstanceOf(LlmBudgetExceededError);
  });
  it("refuses when the store throws and failClosed is on", async () => {
    const store = { bump: async () => { throw new Error("down"); } };
    await expect(createBudgetGuard(store as never, { failClosed: true }).reserve(ctx)).rejects.toBeInstanceOf(LlmBudgetExceededError);
  });
  it("still allows the call when failClosed is off", async () => {
    await expect(createBudgetGuard(null, { failClosed: false }).reserve(ctx)).resolves.toBeUndefined();
  });
});

describe("escalation", () => {
  const fakeResult = { data: 1, provider: "openai", model: "gpt-6.1-sol", inTok: 1, outTok: 1, ms: 1, usedFallback: false } as LlmResult<number>;

  it("maps each code-known trigger to a reason and stays quiet otherwise", () => {
    expect(escalationReason({})).toBeNull();
    expect(escalationReason({ constraintCount: 3 })).toBeNull();
    expect(escalationReason({ constraintCount: 4 })).toBe("many-constraints");
    expect(escalationReason({ lowConfidence: true })).toBe("low-confidence");
    expect(escalationReason({ solverNoSolution: true })).toBe("solver-no-solution");
    expect(escalationReason({ nearTie: true })).toBe("near-tie");
    expect(escalationReason({ preferenceConflict: true })).toBe("preference-conflict");
    expect(escalationReason({ invalidOrNeedsPlanning: true })).toBe("invalid-or-needs-planning");
  });

  it("does not call tier 3 without a trigger", async () => {
    const run = vi.fn(async () => fakeResult);
    const out = await maybeEscalate({ signals: {}, walkKey: "w", run, mode: "escalate" });
    expect(out.escalated).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("escalate mode: every complex task goes to tier 3", async () => {
    const run = vi.fn(async () => fakeResult);
    const limiter = new WalkEscalationLimiter();
    for (let i = 0; i < 3; i++) {
      const out = await maybeEscalate({ signals: { nearTie: true }, walkKey: "w", run, mode: "escalate", limiter });
      expect(out.escalated).toBe(true);
    }
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("once-per-walk mode: the second complex task in the same walk stays on tier 1", async () => {
    const run = vi.fn(async () => fakeResult);
    const limiter = new WalkEscalationLimiter();
    const a = await maybeEscalate({ signals: { nearTie: true }, walkKey: "w", run, mode: "once-per-walk", limiter });
    const b = await maybeEscalate({ signals: { nearTie: true }, walkKey: "w", run, mode: "once-per-walk", limiter });
    const c = await maybeEscalate({ signals: { nearTie: true }, walkKey: "other", run, mode: "once-per-walk", limiter });
    expect([a.escalated, b.escalated, c.escalated]).toEqual([true, false, true]);
    expect(b).toMatchObject({ skipped: "walk-cap" });
  });

  it("a failing tier-3 call keeps the draft instead of throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await maybeEscalate({ signals: { lowConfidence: true }, walkKey: "w", mode: "escalate", run: async () => { throw new Error("boom"); } });
    expect(out).toEqual({ escalated: false, reason: "low-confidence" });
  });

  it("defaults to escalate mode", () => {
    expect(resolveT3Mode({})).toBe("escalate");
    expect(resolveT3Mode({ LLM_T3_MODE: "once-per-walk" })).toBe("once-per-walk");
  });
});
