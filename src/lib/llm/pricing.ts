// List prices in USD per 1M tokens (input / output), from NEXT_PHASE_PLAN §3.3
// (fetched 2026-10-11). Used only for the budget guard's estimate; an unknown
// model is priced pessimistically so a typo cannot blow past the daily cap.
const PRICES: Record<string, [number, number]> = {
  "gpt-5-nano": [0.05, 0.4],
  "gpt-6-luna": [0.1, 0.5],
  "claude-haiku-5-5": [0.1, 0.5],
  "gemini-2.5-flash-lite": [0.1, 0.4],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-5.4-nano": [0.2, 1.25],
  "gemini-3.1-flash-lite": [0.25, 1.5],
  "gemini-3.5-flash-lite": [0.3, 2.5],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-5.4-mini": [0.75, 4.5],
  "claude-haiku-4-5-20251001": [1, 5],
  "claude-sonnet-5-5": [2, 10],
};

const UNKNOWN_MODEL_PRICE: [number, number] = [1, 5];

/** Estimated cost of one call in micro-dollars (1e-6 USD). */
export function estimateCostMicros(model: string, inTok: number, outTok: number): number {
  const [inPrice, outPrice] = PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  // $/1M tokens equals micro-dollars per token.
  return Math.ceil(inTok * inPrice + outTok * outPrice);
}

export function knownModels(): string[] {
  return Object.keys(PRICES);
}
