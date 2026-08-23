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

/** One `category_preferences` row as the scorer can read it. */
export interface StoredCategoryPreference {
  category: AttractionCategory;
  occurrenceCount: number;
  /** Epoch millis. */
  lastSeenAt: number;
}

/**
 * What one freshly-stated liking is worth to the ranker, and the ceiling a
 * repeated one climbs to.
 *
 * `CATEGORY_BOOST_BASE` is the old flat `PREFERRED_CATEGORY_BOOST` unchanged, on
 * purpose: a walker who says "I love museums" today must get exactly what they
 * got before this existed. `CATEGORY_OCCURRENCE_CAP` is the cap `scoreFact`
 * already uses for the same "how much can repetition buy" question, and the
 * resulting ceiling of 8 is the one this ranker already treats as the strongest
 * a single category signal may get — see `MAX_OCCURRENCE_PREFERENCE_BOOST` and
 * `MAX_DOWNVOTE_PENALTY`.
 */
export const CATEGORY_BOOST_BASE = 4;
export const CATEGORY_BOOST_PER_OCCURRENCE = 1;
export const CATEGORY_OCCURRENCE_CAP = 5;

/**
 * Half-life of a stated taste, in days. The same 60 `scoreFact` uses, and for
 * one reason: that is already this codebase's number for "how long a statement
 * a walker made about themselves stays fresh", and a second, unrelated decay
 * clock in the same preference system would be two numbers to reason about
 * where nothing has been measured that would justify telling them apart.
 */
export const CATEGORY_HALF_LIFE_DAYS = 60;

/**
 * Below this the category is not a preference any more: no boost, not pre-ticked
 * on the form, not led with in the clarification chips, and — the half that was
 * actually broken — explorable again.
 *
 * One is not a magic number. It is what a taste stated once and never repeated
 * decays to after exactly two half-lives, so the rule reads "said once, not
 * mentioned again for four months, stops counting". It is also the smallest
 * boost that can still do anything on the ranker's own scale: the distance term
 * is `-metres / 1000`, so a boost of 1 buys exactly one kilometre of walking,
 * and 1 is the narrowest gap between adjacent `CATEGORY_BASE_SCORE` values
 * (park 7 / religious 6 / food 5 / shopping 4). Under it, the boost can no
 * longer move a category past its neighbour in the base table — it is noise on
 * the sort rather than a preference being expressed.
 *
 * A category the walker has confirmed five times starts at 8 and so stays above
 * the threshold for three half-lives — six months rather than four — which is
 * the durability repetition is supposed to buy.
 */
export const MIN_CATEGORY_WEIGHT = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How much a stored category preference is worth right now.
 *
 *   weight = (CATEGORY_BOOST_BASE
 *             + CATEGORY_BOOST_PER_OCCURRENCE * (min(occ, CAP) - 1))  // 4..8
 *          * 0.5 ** (days / CATEGORY_HALF_LIFE_DAYS)                   // decay
 *
 * Same two terms `scoreFact` has — a height set by how often it was said, and a
 * half-life since it was last said — with one deliberate difference from that
 * precedent: the decay here is MULTIPLICATIVE, where `scoreFact` adds recency
 * as a separate term on top of a floor it can never fall below. That floor is
 * right for a fact and wrong for a taste, and the difference is the whole point
 * of this change. "Does not eat meat" is a constraint about the person and is
 * still true a year later, so a fact must demote without ever deleting itself.
 * "I like museums" is a disposition, and the bug being fixed here is precisely
 * that it never faded — a floor would keep every category the walker ever
 * mentioned permanently above the threshold, which is the monotonic array all
 * over again with extra columns.
 *
 * The decay clock is `lastSeenAt`, which every repeat resets. So repetition buys
 * height AND, through the reset, freshness — and a category with five
 * occurrences that has genuinely gone quiet for a year does fall to nothing,
 * which is the honest reading of a walker who stopped mentioning it.
 *
 * A timestamp in the future (clock skew, not a real reading) is treated as now
 * rather than given a bonus for it, the same way `scoreFact` treats one.
 */
export function categoryPreferenceWeight(
  preference: StoredCategoryPreference,
  now: Date,
): number {
  const days = Math.max(0, (now.getTime() - preference.lastSeenAt) / MS_PER_DAY);
  const occurrences = Math.min(
    Math.max(1, preference.occurrenceCount),
    CATEGORY_OCCURRENCE_CAP,
  );

  const height =
    CATEGORY_BOOST_BASE + CATEGORY_BOOST_PER_OCCURRENCE * (occurrences - 1);

  return height * 0.5 ** (days / CATEGORY_HALF_LIFE_DAYS);
}

/**
 * The walker's standing tastes as the ranker reads them: category to current
 * weight, with everything that has decayed under `MIN_CATEGORY_WEIGHT` left
 * out entirely rather than carried at a weight too small to matter.
 *
 * Leaving them out is what re-opens exploration. The ranker takes "is this
 * category in the map" as "this question is already answered", so a taste that
 * has faded has to disappear from the map, not merely shrink inside it.
 */
export function activeCategoryWeights(
  preferences: StoredCategoryPreference[],
  now: Date,
): Map<AttractionCategory, number> {
  const weights = new Map<AttractionCategory, number>();

  for (const preference of preferences) {
    if (!isCategory(preference.category) || preference.category === "other") {
      continue;
    }

    const weight = categoryPreferenceWeight(preference, now);
    if (weight < MIN_CATEGORY_WEIGHT) {
      continue;
    }

    // One row per (user, category) is a unique index, but a duplicate that gets
    // past it is a stronger claim collapsing into a weaker one rather than into
    // whichever row came back last.
    weights.set(
      preference.category,
      Math.max(weights.get(preference.category) ?? 0, weight),
    );
  }

  return weights;
}

/**
 * The categories still counting as preferences, strongest first — what the
 * callers that want a plain list rather than a weight read.
 *
 * Ordered rather than in row order because both of those callers care about
 * order: `suggestClarificationCategories` leads with them, and leading with the
 * taste the walker has confirmed five times beats leading with whichever row
 * PostgREST happened to return first. Ties break on the more recently stated
 * one, the same tiebreak `selectFactsForPrompt` uses.
 */
export function activeCategories(
  preferences: StoredCategoryPreference[],
  now: Date,
): AttractionCategory[] {
  const weights = activeCategoryWeights(preferences, now);
  const lastSeen = new Map<AttractionCategory, number>();
  for (const preference of preferences) {
    lastSeen.set(
      preference.category,
      Math.max(lastSeen.get(preference.category) ?? 0, preference.lastSeenAt),
    );
  }

  return [...weights.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] || (lastSeen.get(b[0]) ?? 0) - (lastSeen.get(a[0]) ?? 0),
    )
    .map(([category]) => category);
}
