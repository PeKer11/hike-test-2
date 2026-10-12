import type { LlmProviderName, LlmTaskName, LlmTier } from "./types";

export interface ProviderChoice {
  provider: LlmProviderName;
  model: string;
}

export interface LlmConfig {
  primary: ProviderChoice;
  fallback: ProviderChoice | null;
  dailyBudgetUsd: number;
}

/**
 * Default until the eval (`scripts/llm-eval.ts`) says otherwise: a pinned
 * Gemini Flash-Lite id, never the `-latest` alias (it silently moved to a 3x
 * pricier model and started rejecting `thinkingConfig`). Bump only after the
 * eval passes. [UNVERIFIED against the live API: confirm the id with a real key.]
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const DEFAULT_MODELS: Record<Exclude<LlmProviderName, "openai-compatible">, string> = {
  gemini: DEFAULT_GEMINI_MODEL,
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5-nano",
};

export const DEFAULT_DAILY_BUDGET_USD = 3;

const PROVIDERS: LlmProviderName[] = ["gemini", "anthropic", "openai", "openai-compatible"];

type Env = Record<string, string | undefined>;

function isProvider(value: string | undefined): value is LlmProviderName {
  return PROVIDERS.includes(value as LlmProviderName);
}

/** `LLM_PROVIDER_T2` wins over `LLM_PROVIDER` for a tier-2 task. */
function tierVar(env: Env, name: string, tier: LlmTier): string | undefined {
  return env[`${name}_T${tier}`]?.trim() || env[name]?.trim() || undefined;
}

function choose(provider: string | undefined, model: string | undefined): ProviderChoice | null {
  const name = provider && isProvider(provider) ? provider : provider ? null : "gemini";
  if (!name) return null;
  const resolved = model || (name === "openai-compatible" ? "" : DEFAULT_MODELS[name]);
  if (!resolved) return null;
  return { provider: name, model: resolved };
}

export function resolveLlmConfig(
  tier: LlmTier,
  env: Env = process.env,
  _task?: LlmTaskName,
): LlmConfig {
  const primary =
    choose(tierVar(env, "LLM_PROVIDER", tier), tierVar(env, "LLM_MODEL", tier)) ??
    choose("gemini", undefined)!;

  const fbProvider = tierVar(env, "LLM_FALLBACK_PROVIDER", tier);
  const fallback = fbProvider
    ? choose(fbProvider, tierVar(env, "LLM_FALLBACK_MODEL", tier))
    : null;

  const budget = Number(env.LLM_DAILY_BUDGET_USD);
  return {
    primary,
    fallback,
    dailyBudgetUsd:
      Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_DAILY_BUDGET_USD,
  };
}
