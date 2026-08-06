import type { Attraction, AttractionCategory } from "@/lib/types";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

// Higher = more broadly interesting to most people
const CATEGORY_BASE_SCORE: Record<AttractionCategory, number> = {
  viewpoint: 10,
  landmark: 9,
  museum: 8,
  park: 7,
  nature: 7,
  religious: 6,
  entertainment: 6,
  food: 5,
  shopping: 4,
  other: 3,
};

// Bonus for tags that indicate well-known or notable places
function notabilityBonus(tags: Record<string, string>): number {
  let bonus = 0;
  if (tags.wikidata) bonus += 3;
  if (tags.wikipedia) bonus += 2;
  if (tags["heritage"]) bonus += 2;
  if (tags["star_rating"]) bonus += 1;
  return bonus;
}

/**
 * Share of walk plans that spend a stop on a kind of place the walker has NOT
 * told us they like. Preferences are otherwise self-reinforcing: a profile that
 * says "museums" would surface museums forever, and the app would never find out
 * whether the walker would have loved a viewpoint. Most walks are still built
 * purely on what they like — this is the "occasionally not" half.
 *
 * Exported so it can be tuned or A/B tested from one place.
 */
export const EXPLORATION_RATE = 0.15;

/**
 * At most this many exploration stops per plan. One: a 90-minute walk has a
 * handful of stops, and spending more than one of them on a guess turns the walk
 * the user asked for into a survey.
 */
export const MAX_EXPLORATION_PICKS = 1;

/**
 * Added for a category the walker's profile asks for.
 *
 * Flat, unlike both feedback-driven signals below, and the asymmetry is
 * deliberate — it is between kinds of evidence, not between liking and
 * disliking. `profiles.preferred_categories` is written by the free-text pass
 * off statements like "I love museums" — explicit, unambiguous language that is
 * already high confidence on its first occurrence, and there is nothing to
 * accumulate because the column is a plain array with no per-category history.
 * Post-walk feedback is the other kind of evidence: it arrives from taps at the
 * end of a walk, where one 👎 can mean the walker was tired, out of time or
 * unlucky with that one stop, and one 👍 can be one good stop. Repetition is
 * what turns either into a preference, so both feedback sides scale — see
 * `downvotePenalty` and `occurrencePreferenceBoost` below, and note that this
 * flat boost is added on top of the latter rather than replaced by it, because
 * "they said they love museums" and "they keep liking museums" are two separate
 * pieces of evidence. (An explicit *dislike* in text still removes the category
 * from `preferred_categories` outright and stays as categorical as it was.)
 */
export const PREFERRED_CATEGORY_BOOST = 4;

/**
 * Subtracted per recorded occurrence of a standing category-level downvote —
 * `attraction_feedback.occurrence_count`, the number of times in a row the
 * walker has voted the category down.
 *
 * Half the boost, so one downvote is a real but modest penalty: it is enough to
 * pull a disliked category below a neutral one it only narrowly beat, and not
 * enough to bury a category the walker may simply have caught on a bad day. Two
 * occurrences reach the old flat penalty of 4 and cancel a stated preference
 * exactly; past that a repeatedly disliked category is ranked below neutral
 * ones outright, which is the behaviour the flat penalty could never express.
 */
export const PER_OCCURRENCE_DOWNVOTE_PENALTY = 2;

/**
 * Ceiling on the scaled penalty, at twice the boost. Without it a walker who
 * votes one category down every walk eventually drives its score so far
 * negative that no notability bonus or short walking distance can ever surface
 * it again — the category is effectively deleted, which is a stronger claim
 * than a thumbs-down was ever asked to make. Eight is reached at four
 * occurrences and already outranks a stated preference two to one.
 */
export const MAX_DOWNVOTE_PENALTY = 8;

/**
 * What a standing downvote costs a candidate's score, given how many times it
 * has been recorded.
 *
 * Exported so the walk-plan path and tests can reason about the curve in one
 * place. A count at or below zero (a row that predates occurrence tracking, or
 * one read back as something unparseable) is treated as a single occurrence —
 * the row is standing, so it means at least that much.
 */
export function downvotePenalty(occurrenceCount: number): number {
  const occurrences = Number.isFinite(occurrenceCount)
    ? Math.max(1, Math.floor(occurrenceCount))
    : 1;

  return Math.min(
    MAX_DOWNVOTE_PENALTY,
    occurrences * PER_OCCURRENCE_DOWNVOTE_PENALTY,
  );
}

/**
 * Mirrors `PER_OCCURRENCE_DOWNVOTE_PENALTY`/`MAX_DOWNVOTE_PENALTY` for the
 * other direction: a standing category-level UPVOTE from post-walk feedback
 * (`attraction_feedback`, signal='upvote'). This is separate from
 * `PREFERRED_CATEGORY_BOOST` above, which stays flat on purpose — that boost is
 * explicit free-text evidence ("I love museums") with nothing to accumulate.
 * A repeated end-of-walk 👍 on a category is the same kind of evidence as a
 * repeated 👎: one thumbs-up can be one good stop, several is a preference, so
 * it scales the same way the downvote does.
 */
export const PER_OCCURRENCE_PREFERENCE_BOOST = 2;
export const MAX_OCCURRENCE_PREFERENCE_BOOST = 8;

/**
 * What a standing category-level upvote adds to a candidate's score, given how
 * many times it has been recorded. Same curve as `downvotePenalty`, added
 * rather than subtracted.
 */
export function occurrencePreferenceBoost(occurrenceCount: number): number {
  const occurrences = Number.isFinite(occurrenceCount)
    ? Math.max(1, Math.floor(occurrenceCount))
    : 1;

  return Math.min(
    MAX_OCCURRENCE_PREFERENCE_BOOST,
    occurrences * PER_OCCURRENCE_PREFERENCE_BOOST,
  );
}

export interface RankerOptions {
  origin: Coordinates;
  preferredCategories?: AttractionCategory[];
  /**
   * Categories carrying a standing category-level downvote, mapped to how many
   * times that downvote has been repeated. Penalized in the score in proportion
   * to that count, and barred from exploration however small the count is — a
   * downvote of any strength is an answer, not a question worth spending the
   * exploration slot on.
   */
  downvotedCategories?: ReadonlyMap<AttractionCategory, number>;
  /**
   * Categories carrying a standing category-level upvote from post-walk
   * feedback, mapped to how many times it has been repeated. Boosted in the
   * score in proportion to that count (`occurrencePreferenceBoost`), on top of
   * — not instead of — the flat `PREFERRED_CATEGORY_BOOST` a category gets from
   * `preferred_categories`. Also kept out of exploration, same reasoning as a
   * downvote: repeated behavioural evidence is an answer, not a question worth
   * spending the exploration slot on.
   */
  upvotedCategories?: ReadonlyMap<AttractionCategory, number>;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  /**
   * Let a plan occasionally lead with something outside the preferred
   * categories. Off by default: a ranking run for a stated need ("I also want to
   * eat") is a targeted search and must never wander off the category it was
   * asked for. The walk-plan builder turns it on.
   */
  allowExploration?: boolean;
  /**
   * Injected so a test can force the exploration roll either way. Ranking is
   * otherwise pure, and should stay reproducible under test.
   */
  random?: () => number;
}

type ScoredAttraction = Attraction & {
  distanceFromOriginMeters: number;
  score: number;
};

/**
 * Move the best-scoring off-preference candidates to the front of the ranking,
 * flagged as exploration picks. Front rather than "boosted by N points" because
 * the whole point is a guaranteed slot: a bonus big enough to matter for one POI
 * set is a rounding error in another.
 *
 * Only the ranking of DISCOVERED attractions is reordered. Places the walker
 * named and pins the planner must keep are handled by the caller, which puts
 * them ahead of this list and never lets it drop them — an exploration pick can
 * take a leftover slot, never someone else's.
 *
 * A downvoted category is never explored into. Exploration buys information
 * about a category we know nothing about; a downvote is not missing information,
 * it is the answer. Handing the walker a guaranteed slot for a kind of place
 * they have already told us they dislike spends the one exploration stop we
 * allow on a question that is closed, and reads as the app not listening.
 */
function withExplorationPick(
  ranked: ScoredAttraction[],
  preferredCategories: AttractionCategory[],
  downvotedCategories: ReadonlyMap<AttractionCategory, number>,
  upvotedCategories: ReadonlyMap<AttractionCategory, number>,
  random: () => number,
): ScoredAttraction[] {
  if (random() >= EXPLORATION_RATE) return ranked;

  const picks: ScoredAttraction[] = [];
  const rest: ScoredAttraction[] = [];

  for (const attraction of ranked) {
    if (
      picks.length < MAX_EXPLORATION_PICKS &&
      !preferredCategories.includes(attraction.category) &&
      !downvotedCategories.has(attraction.category) &&
      !upvotedCategories.has(attraction.category)
    ) {
      picks.push({ ...attraction, isExplorationPick: true });
    } else {
      rest.push(attraction);
    }
  }

  return picks.length === 0 ? ranked : [...picks, ...rest];
}

export function rankAttractions(
  attractions: Attraction[],
  options: RankerOptions,
): Attraction[] {
  const {
    origin,
    preferredCategories,
    downvotedCategories,
    upvotedCategories,
    availableMinutes,
    walkingPaceMinPerKm,
    allowExploration,
    random = Math.random,
  } = options;

  // Maximum walk distance that could fit in the available time (rough upper bound)
  const maxReachableMeters =
    (availableMinutes / walkingPaceMinPerKm) * 1000 * 0.5; // use half the time for walking

  const scored: ScoredAttraction[] = [];

  for (const a of attractions) {
    const distanceMeters = haversineDistance(origin, a.coordinates);

    if (distanceMeters > maxReachableMeters) continue;

    let score = CATEGORY_BASE_SCORE[a.category] ?? 3;
    score += notabilityBonus(a.tags);

    if (preferredCategories?.includes(a.category)) {
      score += PREFERRED_CATEGORY_BOOST;
    }
    const downvoteOccurrences = downvotedCategories?.get(a.category);
    if (downvoteOccurrences !== undefined) {
      score -= downvotePenalty(downvoteOccurrences);
    }
    const upvoteOccurrences = upvotedCategories?.get(a.category);
    if (upvoteOccurrences !== undefined) {
      score += occurrencePreferenceBoost(upvoteOccurrences);
    }

    score -= distanceMeters / 1000;

    scored.push({ ...a, distanceFromOriginMeters: distanceMeters, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Nothing to explore away from when no preference is known — the ranking is
  // already showing the walker whatever is best nearby.
  if (allowExploration && preferredCategories && preferredCategories.length > 0) {
    return withExplorationPick(
      scored,
      preferredCategories,
      downvotedCategories ?? new Map(),
      upvotedCategories ?? new Map(),
      random,
    );
  }

  return scored;
}

// Return the top N attractions that fit within the time budget
export function selectFeasibleAttractions(
  ranked: Attraction[],
  availableMinutes: number,
  walkingPaceMinPerKm: number,
  maxAttractions = 8,
): { selected: Attraction[]; dropped: Attraction[] } {
  const selected: Attraction[] = [];
  const dropped: Attraction[] = [];
  let usedMinutes = 0;

  for (const attraction of ranked) {
    if (selected.length >= maxAttractions) {
      dropped.push(attraction);
      continue;
    }

    // Rough walking time from previous stop (or origin) to this attraction
    // This is a heuristic — TSP planner will compute exact order + times later
    const walkingMinutes =
      ((attraction.distanceFromOriginMeters ?? 0) / 1000) * walkingPaceMinPerKm;

    const totalCost = walkingMinutes + attraction.avgVisitMinutes;

    if (usedMinutes + totalCost <= availableMinutes) {
      selected.push(attraction);
      usedMinutes += totalCost;
    } else {
      dropped.push(attraction);
    }
  }

  return { selected, dropped };
}
