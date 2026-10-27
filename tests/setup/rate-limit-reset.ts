import { beforeEach } from "vitest";

// Keep tests hermetic: a developer's real provider keys / LLM_* routing must not
// change which model a test resolves (zero-config OpenAI routing keys off them).
for (const key of Object.keys(process.env)) {
  if (/^LLM_(PROVIDER|MODEL)/.test(key) || key === "OPENAI_API_KEY") delete process.env[key];
}

import { resetAllCircuitBreakers } from "@/lib/api/circuit-breaker";
import {
  aiBuildUserRateLimiter,
  assistantRateLimiter,
  assistantUserRateLimiter,
  chatRateLimiter,
  geminiRateLimiter,
  learningRateLimiter,
  nominatimRateLimiter,
  notableRateLimiter,
  orsRateLimiter,
  overpassRateLimiter,
  placesResolveRateLimiter,
  socialRateLimiter,
  walkAssistantUserRateLimiter,
  walkPlanRateLimiter,
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
  assistantRateLimiter.reset();
  chatRateLimiter.reset();
  geminiRateLimiter.reset();
  learningRateLimiter.reset();
  orsRateLimiter.reset();
  nominatimRateLimiter.reset();
  overpassRateLimiter.reset();
  socialRateLimiter.reset();
  assistantUserRateLimiter.reset();
  walkAssistantUserRateLimiter.reset();
  aiBuildUserRateLimiter.reset();
  placesResolveRateLimiter.reset();
  walkPlanRateLimiter.reset();
  notableRateLimiter.reset();
  resetAllCircuitBreakers();
});
