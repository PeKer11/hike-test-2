import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  callerKey,
  createRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

const MINUTE = 60_000;

/** Nothing here sleeps: the clock is the only thing this module reads. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-28T09:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("admits exactly the limit and refuses the next request", () => {
    const limiter = createRateLimiter([{ limit: 3, windowMs: MINUTE }]);

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("keeps refusing one millisecond before the window has passed", () => {
    const limiter = createRateLimiter([{ limit: 2, windowMs: MINUTE }]);
    limiter.check("a");
    limiter.check("a");

    vi.advanceTimersByTime(MINUTE - 1);

    expect(limiter.check("a").allowed).toBe(false);
  });

  it("admits again once the oldest request falls out of the window", () => {
    const limiter = createRateLimiter([{ limit: 2, windowMs: MINUTE }]);
    limiter.check("a");
    vi.advanceTimersByTime(10_000);
    limiter.check("a");

    // The first hit is 60s old here; the second is only 50s old, so exactly one
    // slot has opened up.
    vi.advanceTimersByTime(MINUTE - 10_000);

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("slides rather than resetting, so a burst either side of the window is still refused", () => {
    // The fixed-window failure this design exists to avoid: 3 at the end of one
    // window plus 3 at the start of the next would be 6 requests in an instant.
    const limiter = createRateLimiter([{ limit: 3, windowMs: MINUTE }]);
    vi.advanceTimersByTime(MINUTE - 100);
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");

    vi.advanceTimersByTime(200);

    expect(limiter.check("a").allowed).toBe(false);
  });

  it("does not count a refused request against the caller", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: MINUTE }]);
    limiter.check("a");

    // Hammering through the whole window must not push the recovery time out.
    for (let elapsed = 0; elapsed < MINUTE - 1_000; elapsed += 1_000) {
      expect(limiter.check("a").allowed).toBe(false);
      vi.advanceTimersByTime(1_000);
    }

    vi.advanceTimersByTime(1_000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each caller separately", () => {
    const limiter = createRateLimiter([{ limit: 2, windowMs: MINUTE }]);
    limiter.check("203.0.113.7");
    limiter.check("203.0.113.7");

    expect(limiter.check("203.0.113.7").allowed).toBe(false);
    expect(limiter.check("198.51.100.4").allowed).toBe(true);
  });

  it("reports the seconds until the blocking request expires", () => {
    const limiter = createRateLimiter([{ limit: 2, windowMs: MINUTE }]);
    limiter.check("a");
    vi.advanceTimersByTime(20_000);
    limiter.check("a");

    // The oldest hit is 20s old, so 40s of its window remain.
    expect(limiter.check("a")).toEqual({
      allowed: false,
      retryAfterSeconds: 40,
    });
  });

  it("reports zero retry seconds when the request is admitted", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: MINUTE }]);

    expect(limiter.check("a")).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("enforces the long window even when the short one has room", () => {
    const limiter = createRateLimiter([
      { limit: 2, windowMs: MINUTE },
      { limit: 3, windowMs: 10 * MINUTE },
    ]);

    limiter.check("a");
    limiter.check("a");
    vi.advanceTimersByTime(MINUTE);
    // The per-minute rule is clear again, but the third hit exhausts the
    // ten-minute allowance.
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("reports the longer of the two waits when both windows are exhausted", () => {
    const limiter = createRateLimiter([
      { limit: 2, windowMs: MINUTE },
      { limit: 2, windowMs: 10 * MINUTE },
    ]);

    limiter.check("a");
    limiter.check("a");

    // Per-minute clears in 60s; the ten-minute rule needs 600s. The caller is
    // told the truth, not the nearer of the two.
    expect(limiter.check("a").retryAfterSeconds).toBe(600);
  });

  it("forgets every caller on reset", () => {
    const limiter = createRateLimiter([{ limit: 1, windowMs: MINUTE }]);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    limiter.reset();

    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("callerKey", () => {
  function requestWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/geocode", { headers });
  }

  it("takes the client address from the front of the x-forwarded-for chain", () => {
    expect(
      callerKey(requestWith({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })),
    ).toBe("203.0.113.7");
  });

  it("trims whitespace around a single forwarded address", () => {
    expect(callerKey(requestWith({ "x-forwarded-for": "  203.0.113.7  " }))).toBe(
      "203.0.113.7",
    );
  });

  it("prefers the forwarded chain when Vercel has set both headers", () => {
    expect(
      callerKey(
        requestWith({
          "x-forwarded-for": "203.0.113.7",
          "x-real-ip": "198.51.100.4",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when nothing was forwarded", () => {
    expect(callerKey(requestWith({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
  });

  it("ignores an empty x-forwarded-for rather than bucketing on the empty string", () => {
    expect(
      callerKey(
        requestWith({ "x-forwarded-for": "  ", "x-real-ip": "198.51.100.4" }),
      ),
    ).toBe("198.51.100.4");
  });

  it("puts a request with no address headers in one shared bucket", () => {
    // `next dev` sets neither, and local development is one person.
    expect(callerKey(requestWith({}))).toBe("unidentified");
  });
});

describe("rateLimitedResponse", () => {
  it("answers 429 with the wait in both the header and the body", async () => {
    const response = rateLimitedResponse({
      allowed: false,
      retryAfterSeconds: 42,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({
      error: "Too many requests. Try again in a moment.",
      retryAfterSeconds: 42,
    });
  });
});
