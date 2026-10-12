import "server-only";

import { z } from "zod";

import {
  createBudgetGuard,
  createSupabaseUsageStore,
  type BudgetGuard,
} from "./budget";
import { resolveLlmConfig, type ProviderChoice } from "./config";
import { estimateCostMicros } from "./pricing";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callOpenAi, callOpenAiCompatible } from "./providers/openai";
import { withRetry, statusOf } from "./retry";
import { UNTRUSTED_SYSTEM_RULE, wrapUntrusted } from "./sanitize";
import {
  LlmTimeoutError,
  type LlmCallContext,
  type LlmProviderName,
  type LlmResult,
  type LlmTask,
  type LlmTier,
  type ProviderCall,
} from "./types";

/** Per-request timeout by tier; the old Gemini wrapper had none. */
export const TIER_TIMEOUT_MS: Record<LlmTier, number> = {
  1: 6_000,
  2: 8_000,
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
  if (error instanceof LlmTimeoutError) return true;
  if ((error as { [SCHEMA_FAILURE]?: boolean } | null)?.[SCHEMA_FAILURE])
    return true;
  const status = statusOf(error);
  return status !== null && (status === 429 || status >= 500);
}

function composePrompt<T>(task: LlmTask<T>): { system: string; user: string } {
  if (!task.untrusted?.length) return { system: task.system, user: task.user };
  return {
    system: `${task.system}\n\n${UNTRUSTED_SYSTEM_RULE}`,
    user: `${task.user}\n\n${task.untrusted.map(wrapUntrusted).join("\n")}`,
  };
}

/**
 * Run one task against the configured provider. Without `ctx` there is no
 * budget accounting (the legacy gemini-client wrappers, which have no caller
 * identity). With `ctx`, a spent per-caller or global cap throws
 * LlmBudgetExceededError before any provider is contacted, and the caller
 * takes its no-LLM path.
 *
 * Failure semantics match the old wrapper: with no fallback configured the
 * provider's own error (or the parser's) is rethrown as it arrived.
 */
export async function runLlm<T>(
  task: LlmTask<T>,
  ctx?: LlmCallContext,
  deps: LlmDeps = {},
): Promise<LlmResult<T>> {
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

  const { system, user } = composePrompt(task);
  const jsonSchema = z.toJSONSchema(task.schema) as Record<string, unknown>;
  const timeoutMs = task.timeoutMs ?? TIER_TIMEOUT_MS[task.tier];

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
          }),
          timedOut,
        ]);
      } catch (error) {
        if (signal.aborted) throw new LlmTimeoutError(timeoutMs);
        throw error;
      }
    });

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

  if (ctx && budget) {
    await budget.settle(
      ctx,
      estimateCostMicros(result.model, result.inTok, result.outTok),
    );
  }
  return { ...result, usedFallback };
}
