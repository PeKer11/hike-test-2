import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { DEFAULT_DAILY_BUDGET_USD } from "./config";
import { LlmBudgetExceededError, type LlmCallContext } from "./types";

/** Calls per UTC day by caller class (NEXT_PHASE_PLAN §3.5). */
export const DAILY_CALL_CAPS = { anonymous: 15, free: 60, paid: 300 } as const;

export interface UsageTotals {
  callerCalls: number;
  callerCostMicros: number;
  globalCostMicros: number;
}

/** Atomic increment store. The real one is a Supabase RPC; tests inject a fake. */
export interface UsageStore {
  bump(callerKey: string, day: string, calls: number, costMicros: number): Promise<UsageTotals>;
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

let fallbackSalt: string | null = null;

/**
 * Salt for the ip hash: `LLM_IP_SALT`, else a server secret (the service-role
 * key) hashed, else a random per-process salt with a one-time warning. Never
 * empty, so a hashed ip cannot be reversed with a plain rainbow table. The
 * per-process fallback means the per-ip cap resets on restart; set LLM_IP_SALT.
 */
export function resolveIpSalt(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.LLM_IP_SALT?.trim();
  if (explicit) return explicit;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (secret) return createHash("sha256").update(`llm-ip-salt|${secret}`).digest("hex");
  if (!fallbackSalt) {
    fallbackSalt = randomBytes(16).toString("hex");
    console.warn("LLM_IP_SALT is not set; using a per-process salt for ip hashing (per-ip caps reset on restart).");
  }
  return fallbackSalt;
}

/** User id when signed in, otherwise a salted hash of the ip (never the raw ip). */
export function callerKeyFor(ctx: LlmCallContext, salt: string = resolveIpSalt()): string {
  if (ctx.userId) return `user:${ctx.userId}`;
  return `ip:${createHash("sha256").update(`${salt}|${ctx.ip}`).digest("hex").slice(0, 32)}`;
}

export function capFor(ctx: LlmCallContext): number {
  const plan = ctx.plan ?? (ctx.userId ? "free" : "anonymous");
  return DAILY_CALL_CAPS[plan];
}

/** Service-role Supabase store, or null when the server has no service key configured. */
export function createSupabaseUsageStore(): UsageStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    async bump(callerKey, day, calls, costMicros) {
      const { data, error } = await client.rpc("llm_usage_bump", {
        p_caller_key: callerKey,
        p_day: day,
        p_calls: calls,
        p_cost_micros: costMicros,
      });
      if (error) throw new Error(`llm_usage_bump failed: ${error.message}`);
      const row = (Array.isArray(data) ? data[0] : data) as {
        caller_calls: number;
        caller_cost_micros: number | string;
        global_cost_micros: number | string;
      };
      return {
        callerCalls: Number(row.caller_calls),
        callerCostMicros: Number(row.caller_cost_micros),
        globalCostMicros: Number(row.global_cost_micros),
      };
    },
  };
}

export interface BudgetGuard {
  /** Reserves one call; throws LlmBudgetExceededError past either cap. */
  reserve(ctx: LlmCallContext): Promise<void>;
  /** Adds the real cost after the call. Never throws. */
  settle(ctx: LlmCallContext, costMicros: number): Promise<void>;
}

/**
 * Per-caller daily call cap plus a global daily dollar cap. Reserving counts
 * the call first (atomically) and only then checks the caps, so concurrent
 * requests cannot all slip under. If the store itself is down the guard fails
 * OPEN with a warning: availability beats a hard stop for a few-cent-per-walk
 * feature, and the provider-side spend limit is the backstop.
 */
export function createBudgetGuard(
  store: UsageStore | null,
  options: { dailyBudgetUsd?: number; now?: () => Date } = {},
): BudgetGuard {
  const budgetMicros = (options.dailyBudgetUsd ?? DEFAULT_DAILY_BUDGET_USD) * 1_000_000;
  const now = options.now ?? (() => new Date());
  let warnedNoStore = false;

  return {
    async reserve(ctx) {
      if (!store) {
        if (!warnedNoStore) {
          warnedNoStore = true;
          console.warn(
            "LLM budget guard is inactive: no usage store (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL missing). Calls are not capped.",
          );
        }
        return;
      }
      let totals: UsageTotals;
      try {
        totals = await store.bump(callerKeyFor(ctx), utcDay(now()), 1, 0);
      } catch (error) {
        console.warn("LLM budget store unavailable; allowing the call.", error);
        return;
      }
      if (totals.callerCalls > capFor(ctx)) throw new LlmBudgetExceededError("user");
      if (totals.globalCostMicros >= budgetMicros) throw new LlmBudgetExceededError("global");
    },
    async settle(ctx, costMicros) {
      if (!store || costMicros <= 0) return;
      try {
        await store.bump(callerKeyFor(ctx), utcDay(now()), 0, costMicros);
      } catch (error) {
        console.warn("LLM budget settle failed.", error);
      }
    },
  };
}
