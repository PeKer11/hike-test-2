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
  /**
   * Which way the walker's last statement about this category pointed. A row is
   * one opinion, not one liking — see `categoryPreferenceWeight`, which signs
   * the weight off this.
   */
  sentiment: PreferenceSentiment;
  occurrenceCount: number;
  /** Epoch millis. Not the decay clock any more — see `lastSeenSession`. */
  lastSeenAt: number;
  /**
   * `profiles.session_count` at the moment this was last stated, or null when
   * the row carries nothing readable. Null is read as "this session" rather than
   * as session zero: a row we cannot age is treated as fresh, because the
   * failure we can afford is a preference lasting too long, not one silently
   * deleted.
   */
  lastSeenSession: number | null;
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
 * What one stated DISLIKE is worth, as a magnitude — the weight is negative.
 *
 * Flat, and at the ceiling from the first statement, where a liking climbs to
 * that same ceiling only over five. That asymmetry is the whole of Ariel's
 * "לא למחוק אלא להוריד הרבה מהניקוד" — don't delete it, take a lot off the
 * score — and it is the same reasoning `withExplorationPick` already runs on
 * for the other kind of dislike: a dislike is an answer, not a question. A
 * liking accumulates because "museums" said once is one guess among the eight
 * other categories the walker has not mentioned; "no shopping streets" is not a
 * guess about shopping, it is the whole answer about shopping, and asking the
 * walker to say it five times before it counts fully is the app not listening.
 *
 * Eight rather than a new number: it is what this ranker already treats as the
 * strongest a single category signal may be worth in either direction —
 * `MAX_DOWNVOTE_PENALTY`, `MAX_OCCURRENCE_PREFERENCE_BOOST`, and the ceiling a
 * five-times-confirmed liking reaches here. Nothing about a stated dislike
 * justifies inventing a stronger tier than the ranker's own maximum.
 *
 * What it buys, on the ranker's real scale: shopping has a `CATEGORY_BASE_SCORE`
 * of 4, so a disliked shopping street enters the ranking at -4, below every
 * other category's base before a metre of walking is counted. It is a penalty,
 * not a deletion — a shopping street carrying both wikidata and wikipedia (+5)
 * still lands at 1 and can be surfaced if there is genuinely nothing else
 * nearby. Hard exclusion is `downvotedPoiKeys`' job and names one place; a
 * category-level signal stays a matter of degree, exactly as
 * `MAX_DOWNVOTE_PENALTY`'s own comment argues.
 *
 * A second dislike adds no height — it is already at the ceiling — but it does
 * reset the decay clock, which is what keeps it alive for another three
 * sessions. `occurrence_count` still counts it, because the row should record
 * what the walker actually said whether or not today's curve reads it.
 */
export const CATEGORY_DISLIKE_WEIGHT = 8;

/**
 * Half-life of a stated preference, in SESSIONS — walk plans the walker has
 * successfully built since the taste was last confirmed (`profiles.session_count`
 * against the row's `last_seen_session`). Not days, and this is the second half
 * of Ariel's review: "אם הסשן הקודם היה לפני 100 יום, זה לא אומר כלום על זה
 * שההעדפות שלו השתנו" — a walker who has not opened the app in 100 days has not
 * been changing their mind for 100 days, they have been elsewhere. Nothing about
 * a dormant account is evidence about taste. What IS evidence is the walker
 * using the app repeatedly and not mentioning a category again.
 *
 * Three, and it needs its own reasoning because nothing else in this codebase
 * runs on a session clock — `HALF_LIFE_DAYS = 60` in `scoreFact` is a calendar
 * number and does not translate. From first principles:
 *
 * A session here is a whole walk planned: the walker opened the app, typed what
 * they wanted, and got a route. That is a deliberate, effortful act, not a page
 * view, and each one is an opportunity for the walker to say "I love museums"
 * that they took or did not take. Three of those is already a real span of
 * someone's life with this app.
 *
 * The consequences, which are what the number should actually be picked on:
 *   - a taste stated once and never repeated falls under `MIN_CATEGORY_WEIGHT`
 *     after two half-lives — SIX walks planned without the walker mentioning it
 *     again. Six is enough that "they never bring it up" is a fact about them
 *     rather than a run of walks that happened to be about something else.
 *   - a five-times-confirmed taste starts at 8 and survives three half-lives —
 *     NINE walks — so repetition still buys half again as much durability. Same
 *     property the day-based version had, at a tenth of the scale.
 *   - a dislike, also at 8, likewise stands for nine walks before it fades back
 *     to neutral, which answers "does 'I hate shopping' last forever?" with no.
 *
 * Why not 1: a single unrelated walk would halve a taste the walker stated last
 * week, and one walk is exactly the noise `occurrence_count` exists to smooth.
 * Why not 10: thirty-odd walks before a single statement expires is months of
 * ordinary use, which is the monotonic array again wearing a decay curve.
 */
export const CATEGORY_HALF_LIFE_SESSIONS = 3;


/**
 * Below this MAGNITUDE the category is not an opinion any more: no boost, no
 * penalty, not pre-ticked on the form, not led with in the clarification chips,
 * and — the half that was actually broken — explorable again.
 *
 * Magnitude, not value, since 2026-08-23: a weight of -6 is a strong opinion
 * that happens to point downwards, and testing it against 1 with a bare `<`
 * would throw away every dislike the moment it was stored.
 *
 * One is not a magic number. It is what a preference stated once and never
 * repeated decays to after exactly two half-lives, so the rule reads "said once,
 * not mentioned again across six more walks, stops counting". It is also the
 * smallest weight that can still do anything on the ranker's own scale: the
 * distance term is `-metres / 1000`, so a weight of 1 moves a candidate by
 * exactly one kilometre of walking, and 1 is the narrowest gap between adjacent
 * `CATEGORY_BASE_SCORE` values (park 7 / religious 6 / food 5 / shopping 4).
 * Under it, the weight can no longer move a category past its neighbour in the
 * base table — it is noise on the sort rather than an opinion being expressed.
 *
 * A category the walker has confirmed five times starts at 8 and so stays above
 * the threshold for three half-lives — nine walks rather than six — which is the
 * durability repetition is supposed to buy. A dislike starts at 8 too, so it
 * stands for the same nine.
 */
export const MIN_CATEGORY_WEIGHT = 1;

/**
 * How many of the walker's own sessions have passed since this preference was
 * last stated — the decay input, and the whole of what replaced elapsed days.
 *
 * Clamped at zero from both ends. A row stamped at a session number higher than
 * the current count is not a real reading (the profile row failed to come back
 * and defaulted to zero, or a write raced a read), and the same is true of a
 * null stamp, so both are read as "this session" and left undecayed. That is the
 * deliberate direction: the failure this feature can afford is a preference that
 * outlives its welcome, not one silently deleted, which is the bug the previous
 * design shipped with.
 */
function sessionsSince(
  preference: StoredCategoryPreference,
  currentSessionCount: number,
): number {
  if (
    preference.lastSeenSession === null ||
    !Number.isFinite(preference.lastSeenSession) ||
    !Number.isFinite(currentSessionCount)
  ) {
    return 0;
  }

  return Math.max(0, currentSessionCount - preference.lastSeenSession);
}

/**
 * What a stored category preference is worth right now — POSITIVE for a liking,
 * NEGATIVE for a dislike, and decaying towards zero from whichever side it
 * started on.
 *
 *   height = sentiment === "like"
 *     ? CATEGORY_BOOST_BASE
 *       + CATEGORY_BOOST_PER_OCCURRENCE * (min(occ, CAP) - 1)   //  +4 .. +8
 *     : -CATEGORY_DISLIKE_WEIGHT                                 //  -8, flat
 *
 *   weight = height * 0.5 ** (sessions / CATEGORY_HALF_LIFE_SESSIONS)
 *
 * Two terms, the same shape `scoreFact` has — a height set by how firmly the
 * thing was said, and a half-life since it was last said — with two deliberate
 * departures from that precedent, one old and one new.
 *
 * The old one: the decay is MULTIPLICATIVE, where `scoreFact` adds recency as a
 * separate term on top of a floor it can never fall below. That floor is right
 * for a fact and wrong for a taste. "Does not eat meat" is a constraint about
 * the person and is still true a year later, so a fact must demote without ever
 * deleting itself. "I like museums" is a disposition, and the bug that produced
 * this whole file is precisely that it never faded — a floor would keep every
 * category the walker ever mentioned permanently above the threshold, which is
 * the monotonic array all over again with extra columns.
 *
 * The new one (2026-08-23, Ariel's review): the clock is the walker's own
 * sessions, not the calendar. A hundred dormant days are not evidence about
 * anything; six walks planned without the category coming up are.
 *
 * Both directions ride the same curve on purpose, rather than a dislike being a
 * permanent flag. A dislike is a statement with an age like any other, and one
 * that has not been repeated across nine walks has as much claim on the ranking
 * as a liking in the same position: none. Every repeat, of either polarity,
 * resets the clock — so repetition buys height AND, through the reset,
 * freshness.
 */
export function categoryPreferenceWeight(
  preference: StoredCategoryPreference,
  currentSessionCount: number,
): number {
  const sessions = sessionsSince(preference, currentSessionCount);

  const height =
    preference.sentiment === "dislike"
      ? -CATEGORY_DISLIKE_WEIGHT
      : CATEGORY_BOOST_BASE +
        CATEGORY_BOOST_PER_OCCURRENCE *
          (Math.min(
            Math.max(1, preference.occurrenceCount),
            CATEGORY_OCCURRENCE_CAP,
          ) -
            1);

  return height * 0.5 ** (sessions / CATEGORY_HALF_LIFE_SESSIONS);
}

/**
 * The walker's standing opinions as the ranker reads them: category to current
 * signed weight, with everything whose magnitude has decayed under
 * `MIN_CATEGORY_WEIGHT` left out entirely rather than carried at a number too
 * small to matter.
 *
 * Leaving them out is what re-opens exploration. The ranker takes "is this
 * category in the map" as "this question is already answered", so an opinion
 * that has faded has to disappear from the map, not merely shrink inside it —
 * and, symmetrically, a live dislike has to STAY in the map, which is what stops
 * the exploration slot being spent on the one category the walker has explicitly
 * ruled out. That was the asymmetry the delete-on-dislike design shipped with.
 */
export function activeCategoryWeights(
  preferences: StoredCategoryPreference[],
  currentSessionCount: number,
): Map<AttractionCategory, number> {
  const weights = new Map<AttractionCategory, number>();

  for (const preference of preferences) {
    if (!isCategory(preference.category) || preference.category === "other") {
      continue;
    }

    const weight = categoryPreferenceWeight(preference, currentSessionCount);
    if (Math.abs(weight) < MIN_CATEGORY_WEIGHT) {
      continue;
    }

    // One row per (user, category) is a unique index, but a duplicate that gets
    // past it collapses to the stronger claim rather than to whichever row came
    // back last — by magnitude, so a live dislike is not quietly outranked by a
    // faded liking for having the larger signed value.
    const standing = weights.get(preference.category);
    if (standing === undefined || Math.abs(weight) > Math.abs(standing)) {
      weights.set(preference.category, weight);
    }
  }

  return weights;
}

/**
 * The categories the walker still LIKES, strongest first — what the callers that
 * want a plain list rather than a weight read.
 *
 * Positives only. Both callers act on the list as an endorsement — the walk form
 * pre-ticks it, `suggestClarificationCategories` leads the question with it — and
 * a disliked category belongs in neither. What a dislike belongs in is
 * `dislikedCategories` below, which is what the clarification pass drops.
 *
 * Ordered rather than in row order because both of those callers care about
 * order: leading with the taste the walker has confirmed five times beats
 * leading with whichever row PostgREST happened to return first. Ties break on
 * the more recently stated one, the same tiebreak `selectFactsForPrompt` uses —
 * which is what `lastSeenAt` is still stored for now that it no longer runs the
 * decay clock.
 */
export function activeCategories(
  preferences: StoredCategoryPreference[],
  currentSessionCount: number,
): AttractionCategory[] {
  return orderedByStrength(preferences, currentSessionCount, (weight) =>
    weight >= MIN_CATEGORY_WEIGHT,
  );
}

/**
 * The categories the walker has explicitly said they do NOT want, strongest
 * first — the mirror of `activeCategories`, and read by the clarification pass
 * so a walker who typed "no shopping streets" is never handed a shopping chip.
 *
 * A stated dislike and a tapped downvote reach `suggestClarificationCategories`
 * through the same door for the same reason: asking someone whether they want
 * the thing they already told us they do not is the app not listening, and it
 * costs one of only four slots.
 */
export function dislikedCategories(
  preferences: StoredCategoryPreference[],
  currentSessionCount: number,
): AttractionCategory[] {
  return orderedByStrength(preferences, currentSessionCount, (weight) =>
    weight <= -MIN_CATEGORY_WEIGHT,
  );
}

/** Shared body of the two list reads: filter by sign, order by strength. */
function orderedByStrength(
  preferences: StoredCategoryPreference[],
  currentSessionCount: number,
  keep: (weight: number) => boolean,
): AttractionCategory[] {
  const weights = activeCategoryWeights(preferences, currentSessionCount);
  const lastSeen = new Map<AttractionCategory, number>();
  for (const preference of preferences) {
    lastSeen.set(
      preference.category,
      Math.max(lastSeen.get(preference.category) ?? 0, preference.lastSeenAt),
    );
  }

  return [...weights.entries()]
    .filter(([, weight]) => keep(weight))
    .sort(
      (a, b) =>
        Math.abs(b[1]) - Math.abs(a[1]) ||
        (lastSeen.get(b[0]) ?? 0) - (lastSeen.get(a[0]) ?? 0),
    )
    .map(([category]) => category);
}
