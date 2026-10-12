/** Total tries for one LLM call, first attempt included. */
export const MAX_ATTEMPTS = 3;

/** First backoff window; each retry doubles it. */
const BASE_DELAY_MS = 600;

/**
 * How long a single call may spend on retries, measured from the first attempt.
 * It stops a *new* attempt from starting past the budget; an attempt already in
 * flight is bounded by the per-request timeout the client now sets (`runLlm`),
 * which was the gap the old Gemini-only wrapper documented.
 */
export const RETRY_BUDGET_MS = 10_000;

/**
 * The HTTP status behind a failed call, or null when there is none to read.
 * Read structurally: `@google/genai` puts it on `status`, and the fetch-based
 * providers throw errors that do the same.
 */
export function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Worth trying again only when the request itself was fine: 429 means we asked
 * too fast, 5xx means their side. A 400 or 401/403 fails identically each time.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Equal jitter: half the window fixed so each retry really waits longer than
 * the last, half random so two requests limited by the same burst do not come
 * back in step.
 */
export function backoffDelayMs(attempt: number): number {
  const window = BASE_DELAY_MS * 2 ** (attempt - 1);
  return window / 2 + Math.random() * (window / 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an LLM call, retrying through rate limits and transient server errors.
 * The last error is rethrown as it arrived.
 */
export async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const status = statusOf(error);
      if (
        attempt >= MAX_ATTEMPTS ||
        status === null ||
        !isRetryableStatus(status)
      ) {
        throw error;
      }

      const delay = backoffDelayMs(attempt);
      if (Date.now() - startedAt + delay >= RETRY_BUDGET_MS) {
        throw error;
      }

      console.warn(
        `LLM call failed with ${status}; retrying in ${Math.round(delay)}ms (attempt ${attempt + 1} of ${MAX_ATTEMPTS})`,
      );
      await sleep(delay);
    }
  }
}
