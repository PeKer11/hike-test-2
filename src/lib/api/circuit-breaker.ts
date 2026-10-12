/**
 * Tiny per-key circuit breaker for shared public upstreams. After `threshold`
 * consecutive failures the key is skipped for `cooldownMs`; a `Retry-After`
 * from the upstream opens it for that long instead (capped). Any success
 * closes it. State is per server instance, which is fine: its job is to stop
 * one instance hammering a service that is already refusing it.
 */
export interface CircuitBreaker {
  /** True while the key is being skipped. */
  isOpen(key: string): boolean;
  recordSuccess(key: string): void;
  /** `retryAfterMs`, when the upstream stated one, opens the breaker at once. */
  recordFailure(key: string, retryAfterMs?: number): void;
  reset(): void;
}

export const BREAKER_THRESHOLD = 3;
export const BREAKER_COOLDOWN_MS = 10 * 60_000;
const RETRY_AFTER_CAP_MS = 10 * 60_000;

const all = new Set<CircuitBreaker>();

export function createCircuitBreaker(
  options: {
    threshold?: number;
    cooldownMs?: number;
    now?: () => number;
  } = {},
): CircuitBreaker {
  const threshold = options.threshold ?? BREAKER_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? BREAKER_COOLDOWN_MS;
  const now = options.now ?? Date.now;
  const state = new Map<string, { failures: number; openUntil: number }>();

  const breaker: CircuitBreaker = {
    isOpen(key) {
      const entry = state.get(key);
      if (!entry || entry.openUntil <= now()) return false;
      return true;
    },
    recordSuccess(key) {
      state.delete(key);
    },
    recordFailure(key, retryAfterMs) {
      const entry = state.get(key) ?? { failures: 0, openUntil: 0 };
      // A failure after the cooldown is a fresh probe: count from one again.
      if (entry.openUntil !== 0 && entry.openUntil <= now()) entry.failures = 0;
      entry.failures += 1;
      if (retryAfterMs !== undefined && retryAfterMs > 0) {
        entry.openUntil = now() + Math.min(retryAfterMs, RETRY_AFTER_CAP_MS);
      } else if (entry.failures >= threshold) {
        entry.openUntil = now() + cooldownMs;
      }
      state.set(key, entry);
    },
    reset() {
      state.clear();
    },
  };
  all.add(breaker);
  return breaker;
}

/** Test hook: close every breaker so module state does not leak between tests. */
export function resetAllCircuitBreakers(): void {
  for (const breaker of all) breaker.reset();
}

/** Parse a `Retry-After` header (seconds or an HTTP date) into milliseconds. */
export function parseRetryAfterMs(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}
