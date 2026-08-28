import "server-only";

import { NextResponse } from "next/server";

/**
 * Per-caller rate limiting for the routes that spend someone else's budget.
 *
 * Five handlers call real upstreams with no session gate — Gemini (billed per
 * call), ORS (a hard 2000 requests/day cap on the *account*, not the caller),
 * Overpass and Nominatim (free, but public services with usage policies that
 * get addresses banned). The security review of 2026-08-28 flagged that a
 * caller in a `while (true)` loop burns all four, and the ORS one locks out
 * every real walker rather than just degrading their own experience.
 *
 * **This is in-process state, and that is a real limitation, not a footnote.**
 * The counters live in this module's memory, so they reset on a cold start and
 * are not shared between concurrent serverless instances or regions: N warm
 * instances mean up to N times the stated limit, and a burst spread across a
 * scale-out window is counted N ways. What it does stop is the thing actually
 * worth stopping at this app's size — one client hammering one endpoint in a
 * loop, which lands on one warm instance and gets 429s within a second. Shared
 * counters mean an external store; Upstash's free tier is the obvious upgrade
 * and needs nothing but an account, and is deliberately not built today.
 */

/** One "at most `limit` in the trailing `windowMs`" constraint. */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Whole seconds until this caller's next request could pass. 0 when allowed. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Records and admits one request from `key`, or refuses it. */
  check(key: string): RateLimitVerdict;
  /** Forgets every caller. Tests only — see `tests/setup/rate-limit-reset.ts`. */
  reset(): void;
}

/**
 * Beyond this many tracked callers, expired entries are swept before the next
 * decision. A serverless instance is short-lived enough not to care, but
 * `next start` on a long-running box is not, and an unbounded map keyed on
 * attacker-chosen addresses is its own denial of service.
 */
const MAX_TRACKED_CALLERS = 10_000;

/**
 * Sliding window, kept as the timestamps of the requests that were admitted.
 *
 * Chosen over a fixed window because the limits here are small (10–60), so the
 * log per caller is bounded by the limit itself and costs nothing — while a
 * fixed window lets a caller fire a full allowance either side of the reset
 * instant and spend double the limit in a moment. On the Gemini route that
 * doubling is a real bill, and it is exactly the burst shape a loop produces.
 */
export function createRateLimiter(rules: readonly RateLimitRule[]): RateLimiter {
  const longestWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  const admitted = new Map<string, number[]>();

  function live(hits: number[], now: number, windowMs: number): number[] {
    return hits.filter((at) => now - at < windowMs);
  }

  function sweep(now: number): void {
    for (const [key, hits] of admitted) {
      const remaining = live(hits, now, longestWindowMs);
      if (remaining.length === 0) {
        admitted.delete(key);
      } else {
        admitted.set(key, remaining);
      }
    }
  }

  return {
    check(key: string): RateLimitVerdict {
      const now = Date.now();

      if (admitted.size > MAX_TRACKED_CALLERS) {
        sweep(now);
      }

      const recent = live(admitted.get(key) ?? [], now, longestWindowMs);

      // Tracked separately rather than inferred from a non-zero wait: a rule
      // can be violated *and* compute a zero wait if window membership is ever
      // got wrong by a millisecond, and "no wait needed" must not read as
      // "allowed".
      let blocked = false;
      let waitMs = 0;

      for (const rule of rules) {
        const inWindow = live(recent, now, rule.windowMs);
        if (inWindow.length < rule.limit) {
          continue;
        }

        blocked = true;
        // Nothing is admitted unless every rule has room, so a rule that blocks
        // holds exactly `limit` hits — and the oldest of them is the one whose
        // expiry opens the next slot. `inWindow` is in arrival order.
        waitMs = Math.max(waitMs, inWindow[0] + rule.windowMs - now);
      }

      if (blocked) {
        // A refused request does not count against the caller: the window has
        // to be able to drain, or one loop would lock an address out forever.
        // Pruned state is still written back, so a rejection isn't a leak.
        admitted.set(key, recent);
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        };
      }

      recent.push(now);
      admitted.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },

    reset(): void {
      admitted.clear();
    },
  };
}

/**
 * Whatever identifies the caller of `request`.
 *
 * Vercel sets `x-forwarded-for` (client address first in the chain) and
 * `x-real-ip` on every request, and overwrites any the client sent. Neither
 * exists under `next dev`, where the single shared bucket below is the right
 * answer anyway: local development is one person.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unidentified";
}

/** The refusal every rate-limited route sends, in the `{ error }` shape they all use. */
export function rateLimitedResponse(verdict: RateLimitVerdict): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Try again in a moment.",
      retryAfterSeconds: verdict.retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(verdict.retryAfterSeconds) },
    },
  );
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * `/api/extract-places` — Gemini, and the only upstream here that costs money.
 *
 * One request is several Gemini calls (place extraction, canonical-name
 * resolution, and the preference/fact learning passes), and it is driven by a
 * person typing a sentence and pressing enter — never bursty. 10/minute stops
 * a loop within six seconds; 300/day bounds the worst case a single address
 * can bill to roughly a thousand flash-lite calls, which is cents rather than
 * an incident, while leaving an honest walker something like ten times the
 * prompts they would type in a day.
 */
export const geminiRateLimiter = createRateLimiter([
  { limit: 10, windowMs: MINUTE_MS },
  { limit: 300, windowMs: DAY_MS },
]);

/**
 * `/api/directions` and `/api/optimization` — ORS, sharing one bucket because
 * they share one quota: 2000 requests/day against the account, so an abusive
 * caller does not degrade their own service, they take the app off the air.
 *
 * The per-minute allowance has to clear a legitimate build, which is one
 * optimization call plus one directions call per leg (`route-planner.ts`), so
 * a ten-stop walk is ~10 requests in a few seconds and a walker may rebuild.
 * 40/minute leaves room for several of those back to back. The daily figure is
 * the point of the pair: 400 is a fifth of the account's whole budget, so no
 * single address can exhaust the day for everyone else.
 */
export const orsRateLimiter = createRateLimiter([
  { limit: 40, windowMs: MINUTE_MS },
  { limit: 400, windowMs: DAY_MS },
]);

/**
 * `/api/geocode` — Nominatim, whose published usage policy is one request per
 * second, so that is exactly what 60/minute is: this app's own share of it.
 * The type-ahead behind it is debounced 500ms and only fires on a pause, so a
 * real searcher never comes near it.
 *
 * No daily rule. Nominatim costs nothing and has no cap to exhaust; the risk
 * is a burst rate that trips their limiter and gets the User-Agent blocked,
 * and that is entirely a per-minute question.
 */
export const nominatimRateLimiter = createRateLimiter([
  { limit: 60, windowMs: MINUTE_MS },
]);

/**
 * `/api/attractions` — Overpass, a free public service running genuinely
 * expensive queries. One walk build is one call, so 20/minute is a walker
 * rebuilding as fast as they can read the result, and a loop still arrives at
 * Overpass slower than its own rate limiter would tolerate.
 *
 * No daily rule, for the same reason as Nominatim: nothing here to exhaust.
 */
export const overpassRateLimiter = createRateLimiter([
  { limit: 20, windowMs: MINUTE_MS },
]);
