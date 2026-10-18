import type { LlmProviderName, LlmTaskName, LlmTier, ReasoningEffort } from "./types";

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

/**
 * Zero-config routing: with only OPENAI_API_KEY set (no explicit LLM_PROVIDER /
 * LLM_MODEL anywhere), tiers 1-2 run on Luna and tier 3 on Sol. Any explicit
 * LLM_PROVIDER* / LLM_MODEL* variable turns this off.
 */
const OPENAI_ZERO_CONFIG: Record<LlmTier, string> = {
  1: "gpt-6-luna",
  2: "gpt-6-luna",
  3: "gpt-6.1-sol",
};

function zeroConfigOpenAi(env: Env, tier: LlmTier): ProviderChoice | null {
  if (!env.OPENAI_API_KEY?.trim()) return null;
  if (Object.keys(env).some((k) => /^LLM_(PROVIDER|MODEL)/.test(k) && env[k]?.trim())) return null;
  return { provider: "openai", model: OPENAI_ZERO_CONFIG[tier] };
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
    zeroConfigOpenAi(env, tier) ??
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

const EFFORTS: ReasoningEffort[] = ["none", "minimal", "low", "medium", "high"];

/**
 * `LLM_REASONING_EFFORT_T2` wins over `LLM_REASONING_EFFORT`. Unknown values are
 * dropped (a bad value would 400 every call). Sol and Astra-class models cannot
 * turn reasoning off, so `none`/`minimal` is raised to `low` for them.
 */
export function resolveReasoningEffort(
  tier: LlmTier,
  model: string,
  env: Env = process.env,
): ReasoningEffort | undefined {
  const raw = tierVar(env, "LLM_REASONING_EFFORT", tier)?.toLowerCase();
  const effort = EFFORTS.find((e) => e === raw);
  if (!effort) {
    if (/-(sol|astra)\b/.test(model)) return "low";
    // Luna reasons by default: 120-300 hidden tokens, 2.4-4.3s on a short
    // extraction, which blows the 6s tier-1 timeout on a real prompt. Extraction
    // does not need it; "none" answers the same request in ~1.5s.
    return /-luna\b/.test(model) ? "none" : undefined;
  }
  if (/-(sol|astra)\b/.test(model) && (effort === "none" || effort === "minimal")) return "low";
  return effort;
}

export type T3Mode = "escalate" | "once-per-walk";

/** How often Luna-class tier-1/2 work may be handed to the tier-3 model. */
export function resolveT3Mode(env: Env = process.env): T3Mode {
  return env.LLM_T3_MODE?.trim() === "once-per-walk" ? "once-per-walk" : "escalate";
}
