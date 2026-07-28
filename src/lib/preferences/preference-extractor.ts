import { toCandidate } from "@/lib/places/place-extractor";
import type { AttractionCategory } from "@/lib/types";

/**
 * The categories a preference can be expressed about. Mirrors
 * `AttractionCategory` in `src/lib/types/walk-plan.ts` and the
 * `attraction_category` enum in the initial migration — keep all three in sync.
 */
export const ATTRACTION_CATEGORIES: AttractionCategory[] = [
  "landmark",
  "museum",
  "park",
  "food",
  "viewpoint",
  "religious",
  "shopping",
  "entertainment",
  "nature",
  "other",
];

// A model can return any number of preferences; cap it so one odd reply cannot
// rewrite a whole profile.
const MAX_PREFERENCES = 6;

export type PreferenceSentiment = "like" | "dislike";

export interface CategoryPreference {
  category: AttractionCategory;
  sentiment: PreferenceSentiment;
}

/**
 * System instruction for the preference pass. Lives here rather than in
 * `gemini-client.ts` so tests can read it — that module is `server-only`.
 *
 * The whole instruction is built around not over-inferring. The walker is
 * describing a walk, not filling in a profile form: most of what they type
 * ("90 minutes", "I don't know my pace", "somewhere near the beach") carries no
 * standing preference at all, and a guessed one is worse than none — it is
 * written to their profile and quietly biases every future walk.
 */
export const PREFERENCE_EXTRACTION_SYSTEM_PROMPT = [
  "You read a walker's free text and extract only the standing preferences they clearly express about KINDS of places.",
  `The kinds are exactly these: ${ATTRACTION_CATEGORIES.join(", ")}.`,
  "Return `preferences`: a list of { category, sentiment } where sentiment is 'like' or 'dislike'.",
  "Only include a category when the text states a clear liking, interest, dislike, or avoidance of that kind of place.",
  "Return an empty list when the text expresses no such preference. That is the normal, expected answer — most texts have none.",
  "Never infer a preference from a place the walker merely names, from a duration, from a distance, or from a mood.",
  "Uncertainty is not a preference: 'I don't know my pace', 'maybe', 'whatever you suggest' produce nothing.",
  "Never guess. If you are unsure whether something is a preference, leave it out.",
  "Never return 'other' — it carries no signal.",
  "Examples:",
  '"אני מאד אוהב מקומות טבע, 90 דקות, לא יודע מה הקצב שלי" -> [{ category: "nature", sentiment: "like" }] — only the love of nature is a preference; the duration and the unknown pace are not.',
  '"I love museums but please no shopping streets" -> [{ category: "museum", sentiment: "like" }, { category: "shopping", sentiment: "dislike" }].',
  '"Take me to Habima Square and the Jaffa port, about 2 hours" -> [] — named stops and a duration, no stated preference.',
  '"That was a nice walk" -> [] — no category mentioned.',
].join("\n");

function isCategory(value: unknown): value is AttractionCategory {
  return (
    typeof value === "string" &&
    (ATTRACTION_CATEGORIES as string[]).includes(value)
  );
}

function isSentiment(value: unknown): value is PreferenceSentiment {
  return value === "like" || value === "dislike";
}

/**
 * Read the preference list off a model reply — a JSON-mode text reply, an
 * already-parsed object, or a bare array — dropping anything that isn't a
 * known category with a known sentiment. Returns an empty array rather than
 * throwing when nothing usable is found: "no preference" is the common answer,
 * and a malformed reply must degrade to it rather than to a 500.
 *
 * `other` is dropped here as well as in the prompt. It is a real enum value, but
 * as a preference it says nothing — every unclassified POI lands in it, so
 * storing it would tell the planner to favour "anything".
 */
export function parseCategoryPreferences(input: unknown): CategoryPreference[] {
  const candidate = toCandidate(input);

  const list = Array.isArray(candidate)
    ? candidate
    : candidate !== null && typeof candidate === "object"
      ? (candidate as Record<string, unknown>).preferences
      : null;

  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set<string>();
  const result: CategoryPreference[] = [];

  for (const raw of list) {
    if (raw === null || typeof raw !== "object") continue;

    const { category, sentiment } = raw as Record<string, unknown>;
    if (!isCategory(category) || !isSentiment(sentiment)) continue;
    if (category === "other") continue;
    // First mention of a category wins — a reply that both likes and dislikes
    // the same thing has contradicted itself, and neither half is trustworthy
    // enough to overwrite the other.
    if (seen.has(category)) continue;

    seen.add(category);
    result.push({ category, sentiment });
    if (result.length >= MAX_PREFERENCES) break;
  }

  return result;
}

/**
 * Fold newly-detected preferences into the categories already on the profile:
 * a `like` is appended if missing, a `dislike` removes the category if present.
 *
 * Returns `null` when the merge changes nothing, so the caller can skip the
 * write entirely instead of touching `updated_at` on every prompt.
 */
export function mergePreferredCategories(
  existing: AttractionCategory[],
  detected: CategoryPreference[],
): AttractionCategory[] | null {
  const next: AttractionCategory[] = [];
  for (const category of existing) {
    if (isCategory(category) && !next.includes(category)) {
      next.push(category);
    }
  }

  for (const { category, sentiment } of detected) {
    if (sentiment === "like") {
      if (!next.includes(category)) {
        next.push(category);
      }
      continue;
    }

    const index = next.indexOf(category);
    if (index !== -1) {
      next.splice(index, 1);
    }
  }

  const unchanged =
    next.length === existing.length &&
    next.every((category, index) => category === existing[index]);

  return unchanged ? null : next;
}
