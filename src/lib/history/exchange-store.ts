import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  exchangeAgeCutoff,
  isExchangeTurn,
  MAX_EXCHANGE_PROMPT_CHARS,
  MAX_EXCHANGE_SUMMARY_CHARS,
  MAX_SCROLLBACK,
  type ExchangeTurn,
  type StoredExchange,
} from "./exchange";

// The session-aware server client, exactly as `preference-store.ts` takes it:
// every statement below runs as the signed-in walker, so the RLS policies are
// what actually enforce "own rows only". There is deliberately no service-role
// client on this path.
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** One exchange as the panel hands it over, before any storage shaping. */
export interface ExchangeInput {
  turn: ExchangeTurn;
  prompt: string;
  responseSummary: string;
}

/**
 * A row's `created_at` as epoch millis, or null when it is not a usable
 * timestamp. `timestamptz` arrives as an ISO string; anything that fails to
 * parse would otherwise render as `Invalid Date` in the panel.
 */
function toTimestamp(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Record one thing the walker sent and the one line the panel showed them for
 * it.
 *
 * The lengths are clamped here rather than trusted from the client: the table's
 * `char_length` checks would reject an over-long value outright, and losing the
 * row is a worse outcome than losing the tail of a sentence. An exchange with
 * no text on either side is not written at all — there is nothing to scroll
 * back to.
 *
 * Best effort like every write in `preference-store.ts`: returns false rather
 * than throwing, because this is a side effect of a request the walker made for
 * something else.
 */
export async function appendExchange(
  supabase: ServerClient,
  userId: string,
  exchange: ExchangeInput,
): Promise<boolean> {
  const prompt = exchange.prompt.trim().slice(0, MAX_EXCHANGE_PROMPT_CHARS);
  const responseSummary = exchange.responseSummary
    .trim()
    .slice(0, MAX_EXCHANGE_SUMMARY_CHARS);

  if (!prompt || !responseSummary || !isExchangeTurn(exchange.turn)) {
    return false;
  }

  try {
    const { error } = await supabase.from("prompt_exchanges").insert({
      user_id: userId,
      turn: exchange.turn,
      prompt_text: prompt,
      response_summary: responseSummary,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * The walker's last few requests, oldest first — the order the panel renders
 * in, so nothing has to be reversed at the call site.
 *
 * Two bounds, and they do different jobs. The row cap is already enforced by
 * the table's trim trigger; repeating it as `limit` here is what keeps the read
 * bounded if a trigger-less environment (a hand-restored database, say) ever
 * lets the window grow. The age cutoff is read-only by design: a prompt from
 * four months ago is not a recent request, but it is also not worth a cron job
 * to delete, since the next insert evicts it anyway.
 *
 * Best effort: a failed read, no rows or a client that blew up all come back
 * empty, and the panel opens on an empty log exactly as it did before this
 * existed.
 */
export async function getRecentExchanges(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<StoredExchange[]> {
  try {
    const { data, error } = await supabase
      .from("prompt_exchanges")
      .select("id, turn, prompt_text, response_summary, created_at")
      .eq("user_id", userId)
      .gt("created_at", exchangeAgeCutoff(now))
      .order("created_at", { ascending: false })
      .limit(MAX_SCROLLBACK);

    if (error || !Array.isArray(data)) {
      return [];
    }

    const rows: StoredExchange[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const timestamp = toTimestamp(row.created_at);
      if (
        typeof row.id !== "string" ||
        typeof row.prompt_text !== "string" ||
        typeof row.response_summary !== "string" ||
        !isExchangeTurn(row.turn) ||
        timestamp === null
      ) {
        continue;
      }

      rows.push({
        id: row.id,
        turn: row.turn,
        prompt: row.prompt_text,
        responseSummary: row.response_summary,
        timestamp,
      });
    }

    // Newest-first is what the index serves cheaply; oldest-first is what a log
    // reads as.
    return rows.reverse();
  } catch {
    return [];
  }
}

/**
 * Forget everything this walker has typed. Backed by the "Clear history"
 * control — a persisted memory the walker cannot delete is the failure mode
 * this whole feature has to avoid, so this is not an optional extra.
 *
 * Returns whether the delete actually ran, so the panel can decline to clear
 * its local list on a failure rather than showing an empty log that the next
 * reload refills.
 */
export async function clearExchanges(
  supabase: ServerClient,
  userId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("prompt_exchanges")
      .delete()
      .eq("user_id", userId);

    return !error;
  } catch {
    return false;
  }
}
