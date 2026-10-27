import "server-only";

import { createClient } from "@supabase/supabase-js";

import { utcDay } from "@/lib/llm/budget";

/** A per-user budget for paid Google Places calls: `take` is true when the calls may go ahead. */
export interface PlacesGate {
  take(n?: number): Promise<boolean>;
}

export interface QuotaStore {
  take(key: string, day: string, n: number, cap: number): Promise<boolean>;
}

/** Service-role quota store (the api_quota_take RPC), or null when the server has no service key. */
export function createSupabaseQuotaStore(): QuotaStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    async take(quotaKey, day, n, cap) {
      const { data, error } = await client.rpc("api_quota_take", { p_key: quotaKey, p_day: day, p_n: n, p_cap: cap });
      if (error) throw new Error(`api_quota_take failed: ${error.message}`);
      return data === true;
    },
  };
}

/** Per-turn counter in memory first (no database call once the turn's cap is hit), then the daily quota. */
export function createPlacesGate(options: {
  key: string;
  dailyCap: number;
  perTurnCap: number;
  store?: QuotaStore | null;
  /** Refuse when the store is missing or failing. Defaults to on in production (a Google bill is at stake). */
  failClosed?: boolean;
  now?: () => Date;
}): PlacesGate {
  const store = options.store === undefined ? createSupabaseQuotaStore() : options.store;
  const failClosed = options.failClosed ?? process.env.NODE_ENV === "production";
  const now = options.now ?? (() => new Date());
  let used = 0;
  return {
    async take(n = 1) {
      if (used + n > options.perTurnCap) return false;
      if (!store) {
        if (failClosed) return false;
        used += n;
        return true;
      }
      try {
        const ok = await store.take(options.key, utcDay(now()), n, options.dailyCap);
        if (ok) used += n;
        return ok;
      } catch (error) {
        console.warn("Places quota store unavailable.", error);
        if (failClosed) return false;
        used += n;
        return true;
      }
    },
  };
}

/** Daily Google Places call cap for a signed-in walker, by plan (PLACES_DAILY_CAP_FREE / _PAID; owners get 2000). */
export function placesDailyCap(plan: "free" | "paid", owner: boolean, env: Record<string, string | undefined> = process.env): number {
  if (owner) return 2_000;
  const v = Number(env[`PLACES_DAILY_CAP_${plan.toUpperCase()}`]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : plan === "paid" ? 300 : 80;
}
