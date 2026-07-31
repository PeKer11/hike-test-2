import "server-only";

import { extractCategoryPreferences } from "@/lib/api/gemini-client";
import { createClient } from "@/lib/supabase/server";
import type { AttractionCategory } from "@/lib/types";

import {
  ATTRACTION_CATEGORIES,
  mergePreferredCategories,
  type CategoryPreference,
} from "./preference-extractor";

// The session-aware server client. Every write below runs as the signed-in
// user, so RLS ("own rows only") is what actually enforces isolation — there is
// deliberately no service-role client anywhere in this path.
type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type WalkFeedbackSignal = "upvote" | "downvote";

// Long enough for a chatty walk description, short enough that the preference
// pass never becomes the expensive part of a request.
const MAX_LEARNING_TEXT_LENGTH = 1000;

/**
 * The one entry point both free-text boxes use: the "name your own stops"
 * prompt and the post-walk "what did you like?" box. Runs the preference pass
 * over the text and folds whatever it finds into the profile.
 *
 * Callers must have already established that the walker is signed in and has
 * left preference learning on — this function does not re-check either.
 */
export async function learnPreferencesFromText(
  supabase: ServerClient,
  userId: string,
  text: string,
): Promise<AttractionCategory[] | null> {
  const trimmed = text.trim().slice(0, MAX_LEARNING_TEXT_LENGTH);
  if (!trimmed) {
    return null;
  }

  try {
    const detected = await extractCategoryPreferences(trimmed);
    return await saveCategoryPreferences(supabase, userId, detected);
  } catch {
    // Learning is a side effect — never let it fail the request it rode in on.
    return null;
  }
}

/**
 * The standing categories on the walker's profile — what every earlier prompt
 * and post-walk rating has taught us they like, as opposed to whatever they
 * ticked for one particular walk.
 *
 * Best effort like the writes below: no profile row, no saved preferences or a
 * failed read all come back as an empty list, and the caller plans the walk from
 * the request alone exactly as it did before this existed.
 */
export async function getPreferredCategories(
  supabase: ServerClient,
  userId: string,
): Promise<AttractionCategory[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_categories")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !Array.isArray(data.preferred_categories)) {
    return [];
  }

  // The column is text[], so a value written by an older schema or by hand is
  // not necessarily a category we still know. Dropping it here matters beyond
  // scoring: a list of unknown strings is non-empty, which would switch the
  // ranker's exploration branch on and label a stop nothing was explored away
  // from as an exploration pick.
  return (data.preferred_categories as unknown[]).filter(
    (category): category is AttractionCategory =>
      (ATTRACTION_CATEGORIES as string[]).includes(category as string),
  );
}

/**
 * The categories the walker has voted down as a whole — the other half of what
 * `getPreferredCategories` reads, and until now the half nothing acted on.
 *
 * Category-level rows only (`poi_name is null`, the shape the table's check
 * constraint calls category-level). A downvote on one specific POI says "not
 * that place", which is a different claim from "not that kind of place", and
 * suppressing a whole category off one bad museum would be the wrong lesson.
 * Suppressing the re-discovered POI itself is a fair feature, but a separate
 * one — it needs the table's `poi_key` identity rebuilt on this side to match a
 * fresh Overpass result, so it is deliberately not built here.
 *
 * Best effort exactly like the reads above: no rows, no session or a failed
 * read all come back empty and the walk is planned as it was before.
 */
export async function getDownvotedCategories(
  supabase: ServerClient,
  userId: string,
): Promise<AttractionCategory[]> {
  const { data, error } = await supabase
    .from("attraction_feedback")
    .select("category")
    .eq("user_id", userId)
    .eq("signal", "downvote")
    .is("poi_name", null);

  if (error || !Array.isArray(data)) {
    return [];
  }

  // Same guard as `getPreferredCategories`: a category written by an older
  // schema is not necessarily one the ranker still knows, and one row per
  // category is not guaranteed once a POI-level shape sneaks past.
  const categories = data.map((row) => (row as { category: unknown }).category);
  return Array.from(new Set(categories)).filter(
    (category): category is AttractionCategory =>
      (ATTRACTION_CATEGORIES as string[]).includes(category as string),
  );
}

/**
 * Read-modify-write of `profiles.preferred_categories`. Reads the current list
 * first rather than overwriting it, so a preference learned from one prompt
 * cannot erase what earlier prompts learned.
 *
 * Best effort by design: preference learning is a side effect of a request the
 * user made for something else, so a failure here is swallowed and the caller's
 * real work still succeeds.
 */
export async function saveCategoryPreferences(
  supabase: ServerClient,
  userId: string,
  detected: CategoryPreference[],
): Promise<AttractionCategory[] | null> {
  if (detected.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_categories")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const existing = Array.isArray(data.preferred_categories)
    ? (data.preferred_categories as AttractionCategory[])
    : [];

  const merged = mergePreferredCategories(existing, detected);
  if (!merged) {
    return null;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferred_categories: merged })
    .eq("id", userId);

  return updateError ? null : merged;
}

/** One walker rating of one specific stop on a finished walk. */
export interface AttractionRating {
  /**
   * The Overpass element id (`Attraction.id`) when the stop actually came from
   * Overpass, null otherwise. Null is a valid POI-level row: the table's check
   * constraint asks for name and coordinates, not an id, precisely because
   * Overpass ids are not guaranteed stable.
   */
  osmId: string | null;
  name: string;
  lat: number;
  lng: number;
  category: AttractionCategory;
  signal: WalkFeedbackSignal;
}

/**
 * The standing category-level signal a batch of per-stop ratings adds up to.
 *
 * Two stops of the same category rated opposite ways in one walk ("liked that
 * museum, not that one") cannot both stand: the unique index is one row per
 * (user, category, target), so the category has exactly one standing signal.
 * The last rating wins, which is the same rule the delete-then-insert writes
 * below already follow and the only one that stays consistent whether the two
 * taps arrive in one request or in two. The per-stop rows keep both opinions
 * either way — nothing is lost, only the coarse category summary is collapsed.
 *
 * `other` is dropped for the same reason the walk-level pass dropped it: every
 * unclassified POI lands there, so a standing signal on it would tell the
 * planner to favour (or avoid) anything at all. The POI-level row for such a
 * stop is still written.
 */
export function deriveCategorySignals(ratings: AttractionRating[]): {
  upvoted: AttractionCategory[];
  downvoted: AttractionCategory[];
} {
  const latest = new Map<AttractionCategory, WalkFeedbackSignal>();
  for (const rating of ratings) {
    if (rating.category === "other") {
      continue;
    }
    latest.set(rating.category, rating.signal);
  }

  const upvoted: AttractionCategory[] = [];
  const downvoted: AttractionCategory[] = [];
  for (const [category, signal] of latest) {
    (signal === "upvote" ? upvoted : downvoted).push(category);
  }

  return { upvoted, downvoted };
}

/**
 * Record per-stop ratings as POI-level `attraction_feedback` rows — the shape
 * the table has always had columns for and nothing has written until now.
 *
 * Written one at a time rather than as one insert so a single bad row (a POI
 * whose name collides with a row this loop already wrote, say) costs its own
 * rating and not the whole batch. Each write is preceded by a delete of the
 * same target so re-rating a stop replaces the old opinion instead of tripping
 * the unique index — the same reason `saveWalkFeedback` below deletes first.
 *
 * Returns how many rows were written; callers treat the rest as lost signal on
 * a walk that is already over.
 */
export async function saveAttractionFeedback(
  supabase: ServerClient,
  userId: string,
  ratings: AttractionRating[],
): Promise<number> {
  let written = 0;

  for (const rating of ratings) {
    // Matched on name rather than the generated `poi_key`, which this side
    // cannot compute without duplicating the column's SQL definition.
    const { error: deleteError } = await supabase
      .from("attraction_feedback")
      .delete()
      .eq("user_id", userId)
      .eq("category", rating.category)
      .eq("poi_name", rating.name);

    if (deleteError) {
      continue;
    }

    const { error: insertError } = await supabase
      .from("attraction_feedback")
      .insert({
        user_id: userId,
        signal: rating.signal,
        category: rating.category,
        osm_id: rating.osmId,
        poi_name: rating.name,
        lat: rating.lat,
        lng: rating.lng,
      });

    if (!insertError) {
      written += 1;
    }
  }

  return written;
}

/**
 * Record a standing category-level rating as one `attraction_feedback` row per
 * category (`poi_name`/`lat`/`lng`/`osm_id` all null, which is the shape the
 * table's check constraint calls category-level, and the shape
 * `getDownvotedCategories` reads).
 *
 * This is what the ranker actually acts on: liking one museum has to raise
 * museums as a whole, not just leave an audit-trail row about that one museum.
 * The caller derives which categories land on which side — see
 * `deriveCategorySignals`.
 *
 * The unique index is (user_id, category, poi_key), and poi_key is a generated
 * column, so a later walk re-rating the same category must replace the standing
 * row. That is done as delete-then-insert rather than an upsert because
 * PostgREST's on_conflict would have to name the generated column, which is not
 * something this code can verify against the live database.
 */
export async function saveWalkFeedback(
  supabase: ServerClient,
  userId: string,
  signal: WalkFeedbackSignal,
  categories: AttractionCategory[],
): Promise<AttractionCategory[]> {
  if (categories.length === 0) {
    return [];
  }

  const { error: deleteError } = await supabase
    .from("attraction_feedback")
    .delete()
    .eq("user_id", userId)
    .is("poi_name", null)
    .in("category", categories);

  if (deleteError) {
    return [];
  }

  const { error: insertError } = await supabase
    .from("attraction_feedback")
    .insert(
      categories.map((category) => ({
        user_id: userId,
        signal,
        category,
      })),
    );

  return insertError ? [] : categories;
}
