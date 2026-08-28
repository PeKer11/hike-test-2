import { beforeEach } from "vitest";

import {
  geminiRateLimiter,
  nominatimRateLimiter,
  orsRateLimiter,
  overpassRateLimiter,
} from "@/lib/api/rate-limit";

/**
 * The rate limiters are module-level state, and every route test looks like the
 * same caller.
 *
 * A unit test builds a bare `new Request(...)` with no `x-forwarded-for`, so
 * `callerKey` puts all of them in one bucket — and `extract-places-api.test.ts`
 * alone drives 62 requests through a route whose limit is 10/minute. Without
 * this, the eleventh test in a file starts failing on a 429 that has nothing to
 * do with what it was asserting, and the failure moves around as tests are
 * added or reordered.
 *
 * Registered globally rather than per-file so that a route test written next
 * year inherits it instead of rediscovering it. A test that wants to exercise
 * the limiter drives it within a single case, which this leaves untouched.
 */
beforeEach(() => {
  geminiRateLimiter.reset();
  orsRateLimiter.reset();
  nominatimRateLimiter.reset();
  overpassRateLimiter.reset();
});
