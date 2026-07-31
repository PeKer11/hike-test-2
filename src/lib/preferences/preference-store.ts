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

/**
 * Record a whole-walk rating as one category-level `attraction_feedback` row
 * per category the walk actually contained (`poi_name`/`lat`/`lng`/`osm_id` all
 * null, which is the shape the table's check constraint calls category-level).
 *
 * The table has no "walk" concept, so a single "I liked this walk" row has
 * nowhere to live. Fanning it out over the categories on the route is the
 * closest honest mapping: the useful part of the rating for future planning is
 * which KINDS of stops the walk was made of.
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
