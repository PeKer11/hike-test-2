import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

/** The walker already has a turn running; it must finish (or time out) before the next one starts. */
export class TurnBusyError extends Error {
  constructor() {
    super("a turn is already running for this walker");
    this.name = "TurnBusyError";
  }
}

export interface TurnLock {
  /** A token when the lock was taken, null while a live turn holds it. */
  acquire(key: string, ttlMs: number): Promise<string | null>;
  release(key: string, token: string): Promise<void>;
  /** Asks the live turn holding `key` to stop. False when none is running (or cancelling is unavailable). */
  requestCancel(key: string): Promise<boolean>;
  /** Whether the live turn holding `key` was asked to stop. Never throws: an unavailable check means "no". */
  isCancelled(key: string): Promise<boolean>;
}

/** Per-instance lock for tests and for when the database lock is unavailable. */
export function createMemoryTurnLock(now: () => number = Date.now): TurnLock {
  const held = new Map<string, { token: string; until: number; cancelled: boolean }>();
  return {
    async acquire(key, ttlMs) {
      const current = held.get(key);
      if (current && current.until > now()) return null;
      const token = randomUUID();
      held.set(key, { token, until: now() + ttlMs, cancelled: false });
      return token;
    },
    async release(key, token) {
      if (held.get(key)?.token === token) held.delete(key);
    },
    async requestCancel(key) {
      const current = held.get(key);
      if (!current || current.until <= now()) return false;
      current.cancelled = true;
      return true;
    },
    async isCancelled(key) {
      const current = held.get(key);
      return !!current && current.until > now() && current.cancelled;
    },
  };
}

/** Service-role lock shared by every server instance, or null when the server has no service key. */
export function createSupabaseTurnLock(): TurnLock | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    async acquire(lockKey, ttlMs) {
      const { data, error } = await client.rpc("turn_lock_acquire", { p_key: lockKey, p_ttl_seconds: Math.ceil(ttlMs / 1000) });
      if (error) throw new Error(`turn_lock_acquire failed: ${error.message}`);
      return typeof data === "string" ? data : null;
    },
    async release(lockKey, token) {
      const { error } = await client.rpc("turn_lock_release", { p_key: lockKey, p_token: token });
      if (error) throw new Error(`turn_lock_release failed: ${error.message}`);
    },
    async requestCancel(lockKey) {
      const { data, error } = await client.rpc("turn_lock_cancel", { p_key: lockKey });
      return !error && data === true;
    },
    async isCancelled(lockKey) {
      const { data, error } = await client.rpc("turn_lock_is_cancelled", { p_key: lockKey });
      return !error && data === true;
    },
  };
}

let cached: TurnLock | undefined;

/** The database lock, falling back to the per-instance one (with a warning) when the database cannot be used. */
export function defaultTurnLock(): TurnLock {
  if (cached) return cached;
  const memory = createMemoryTurnLock();
  const db = createSupabaseTurnLock();
  if (!db) {
    console.warn("Turn lock: no service key; using a per-instance lock.");
    cached = memory;
    return cached;
  }
  const where = new Map<string, "db" | "memory">();
  cached = {
    async acquire(key, ttlMs) {
      try {
        const token = await db.acquire(key, ttlMs);
        if (token) where.set(token, "db");
        return token;
      } catch (error) {
        console.warn("Turn lock: database lock failed; using a per-instance lock.", error);
        const token = await memory.acquire(key, ttlMs);
        if (token) where.set(token, "memory");
        return token;
      }
    },
    async release(key, token) {
      const kind = where.get(token);
      where.delete(token);
      await (kind === "memory" ? memory : db).release(key, token);
    },
    // A turn may hold either lock (the database one can fail over), so ask both.
    async requestCancel(key) {
      const [a, b] = await Promise.all([db.requestCancel(key), memory.requestCancel(key)]);
      return a || b;
    },
    async isCancelled(key) {
      const [a, b] = await Promise.all([db.isCancelled(key), memory.isCancelled(key)]);
      return a || b;
    },
  };
  return cached;
}
