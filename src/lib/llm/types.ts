import type { Schema } from "@google/genai";
import type { z } from "zod";

export type LlmTier = 1 | 2 | 3;

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export type LlmTaskName =
  | "extract-places"
  | "canonical-name"
  | "preferences"
  | "facts"
  | "answer-intent"
  | "narrate"
  | "plan"
  | "session-summary"
  | "eval";

export type LlmProviderName = "gemini" | "anthropic" | "openai" | "openai-compatible";

/** Text the model must treat as information only: place names, Wikipedia extracts, OSM tags. */
export interface UntrustedBlock {
  source: string;
  text: string;
  /** Larger cap for structured JSON the caller already sized (default `UNTRUSTED_MAX_CHARS`, never above `UNTRUSTED_HARD_MAX_CHARS`). */
  maxChars?: number;
}

export interface LlmTask<T> {
  name: LlmTaskName;
  system: string;
  user: string;
  untrusted?: UntrustedBlock[];
  /** Provider-neutral shape of the JSON answer (fed to Anthropic / OpenAI as a JSON Schema). */
  schema: z.ZodType;
  /** Gemini keeps its native response schema so the request stays byte-identical to before. */
  geminiSchema?: Schema;
  /** Semantic post-validator. Throwing here counts as a schema failure (fallback-eligible). */
  parse: (text: string) => T;
  maxOutputTokens: number;
  tier: LlmTier;
  timeoutMs?: number;
}

export interface LlmCallContext {
  userId: string | null;
  ip: string;
  /** Budget class. Defaults to "free" for a signed-in caller and "anonymous" otherwise. */
  plan?: "anonymous" | "free" | "paid";
}

/**
 * The only way to call `runLlm` without a caller identity: offline eval runs
 * and unit tests. Production code must pass a real `LlmCallContext`; leaving
 * it out is a type error and a runtime error, so a new call site cannot be
 * silently uncapped.
 */
export const UNMETERED = Symbol("llm-unmetered");

export interface LlmResult<T> {
  data: T;
  provider: string;
  model: string;
  inTok: number;
  outTok: number;
  ms: number;
  usedFallback: boolean;
}

export interface ProviderRequest {
  model: string;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  geminiSchema?: Schema;
  maxOutputTokens: number;
  signal: AbortSignal;
  timeoutMs: number;
  taskName: LlmTaskName;
  /** Already validated and clamped for `model` (see resolveReasoningEffort). */
  reasoningEffort?: ReasoningEffort;
}

export interface ProviderResponse {
  text: string;
  inTok: number;
  outTok: number;
}

export type ProviderCall = (request: ProviderRequest) => Promise<ProviderResponse>;

export class LlmTimeoutError extends Error {
  constructor(ms: number) {
    super(`LLM call timed out after ${ms}ms`);
    this.name = "LlmTimeoutError";
  }
}

export class LlmBudgetExceededError extends Error {
  constructor(public readonly reason: "user" | "global") {
    super(`LLM budget exceeded (${reason})`);
    this.name = "LlmBudgetExceededError";
  }
}

/** A failure after model calls were already billed; runMeteredTurn settles `billedMicros`. */
export class BilledFailureError extends Error {
  constructor(
    readonly billedMicros: number,
    cause?: unknown,
  ) {
    super("failed after billed model calls", { cause });
    this.name = "BilledFailureError";
  }
}
