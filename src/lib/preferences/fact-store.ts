import "server-only";

import { extractStandingFacts } from "@/lib/api/gemini-client";
import { createClient } from "@/lib/supabase/server";

import {
  findContradicted,
  MAX_STANDING_FACTS,
  normalizeFactKey,
  weakestFact,
  type ExtractedFact,
  type FactContradiction,
  type FactImportance,
  type StoredFact,
} from "./fact-extractor";

export type { FactContradiction };

// The session-aware server client, exactly as `preference-store.ts` takes it.
// RLS is what enforces "own rows only"; there is no service-role client here.
type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Same bound the preference pass uses: long enough for a chatty walk
// description, short enough that the fact pass never becomes the expensive part
// of a request.
const MAX_LEARNING_TEXT_LENGTH = 1000;

const FACT_COLUMNS =
  "id, fact_text, fact_key, importance, occurrence_count, last_seen_at";

export interface FactLearningResult {
  /** What the walker is on record as saying after this text was read. */
  facts: StoredFact[];
  contradictions: FactContradiction[];
}

const LEARNED_NOTHING: FactLearningResult = { facts: [], contradictions: [] };

function toImportance(value: unknown): FactImportance {
  const importance = Number(value);
  return importance === 2 || importance === 3 ? importance : 1;
}

/**
 * `occurrence_count` as a count. The column is `integer not null check (> 0)`,
 * but PostgREST can hand a numeric back as a string, and anything that is not a
 * whole positive number is one occurrence — what a standing row meant before
 * repetition was tracked.
 */
function toOccurrenceCount(value: unknown): number {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

/** A row as the scorer can read it, or null when it is not usable. */
function toStoredFact(row: Record<string, unknown>): StoredFact | null {
  const text = row.fact_text;
  const key = row.fact_key;
  if (typeof row.id !== "string" || typeof text !== "string") {
    return null;
  }

  const lastSeenAt = Date.parse(String(row.last_seen_at));

  return {
    id: row.id,
    text,
    // A row written before the key was stored, or with a key that has drifted
    // from what the current normalizer produces, still has to dedupe against
    // today's rules — so the text is the source of truth when they disagree.
    key: typeof key === "string" && key ? key : normalizeFactKey(text),
    importance: toImportance(row.importance),
    occurrenceCount: toOccurrenceCount(row.occurrence_count),
    lastSeenAt: Number.isFinite(lastSeenAt) ? lastSeenAt : 0,
  };
}

/**
 * Everything the walker is currently on record as saying. Superseded rows are
 * excluded: they are kept only so a contradiction can be undone, and a fact the
 * walker has since reversed must never reach a walk.
 *
 * Best effort like every read in `preference-store.ts`: no rows, no session or
 * a failed read all come back empty and the walk is planned exactly as it was
 * before this existed.
 */
export async function getStandingFacts(
  supabase: ServerClient,
  userId: string,
): Promise<StoredFact[]> {
  try {
    const { data, error } = await supabase
      .from("standing_facts")
      .select(FACT_COLUMNS)
      .eq("user_id", userId)
      .is("superseded_at", null);

    if (error || !Array.isArray(data)) {
      return [];
    }

    const facts: StoredFact[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const fact = toStoredFact(row);
      if (fact) {
        facts.push(fact);
      }
    }

    return facts;
  } catch {
    return [];
  }
}

/**
 * Fold one newly-heard fact into what is already on record.
 *
 * Hit on `(user_id, fact_key)`: the count goes up, the timestamp moves, and
 * importance takes the stronger of the two readings — but `fact_text` is left
 * alone. First phrasing wins, because churning the displayed text every time
 * the model rewords the same fact makes the walker's own list look unstable.
 *
 * Miss: insert at one occurrence. Returns the new row's id so a contradiction
 * can point at it.
 */
async function upsertFact(
  supabase: ServerClient,
  userId: string,
  fact: ExtractedFact,
  existing: StoredFact | undefined,
  now: Date,
): Promise<string | null> {
  if (existing) {
    const { error } = await supabase
      .from("standing_facts")
      .update({
        occurrence_count: existing.occurrenceCount + 1,
        last_seen_at: now.toISOString(),
        importance: Math.max(existing.importance, fact.importance),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    return error ? null : existing.id;
  }

  const { data, error } = await supabase
    .from("standing_facts")
    .insert({
      user_id: userId,
      fact_text: fact.text,
      fact_key: normalizeFactKey(fact.text),
      importance: fact.importance,
      last_seen_at: now.toISOString(),
    })
    .select("id")
    .maybeSingle();

  const id = (data as { id?: unknown } | null)?.id;
  return error || typeof id !== "string" ? null : id;
}

/**
 * Retire a fact the walker has just contradicted. Kept rather than deleted:
 * the row is what a "put it back" offer restores from, and a delete would make
 * the offer a lie.
 */
async function supersedeFact(
  supabase: ServerClient,
  userId: string,
  supersededId: string,
  newId: string,
  now: Date,
): Promise<boolean> {
  const { error } = await supabase
    .from("standing_facts")
    .update({ superseded_at: now.toISOString(), superseded_by: newId })
    .eq("id", supersededId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Keep the walker under the cap by dropping the weakest fact — the one the
 * scorer likes least, which is the whole reason eviction lives in TS rather
 * than in a trigger.
 */
async function evictToCap(
  supabase: ServerClient,
  userId: string,
  facts: StoredFact[],
  now: Date,
): Promise<StoredFact[]> {
  let remaining = facts;

  while (remaining.length > MAX_STANDING_FACTS) {
    const weakest = weakestFact(remaining, now);
    if (!weakest) {
      break;
    }

    const { error } = await supabase
      .from("standing_facts")
      .delete()
      .eq("id", weakest.id)
      .eq("user_id", userId);

    if (error) {
      break;
    }

    remaining = remaining.filter((fact) => fact.id !== weakest.id);
  }

  return remaining;
}

/**
 * The one entry point both free-text boxes use for facts, mirroring
 * `learnPreferencesFromText` next door: the "name your own stops" prompt and
 * the post-walk "what did you like?" box.
 *
 * Callers must have already established that the walker is signed in and has
 * left learning on — this does not re-check either.
 *
 * Best effort throughout. A fact is a side effect of a request the walker made
 * for something else, so anything that fails here costs that fact and not the
 * request.
 */
export async function learnFactsFromText(
  supabase: ServerClient,
  userId: string,
  text: string,
  now: Date = new Date(),
): Promise<FactLearningResult> {
  const trimmed = text.trim().slice(0, MAX_LEARNING_TEXT_LENGTH);
  if (!trimmed) {
    return LEARNED_NOTHING;
  }

  try {
    const existing = await getStandingFacts(supabase, userId);
    const detected = await extractStandingFacts(trimmed, existing);
    if (detected.length === 0) {
      return { facts: existing, contradictions: [] };
    }

    const byKey = new Map(existing.map((fact) => [fact.key, fact]));
    const contradictions: FactContradiction[] = [];
    let current = existing;

    for (const fact of detected) {
      const key = normalizeFactKey(fact.text);
      const known = byKey.get(key);
      const id = await upsertFact(supabase, userId, fact, known, now);
      if (!id) {
        continue;
      }

      if (known) {
        current = current.map((entry) =>
          entry.id === known.id
            ? {
                ...entry,
                importance: Math.max(
                  entry.importance,
                  fact.importance,
                ) as FactImportance,
                occurrenceCount: entry.occurrenceCount + 1,
                lastSeenAt: now.getTime(),
              }
            : entry,
        );
        continue;
      }

      const stored: StoredFact = {
        id,
        text: fact.text,
        key,
        importance: fact.importance,
        occurrenceCount: 1,
        lastSeenAt: now.getTime(),
      };
      byKey.set(key, stored);
      current = [...current, stored];

      // Matched against what was on record before this text was read: a fact
      // written moments ago by the same sentence is not something the walker
      // has changed their mind about.
      const contradicted = findContradicted(fact, existing);
      if (
        contradicted &&
        (await supersedeFact(supabase, userId, contradicted.id, id, now))
      ) {
        current = current.filter((entry) => entry.id !== contradicted.id);
        contradictions.push({
          supersededFactId: contradicted.id,
          supersededText: contradicted.text,
          newFactId: id,
          newText: fact.text,
        });
      }
    }

    return {
      facts: await evictToCap(supabase, userId, current, now),
      contradictions,
    };
  } catch {
    // Model call failed, Supabase unavailable, or a rejected write — silent.
    return LEARNED_NOTHING;
  }
}

/**
 * Forget one fact, by the walker's own hand from the "Things I remember about
 * you" list. A memory that silently changes results and cannot be deleted is
 * the single worst outcome of this feature.
 */
export async function deleteFact(
  supabase: ServerClient,
  userId: string,
  factId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("standing_facts")
      .delete()
      .eq("id", factId)
      .eq("user_id", userId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Undo a contradiction: put the retired fact back and drop the one that
 * replaced it.
 *
 * This is the half of Ariel's layered answer that needs an explicit "yes" —
 * the app has already acted on the newest statement, and this is the walker
 * saying it read them wrong. Order matters, and the other way around than it
 * looks: the superseded row is un-superseded FIRST, deletion SECOND. Deleting
 * the successor first was tried and always fails — the row's own
 * `on delete set null` clears `superseded_by` as part of that same delete
 * statement, but `superseded_at` is still set at that instant, which trips
 * `standing_facts_supersede_shape` before this function's own update ever
 * runs. Clearing both columns here first keeps the row valid on its own, so
 * the delete that follows has nothing left to cascade into.
 */
export async function restoreSupersededFact(
  supabase: ServerClient,
  userId: string,
  supersededFactId: string,
  newFactId: string,
): Promise<boolean> {
  try {
    const { error: restoreError } = await supabase
      .from("standing_facts")
      .update({ superseded_at: null, superseded_by: null })
      .eq("id", supersededFactId)
      .eq("user_id", userId);

    if (restoreError) {
      return false;
    }

    return await deleteFact(supabase, userId, newFactId);
  } catch {
    return false;
  }
}
