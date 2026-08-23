import "server-only";

import { extractCategoryPreferences } from "@/lib/api/gemini-client";
import { createClient } from "@/lib/supabase/server";
import type { AttractionCategory } from "@/lib/types";

import { poiIdentityKeys } from "./poi-key";
import {
  activeCategories,
  activeCategoryWeights,
  ATTRACTION_CATEGORIES,
  type CategoryPreference,
  type StoredCategoryPreference,
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

const CATEGORY_PREFERENCE_COLUMNS = "category, occurrence_count, last_seen_at";

/**
 * One `category_preferences` row as the scorer reads it, or null when it is not
 * usable — an unknown category (written by an older schema or by hand), or a
 * timestamp that will not parse.
 *
 * Dropping an unknown category matters beyond scoring: it would still be a key
 * in the weight map, which is what tells the ranker a category is already
 * answered and must not be explored into.
 */
function toStoredPreference(
  row: Record<string, unknown>,
): StoredCategoryPreference | null {
  const category = row.category;
  if (!(ATTRACTION_CATEGORIES as string[]).includes(category as string)) {
    return null;
  }

  const lastSeenAt = Date.parse(String(row.last_seen_at));
  if (!Number.isFinite(lastSeenAt)) {
    return null;
  }

  return {
    category: category as AttractionCategory,
    occurrenceCount: toOccurrenceCount(row.occurrence_count),
    lastSeenAt,
  };
}

/**
 * Every standing taste on record, unscored — the raw rows, for the two readers
 * below that want different things out of them.
 *
 * Best effort like every read here: no rows, no session or a failed read all
 * come back empty and the walk is planned from the request alone, exactly as it
 * was before any of this existed.
 */
export async function getCategoryPreferences(
  supabase: ServerClient,
  userId: string,
): Promise<StoredCategoryPreference[]> {
  try {
    const { data, error } = await supabase
      .from("category_preferences")
      .select(CATEGORY_PREFERENCE_COLUMNS)
      .eq("user_id", userId);

    if (error || !Array.isArray(data)) {
      return [];
    }

    const preferences: StoredCategoryPreference[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const preference = toStoredPreference(row);
      if (preference) {
        preferences.push(preference);
      }
    }

    return preferences;
  } catch {
    return [];
  }
}

/**
 * What the walker's standing tastes are worth to the ranker right now — the
 * decayed weight per category, with anything under `MIN_CATEGORY_WEIGHT` left
 * out. This is the read that replaced the flat `preferred_categories` array on
 * the walk-plan path.
 */
export async function getPreferredCategoryWeights(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<Map<AttractionCategory, number>> {
  return activeCategoryWeights(
    await getCategoryPreferences(supabase, userId),
    now,
  );
}

/**
 * The same standing tastes as a plain list, strongest first — for the callers
 * that want "which categories currently count" rather than by how much: the
 * clarification chips, which lead with them, and the walk form, which pre-ticks
 * them.
 *
 * A category that has decayed under the threshold is simply not in this list.
 * That is the point: pre-ticking a chip or leading a question with a taste the
 * walker last mentioned four months ago and never repeated is the app claiming
 * to know something it no longer does.
 */
export async function getPreferredCategories(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<AttractionCategory[]> {
  return activeCategories(await getCategoryPreferences(supabase, userId), now);
}

/** What the walk form can pre-fill from a returning walker's saved profile. */
export interface ProfileDefaults {
  /** `null` when the profile has never recorded a pace. */
  walkingPaceMinPerKm: number | null;
  preferredCategories: AttractionCategory[];
}

const NO_PROFILE_DEFAULTS: ProfileDefaults = {
  walkingPaceMinPerKm: null,
  preferredCategories: [],
};

/**
 * The saved profile as *starting values for the walk form* — the walker's pace
 * and the kinds of stop they like, so a returning walker isn't asked again for
 * what the app already learned.
 *
 * Two round trips since 2026-08-23 rather than one, because the categories
 * moved out of `profiles` and into their own table — run in parallel, and a
 * failure on either side costs only its own half.
 *
 * Pre-ticks the *currently counting* categories, not everything ever stated:
 * `getPreferredCategories` has already dropped anything decayed under
 * `MIN_CATEGORY_WEIGHT`. A ticked chip is the form claiming the walker likes
 * that kind of place, and it should stop making that claim at the same moment
 * the ranker stops acting on it.
 *
 * Best effort like every other read here, and then some: this one runs while
 * the hub page is rendering, so a thrown client error would cost the whole page
 * rather than one feature. No profile row, no saved values, a failed read or a
 * client that blew up all come back as "nothing saved" and the form opens on its
 * own defaults exactly as it did before this existed.
 */
export async function getProfileDefaults(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<ProfileDefaults> {
  try {
    const [profile, preferredCategories] = await Promise.all([
      supabase
        .from("profiles")
        .select("walking_pace_min_per_km")
        .eq("id", userId)
        .maybeSingle(),
      getPreferredCategories(supabase, userId, now),
    ]);

    const { data, error } = profile;
    if (error || !data) {
      return { ...NO_PROFILE_DEFAULTS, preferredCategories };
    }

    // The column is `numeric`, which PostgREST can hand back as a string as
    // readily as a number, and the check constraint only holds for rows written
    // through it — so parse and re-check rather than trusting the shape.
    const pace = Number(data.walking_pace_min_per_km);

    return {
      walkingPaceMinPerKm:
        Number.isFinite(pace) && pace > 0 && pace <= 60 ? pace : null,
      preferredCategories,
    };
  } catch {
    return NO_PROFILE_DEFAULTS;
  }
}

/**
 * A row's `occurrence_count` as a count the ranker can multiply by. The column
 * is `integer not null default 1 check (> 0)`, but PostgREST can hand a numeric
 * back as a string and a row written before the column existed reads as null —
 * anything that is not a whole positive number is one occurrence, which is what
 * a standing row meant before this was tracked.
 */
function toOccurrenceCount(value: unknown): number {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

/**
 * Category-level `attraction_feedback` rows for one signal direction, each
 * with how many times that signal has been repeated. Shared by
 * `getDownvotedCategories` and `getUpvotedCategories` — same query, same
 * "unknown category / duplicate row" guards, only the `signal` filter differs.
 */
async function getCategorySignalCounts(
  supabase: ServerClient,
  userId: string,
  signal: WalkFeedbackSignal,
): Promise<Map<AttractionCategory, number>> {
  const { data, error } = await supabase
    .from("attraction_feedback")
    .select("category, occurrence_count")
    .eq("user_id", userId)
    .eq("signal", signal)
    .is("poi_name", null);

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  // A category written by an older schema is not necessarily one the ranker
  // still knows. One row per category is not guaranteed either once a
  // POI-level shape sneaks past, so duplicates collapse to the strongest count
  // rather than to whichever row came last.
  const counts = new Map<AttractionCategory, number>();
  for (const row of data as { category: unknown; occurrence_count: unknown }[]) {
    const category = row.category;
    if (!(ATTRACTION_CATEGORIES as string[]).includes(category as string)) {
      continue;
    }

    const known = category as AttractionCategory;
    const count = toOccurrenceCount(row.occurrence_count);
    counts.set(known, Math.max(counts.get(known) ?? 0, count));
  }

  return counts;
}

/**
 * The categories the walker has voted down as a whole, each with how many times
 * that downvote has been repeated — one of two behavioural signals that fold
 * into the ranker, alongside `getUpvotedCategories` below.
 *
 * The count is the point: one downvote can be a bad day, an unlucky stop or no
 * time left, while the same downvote after several walks is a preference. The
 * ranker scales its penalty on it rather than treating both the same.
 *
 * Category-level rows only (`poi_name is null`, the shape the table's check
 * constraint calls category-level). A downvote on one specific POI says "not
 * that place", which is a different claim from "not that kind of place", and
 * suppressing a whole category off one bad museum would be the wrong lesson.
 * The POI-level half of that signal is read separately, by
 * `getDownvotedPoiKeys` below.
 *
 * Best effort exactly like the reads above: no rows, no session or a failed
 * read all come back empty and the walk is planned as it was before.
 */
export async function getDownvotedCategories(
  supabase: ServerClient,
  userId: string,
): Promise<Map<AttractionCategory, number>> {
  return getCategorySignalCounts(supabase, userId, "downvote");
}

/**
 * The categories the walker has voted up as a whole from post-walk feedback,
 * each with how many times that upvote has been repeated — the positive-side
 * counterpart to `getDownvotedCategories`.
 *
 * This is `attraction_feedback` behavioural evidence (end-of-walk taps), not
 * `profiles.preferred_categories` (explicit free-text statements read by
 * `getPreferredCategories`) — the two are different kinds of evidence and the
 * ranker treats them differently (see `PREFERRED_CATEGORY_BOOST` vs
 * `occurrencePreferenceBoost` in `attraction-ranker.ts`), so both are read and
 * both feed the score, additively rather than one replacing the other.
 */
export async function getUpvotedCategories(
  supabase: ServerClient,
  userId: string,
): Promise<Map<AttractionCategory, number>> {
  return getCategorySignalCounts(supabase, userId, "upvote");
}

/** A `numeric` coordinate column as a number, or null if it is not one. */
function toCoordinate(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The specific places the walker has voted down, as `poi_key` identities the
 * ranker can test a freshly-discovered Overpass result against.
 *
 * Distinct from `getDownvotedCategories` in what it claims and in what it
 * costs the candidate. A category downvote says "less of this kind of place"
 * and is priced into the score; a POI downvote says "not THAT place again",
 * which no amount of score can honour — a strong enough notability bonus would
 * put the rejected place back at the top of the walk. So this one is a hard
 * exclusion rather than a penalty.
 *
 * No occurrence count, unlike the category reads: repetition is what turns a
 * category tap into evidence, because one bad museum is not an opinion about
 * museums. A POI downvote is already about the only thing it could be about.
 *
 * Both identities of each row are returned — see `poiIdentityKeys`. Best
 * effort like every read here: no rows, no session or a failed read all come
 * back empty and nothing is suppressed.
 */
export async function getDownvotedPoiKeys(
  supabase: ServerClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("attraction_feedback")
    .select("osm_id, poi_name, lat, lng")
    .eq("user_id", userId)
    .eq("signal", "downvote")
    .not("poi_name", "is", null);

  if (error || !Array.isArray(data)) {
    return new Set();
  }

  const keys = new Set<string>();
  for (const row of data as {
    osm_id: unknown;
    poi_name: unknown;
    lat: unknown;
    lng: unknown;
  }[]) {
    // `lat`/`lng` are `numeric`, which PostgREST hands back as a string as
    // readily as a number. A row that fails to parse has no usable coordinate
    // key, but may still carry an OSM id worth matching on — hence the explicit
    // null check, since `Number(null)` is a perfectly finite 0 on the equator.
    const lat = toCoordinate(row.lat);
    const lng = toCoordinate(row.lng);
    const hasCoords = lat !== null && lng !== null;

    for (const key of poiIdentityKeys({
      osmId: typeof row.osm_id === "string" ? row.osm_id : null,
      name: hasCoords && typeof row.poi_name === "string" ? row.poi_name : null,
      lat: lat ?? 0,
      lng: lng ?? 0,
    })) {
      keys.add(key);
    }
  }

  return keys;
}

/**
 * Fold one newly-detected `like` into what is already on record, mirroring
 * `upsertFact` next door.
 *
 * Hit on `(user_id, category)`: the count goes up and `last_seen_at` moves, so
 * the taste both gets taller and restarts its decay clock. `first_seen_at` is
 * left alone — it is the only record of how long the taste has been held.
 *
 * Miss: insert at one occurrence, both timestamps defaulting to now in the
 * database rather than being sent, so the clock is Postgres's and not this
 * process's.
 */
async function upsertCategoryPreference(
  supabase: ServerClient,
  userId: string,
  category: AttractionCategory,
  existing: StoredCategoryPreference | undefined,
  now: Date,
): Promise<boolean> {
  if (existing) {
    const { error } = await supabase
      .from("category_preferences")
      .update({
        occurrence_count: existing.occurrenceCount + 1,
        last_seen_at: now.toISOString(),
      })
      .eq("user_id", userId)
      .eq("category", category);

    return !error;
  }

  const { error } = await supabase
    .from("category_preferences")
    .insert({ user_id: userId, category });

  return !error;
}

/**
 * Fold a batch of freshly-detected preferences into the walker's standing
 * tastes, and return the categories that still count afterwards.
 *
 * A `like` upserts: first time in, it is one occurrence at full weight; said
 * again, the count goes up and the clock resets. This is what replaced
 * `mergePreferredCategories`, whose whole vocabulary was "in the array or not".
 *
 * A `dislike` DELETES the row. Three alternatives were considered — zeroing the
 * weight, resetting the occurrence count, and a `dismissed_at` column — and
 * delete is the faithful port of what a dislike already did to the array. A
 * dislike is not "this taste has faded", which is what the decay is for; it is
 * "this was never a taste", and there is nothing left to decay. Keeping a
 * zeroed row would mean carrying state no reader can tell apart from absence.
 * The negative direction is already modelled properly next door, by
 * `attraction_feedback` downvote rows with their own occurrence count feeding
 * `downvotePenalty` — a second negative store here would be two mechanisms for
 * one claim. So "no shopping streets" returns shopping to neutral, which is
 * what the sentence said; it does not push it below neutral.
 *
 * Written one category at a time rather than as one statement so a single bad
 * row costs its own preference and not the batch, the same reason
 * `saveAttractionFeedback` writes per rating.
 *
 * Best effort by design: preference learning is a side effect of a request the
 * user made for something else, so a failure here is swallowed and the caller's
 * real work still succeeds.
 */
export async function saveCategoryPreferences(
  supabase: ServerClient,
  userId: string,
  detected: CategoryPreference[],
  now: Date = new Date(),
): Promise<AttractionCategory[] | null> {
  if (detected.length === 0) {
    return null;
  }

  const existing = await getCategoryPreferences(supabase, userId);
  const byCategory = new Map(
    existing.map((preference) => [preference.category, preference]),
  );

  let wrote = false;

  for (const { category, sentiment } of detected) {
    // `other` carries no signal and the table's check constraint refuses it.
    if (category === "other") {
      continue;
    }

    if (sentiment === "like") {
      const known = byCategory.get(category);
      if (
        await upsertCategoryPreference(supabase, userId, category, known, now)
      ) {
        wrote = true;
        byCategory.set(category, {
          category,
          occurrenceCount: (known?.occurrenceCount ?? 0) + 1,
          lastSeenAt: now.getTime(),
        });
      }
      continue;
    }

    if (!byCategory.has(category)) {
      continue;
    }

    const { error } = await supabase
      .from("category_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("category", category);

    if (!error) {
      wrote = true;
      byCategory.delete(category);
    }
  }

  // Null when nothing landed, so the caller can tell "learned nothing" from
  // "learned something that happens to leave the list looking the same" — the
  // same contract `mergePreferredCategories` had.
  return wrote ? activeCategories([...byCategory.values()], now) : null;
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
 * column, so a later walk re-rating the same category has to move the standing
 * row in place. That is done as read-then-insert-or-update rather than an
 * upsert because PostgREST's on_conflict would have to name the generated
 * column, which is not something this code can verify against the live
 * database.
 *
 * Three cases, and `occurrence_count` is what distinguishes them:
 *
 *   nothing standing   — insert the signal at one occurrence.
 *   same signal again  — increment. Repeated evidence in one direction is the
 *                        whole reason the column exists: the ranker scales its
 *                        penalty on the count, so "disliked museums on four
 *                        walks" outweighs "disliked museums once".
 *   opposite signal    — reset to the new signal at one occurrence.
 *
 * The reset is the interesting choice. Decrementing (treating the flip as one
 * unit of evidence against the accumulated pile) would keep a category the
 * walker has since come round on suppressed for several more walks, and worse,
 * it makes the standing row's `signal` disagree with what the walker last said
 * for as long as the count takes to unwind. Resetting keeps the row honest —
 * it always names the walker's current opinion — at the cost of throwing away
 * the old evidence, which is the right trade here because a flip is the walker
 * explicitly contradicting themselves, not noise. The new direction then has to
 * earn its strength again from one occurrence up, so a single outlier tap
 * cannot immediately swing the ranker as hard as the history it replaced.
 *
 * Best effort like everything else on this path: a failed read or write costs
 * that category's standing signal, not the request.
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

  const { data, error: readError } = await supabase
    .from("attraction_feedback")
    .select("category, signal, occurrence_count")
    .eq("user_id", userId)
    .is("poi_name", null)
    .in("category", categories);

  if (readError || !Array.isArray(data)) {
    return [];
  }

  const standing = new Map<string, { signal: unknown; count: number }>();
  for (const row of data as {
    category: unknown;
    signal: unknown;
    occurrence_count: unknown;
  }[]) {
    standing.set(String(row.category), {
      signal: row.signal,
      count: toOccurrenceCount(row.occurrence_count),
    });
  }

  const written: AttractionCategory[] = [];
  const toInsert: AttractionCategory[] = [];

  for (const category of categories) {
    const existing = standing.get(category);

    if (!existing) {
      toInsert.push(category);
      continue;
    }

    const { error: updateError } = await supabase
      .from("attraction_feedback")
      .update(
        existing.signal === signal
          ? { occurrence_count: existing.count + 1 }
          : { signal, occurrence_count: 1 },
      )
      .eq("user_id", userId)
      .eq("category", category)
      .is("poi_name", null);

    if (!updateError) {
      written.push(category);
    }
  }

  if (toInsert.length === 0) {
    return written;
  }

  const { error: insertError } = await supabase
    .from("attraction_feedback")
    .insert(
      toInsert.map((category) => ({
        user_id: userId,
        signal,
        category,
        occurrence_count: 1,
      })),
    );

  return insertError ? written : [...written, ...toInsert];
}
