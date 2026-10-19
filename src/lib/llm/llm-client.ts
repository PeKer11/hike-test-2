import "server-only";

import { z } from "zod";

import {
  createBudgetGuard,
  createSupabaseUsageStore,
  type BudgetGuard,
} from "./budget";
import { resolveLlmConfig, resolveReasoningEffort, type ProviderChoice } from "./config";
import { estimateCostMicros } from "./pricing";
import { composePlannerSystem, PLANNER_CORE, plannerPromptEnabled } from "./prompts/planner-v1";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callOpenAi, callOpenAiCompatible } from "./providers/openai";
import { MissingKeyError } from "./providers/http";
import { withRetry, statusOf } from "./retry";
import { UNTRUSTED_SYSTEM_RULE, wrapUntrusted } from "./sanitize";
import {
  LlmTimeoutError,
  UNMETERED,
  type LlmCallContext,
  type LlmProviderName,
  type LlmResult,
  type LlmTask,
  type LlmTier,
  type ProviderCall,
} from "./types";

/** Per-request timeout by tier; the old Gemini wrapper had none. */
export const TIER_TIMEOUT_MS: Record<LlmTier, number> = {
  1: 20_000,
  2: 20_000,
  3: 30_000,
};

const PROVIDERS: Record<LlmProviderName, ProviderCall> = {
  gemini: callGemini,
  anthropic: callAnthropic,
  openai: callOpenAi,
  "openai-compatible": callOpenAiCompatible,
};

export interface LlmDeps {
  providers?: Partial<Record<LlmProviderName, ProviderCall>>;
  env?: Record<string, string | undefined>;
  budget?: BudgetGuard;
  /** Overrides env-based provider selection (the eval runner uses this). */
  choice?: ProviderChoice;
}

let defaultGuard: BudgetGuard | undefined;
function defaultBudget(dailyBudgetUsd: number): BudgetGuard {
  defaultGuard ??= createBudgetGuard(createSupabaseUsageStore(), {
    dailyBudgetUsd,
  });
  return defaultGuard;
}

const SCHEMA_FAILURE = Symbol("llmSchemaFailure");

/** Worth switching provider for: our timeout, their 5xx/429, or an answer the parser rejected. */
function isFallbackEligible(error: unknown): boolean {
  if (error instanceof LlmTimeoutError || error instanceof MissingKeyError) return true;
  if ((error as { [SCHEMA_FAILURE]?: boolean } | null)?.[SCHEMA_FAILURE])
    return true;
  const status = statusOf(error);
  return status !== null && (status === 429 || status >= 500);
}

function composePrompt<T>(
  task: LlmTask<T>,
  env: Record<string, string | undefined>,
): { system: string; user: string } {
  // New tasks (no legacy baseline) always carry the shared CORE; the legacy
  // tier-1 prompts stay byte-identical unless the flag is on.
  const ownsMode = task.name === "plan" || task.name === "session-summary";
  const base = ownsMode
    ? `${PLANNER_CORE}\n\n${task.system}`
    : plannerPromptEnabled(env) && task.tier === 1
      ? composePlannerSystem("T1", task.system)
      : task.system;
  if (!task.untrusted?.length) return { system: base, user: task.user };
  return {
    system: `${base}\n\n${UNTRUSTED_SYSTEM_RULE}`,
    user: `${task.user}\n\n${task.untrusted.map(wrapUntrusted).join("\n")}`,
  };
}

/**
 * Run one task against the configured provider. `ctx` is required: a spent
 * per-caller (calls or dollars) or global cap throws LlmBudgetExceededError
 * before any provider is contacted, and the caller takes its no-LLM path. The
 * only opt-out is the explicit `UNMETERED` marker (eval runner, tests).
 *
 * One reserved call can still reach the provider twice (primary, then the
 * fallback after a timeout/5xx/bad JSON), and each of those retries a 429/5xx
 * up to MAX_ATTEMPTS times. Retried failures are normally not billed, so cost
 * is bounded at 2 billed responses per reserved call; settled cost feeds the
 * per-caller dollar cap.
 *
 * Failure semantics match the old wrapper: with no fallback configured the
 * provider's own error (or the parser's) is rethrown as it arrived.
 */
export async function runLlm<T>(
  task: LlmTask<T>,
  callCtx: LlmCallContext | typeof UNMETERED,
  deps: LlmDeps = {},
): Promise<LlmResult<T>> {
  if (callCtx !== UNMETERED && (typeof callCtx !== "object" || callCtx === null)) {
    throw new Error("runLlm requires a caller context (pass UNMETERED only for evals and tests).");
  }
  const ctx = callCtx === UNMETERED ? undefined : callCtx;
  const config = resolveLlmConfig(
    task.tier,
    deps.env ?? process.env,
    task.name,
  );
  const primary = deps.choice ?? config.primary;
  const providers = { ...PROVIDERS, ...deps.providers };
  const budget = ctx
    ? (deps.budget ?? defaultBudget(config.dailyBudgetUsd))
    : null;

  if (ctx && budget) await budget.reserve(ctx);

  const { system, user } = composePrompt(task, deps.env ?? process.env);
  const jsonSchema = z.toJSONSchema(task.schema) as Record<string, unknown>;
  const timeoutMs = task.timeoutMs ?? TIER_TIMEOUT_MS[task.tier];

  // Every response the provider billed for, including one the parser then rejected
  // and the fallback that followed: settled once at the end, even when the call throws.
  let billedMicros = 0;

  async function attempt(choice: ProviderChoice) {
    const startedAt = Date.now();
    const call = providers[choice.provider];
    if (!call) throw new Error(`Unknown LLM provider: ${choice.provider}`);

    const response = await withRetry(async () => {
      const signal = AbortSignal.timeout(timeoutMs);
      // Raced against the abort: an SDK that ignores the signal and hangs
      // still times out here instead of holding the request open.
      const timedOut = new Promise<never>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new LlmTimeoutError(timeoutMs)),
          { once: true },
        );
      });
      try {
        return await Promise.race([
          call({
            model: choice.model,
            system,
            user,
            jsonSchema,
            geminiSchema: task.geminiSchema,
            maxOutputTokens: task.maxOutputTokens,
            signal,
            timeoutMs,
            taskName: task.name,
            reasoningEffort: resolveReasoningEffort(
              task.tier,
              choice.model,
              deps.env ?? process.env,
            ),
          }),
          timedOut,
        ]);
      } catch (error) {
        if (signal.aborted) throw new LlmTimeoutError(timeoutMs);
        throw error;
      }
    });

    billedMicros += estimateCostMicros(choice.model, response.inTok, response.outTok);
    let data: T;
    try {
      data = task.parse(response.text);
    } catch (error) {
      const tagged = error instanceof Error ? error : new Error(String(error));
      (tagged as unknown as Record<symbol, boolean>)[SCHEMA_FAILURE] = true;
      throw tagged;
    }
    return {
      data,
      provider: choice.provider,
      model: choice.model,
      inTok: response.inTok,
      outTok: response.outTok,
      ms: Date.now() - startedAt,
    };
  }

  let result: Awaited<ReturnType<typeof attempt>>;
  let usedFallback = false;
  try {
    try {
      result = await attempt(primary);
    } catch (error) {
      const fallback = deps.choice ? null : config.fallback;
      if (!fallback || !isFallbackEligible(error)) throw error;
      console.warn(
        `LLM ${primary.provider}/${primary.model} failed (${task.name}); falling back to ${fallback.provider}/${fallback.model}.`,
      );
      usedFallback = true;
      result = await attempt(fallback);
    }
  } finally {
    if (ctx && budget) await budget.settle(ctx, billedMicros);
  }
  return { ...result, usedFallback };
}

/**
 * Meters a multi-call conversation turn (a tool-calling loop) as ONE reserved
 * call, then settles the real cost of everything it billed. `fn` returns the
 * micro-dollars it spent so the per-caller and global dollar caps still hold.
 */
export async function runMeteredTurn<T>(
  ctx: LlmCallContext,
  tier: LlmTier,
  fn: (choice: ProviderChoice, effort: ReturnType<typeof resolveReasoningEffort>) => Promise<{ value: T; billedMicros: number }>,
  deps: LlmDeps = {},
): Promise<T> {
  const env = deps.env ?? process.env;
  const config = resolveLlmConfig(tier, env, "plan");
  const budget = deps.budget ?? defaultBudget(config.dailyBudgetUsd);
  await budget.reserve(ctx);
  let billed = 0;
  try {
    const choice = deps.choice ?? config.primary;
    const { value, billedMicros } = await fn(choice, resolveReasoningEffort(tier, choice.model, env));
    billed = billedMicros;
    return value;
  } finally {
    await budget.settle(ctx, billed);
  }
}
