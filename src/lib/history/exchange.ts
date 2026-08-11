/**
 * The shared vocabulary of the persisted scrollback: what a stored exchange
 * looks like, how many are kept, and how old one may be before it stops
 * counting as "recent".
 *
 * Pure and client-safe on purpose. The panel renders from these constants and
 * `exchange-store.ts` writes against them, so the window is defined once rather
 * than agreed twice.
 */

/**
 * Which of the panel's three send buttons produced the row.
 *
 * Mirrors the `exchange_turn` enum in
 * `supabase/migrations/20260812090000_prompt_exchanges.sql` — keep both in sync.
 * Nothing renders it yet; it is stored so a later UI can tell a chip tap apart
 * from a typed prompt without a backfill.
 */
export type ExchangeTurn = "prompt" | "chip" | "follow_up";

export const EXCHANGE_TURNS: readonly ExchangeTurn[] = [
  "prompt",
  "chip",
  "follow_up",
];

export function isExchangeTurn(value: unknown): value is ExchangeTurn {
  return (EXCHANGE_TURNS as readonly string[]).includes(value as string);
}

/**
 * Enough to see what you just tried, not so much it becomes a transcript.
 *
 * The one definition of the window: the panel slices its in-memory list to it,
 * the read query limits to it, and the migration's trim trigger quotes it in a
 * comment. Changing it here means changing the `limit 5` in that trigger too.
 */
export const MAX_SCROLLBACK = 5;

/**
 * A prompt from four months ago is not a recent request — it is a stranger's
 * sentence. Applied as a read-time filter rather than a second eviction job:
 * rows this old fall out on the next insert anyway.
 */
export const EXCHANGE_MAX_AGE_DAYS = 30;

/** Matches the `char_length` checks on the table. */
export const MAX_EXCHANGE_PROMPT_CHARS = 500;
export const MAX_EXCHANGE_SUMMARY_CHARS = 200;

/** One stored exchange, as the API hands it to the panel. */
export interface StoredExchange {
  id: string;
  turn: ExchangeTurn;
  prompt: string;
  responseSummary: string;
  /** Epoch millis. */
  timestamp: number;
}

/**
 * The oldest `created_at` a read should still return, as an ISO string
 * PostgREST can filter on. Takes `now` rather than reading the clock so tests
 * are not time-dependent.
 */
export function exchangeAgeCutoff(now: Date): string {
  return new Date(
    now.getTime() - EXCHANGE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}
