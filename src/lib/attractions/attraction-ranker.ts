import { poiIdentityKeys } from "@/lib/preferences/poi-key";
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
 * Added for a category THIS walk asked for — a chip ticked on the form, or a
 * need read out of the prompt ("I also want to eat something").
 *
 * Flat, and now that is the whole of what it means. Until 2026-08-23 this same
 * constant also carried the walker's standing tastes, read as flat membership of
 * `profiles.preferred_categories`; that half has moved to
 * `preferredCategoryWeights` and a decayed curve, because a taste has a history
 * and an age and this does not. A request for a category on the walk being
 * planned right now is as fresh as evidence gets and has nothing to accumulate
 * or to fade — it is answered by the walk it arrived on.
 *
 * Still 4, and still the same 4 as `CATEGORY_BOOST_PER_OCCURRENCE`'s base over
 * in `preference-extractor.ts`, so a taste stated for the first time today is
 * worth exactly what asking for it today is worth. The two are kept as separate
 * constants rather than one shared one because they answer different questions
 * and should stay free to diverge.
 *
 * Post-walk feedback is the third kind of evidence: it arrives from taps at the
 * end of a walk, where one 👎 can mean the walker was tired, out of time or
 * unlucky with that one stop, and one 👍 can be one good stop. Repetition is
 * what turns either into a preference, so both feedback sides scale — see
 * `downvotePenalty` and `occurrencePreferenceBoost` below.
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

/**
 * How many stops one walk gets, unless a caller asks for fewer. Exported so a
 * caller that pre-spends part of the walk on stops this function never sees
 * (the walk-plan route's named places) can subtract from the same number.
 */
export const MAX_WALK_STOPS = 8;

/**
 * How much harder the notability signal counts when the walker asked for famous
 * places. Four, so a place carrying both wikidata and wikipedia goes from +5 to
 * +20 — decisively past the widest category-base gap (10) and past the
 * kilometre-scale distance term, which is what it takes to actually reorder a
 * list rather than nudge it. Notability is untouched at ×1 otherwise.
 */
export const NOTABLE_ONLY_MULTIPLIER = 4;

export interface RankerOptions {
  origin: Coordinates;
  /**
   * Categories THIS walk asked for — form chips, or a need read out of the
   * prompt. Worth a flat `PREFERRED_CATEGORY_BOOST` each, and never explored
   * away from: the walker has just said what they want.
   */
  preferredCategories?: AttractionCategory[];
  /**
   * The walker's standing tastes, mapped to what each is worth right now —
   * `activeCategoryWeights` in `preference-extractor.ts`, which is a function of
   * how often the taste has been stated and how long ago it was last stated.
   *
   * A map rather than a list because that is the fix: as a list this was flat
   * membership, so a category mentioned once a year ago boosted as hard as one
   * confirmed on five walks last month, and — worse — could never be explored
   * into again. Categories whose weight has decayed below
   * `MIN_CATEGORY_WEIGHT` are absent from the map entirely, which is what makes
   * them explorable again rather than permanently excluded.
   *
   * Combined with `preferredCategories` by taking the larger of the two rather
   * than adding them: "they asked for museums today" and "they like museums" are
   * the same claim arriving twice, unlike the feedback signals below, which are
   * a different kind of evidence and do stack.
   */
  preferredCategoryWeights?: ReadonlyMap<AttractionCategory, number>;
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
   * — not instead of — whatever the category is already worth as a stated taste
   * or as a request for this walk: a tap at the end of a walk is behavioural
   * evidence and a sentence is stated evidence, and those do stack where the
   * two stated forms do not. Also kept out of exploration, same reasoning as a
   * downvote: repeated behavioural evidence is an answer, not a question worth
   * spending the exploration slot on.
   */
  upvotedCategories?: ReadonlyMap<AttractionCategory, number>;
  /**
   * `poi_key` identities of specific places the walker has voted down. Dropped
   * from the ranking outright rather than penalized: a category downvote means
   * "less of this kind of place" and is a matter of degree, but a POI downvote
   * names one place and means "not that one again", and any penalty leaves a
   * notable enough place able to out-score its way back onto the walk.
   *
   * Only discovered candidates pass through here. A place the walker names
   * themselves reaches the planner through `explicitAttractions` and is never
   * ranked, which is the right asymmetry — asking for somewhere by name today
   * outranks having disliked it once.
   */
  downvotedPoiKeys?: ReadonlySet<string>;
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
   * The walker asked for famous places, not just places ("bring me 3 famous
   * places in Tel Aviv"). Weights the notability signal this function already
   * computes — wikidata, wikipedia, heritage, star rating — rather than adding
   * a "famous" category: notability cuts across every category, and a place is
   * a museum whether or not anybody has heard of it.
   *
   * Emphasis, not a filter. A neighbourhood where nothing carries a wikidata
   * tag still produces a walk, ranked exactly as it would have been; filtering
   * would hand back an empty plan for a request that was perfectly reasonable.
   */
  notableOnly?: boolean;
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
 *
 * `exploited` is every category that counts as answered right now: asked for on
 * this walk, or a standing taste still above `MIN_CATEGORY_WEIGHT`. Until
 * 2026-08-23 the standing half was raw membership of the monotonic
 * `preferred_categories` array, and that is what starved exploration — a walker
 * twenty prompts in had six categories permanently barred from the exploration
 * slot for having been mentioned once, and there was no way back out of the
 * array short of an explicit dislike. A taste that has decayed under the
 * threshold is a question again, so it becomes eligible again.
 */
function withExplorationPick(
  ranked: ScoredAttraction[],
  exploited: ReadonlySet<AttractionCategory>,
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
      !exploited.has(attraction.category) &&
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
    preferredCategoryWeights,
    downvotedCategories,
    upvotedCategories,
    downvotedPoiKeys,
    availableMinutes,
    walkingPaceMinPerKm,
    allowExploration,
    notableOnly,
    random = Math.random,
  } = options;

  // Maximum walk distance that could fit in the available time (rough upper bound)
  const maxReachableMeters =
    (availableMinutes / walkingPaceMinPerKm) * 1000 * 0.5; // use half the time for walking

  const scored: ScoredAttraction[] = [];

  for (const a of attractions) {
    if (downvotedPoiKeys && downvotedPoiKeys.size > 0) {
      const keys = poiIdentityKeys({
        osmId: a.id,
        name: a.name,
        lat: a.coordinates.lat,
        lng: a.coordinates.lng,
      });
      if (keys.some((key) => downvotedPoiKeys.has(key))) continue;
    }

    const distanceMeters = haversineDistance(origin, a.coordinates);

    if (distanceMeters > maxReachableMeters) continue;

    let score = CATEGORY_BASE_SCORE[a.category] ?? 3;
    // Folded into `score` rather than applied as a separate sort key, because
    // `selectFeasibleAttractions` re-sorts the remaining candidates by score
    // after every accepted stop — a comparator here would be undone one stop in.
    score +=
      notabilityBonus(a.tags) * (notableOnly ? NOTABLE_ONLY_MULTIPLIER : 1);

    // The larger of the two, not the sum — see `preferredCategoryWeights`.
    score += Math.max(
      preferredCategories?.includes(a.category) ? PREFERRED_CATEGORY_BOOST : 0,
      preferredCategoryWeights?.get(a.category) ?? 0,
    );
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
  // already showing the walker whatever is best nearby. A profile whose every
  // taste has decayed under the threshold reaches this the same way a brand new
  // one does, which is right: we no longer know what they like.
  const exploited = new Set<AttractionCategory>([
    ...(preferredCategories ?? []),
    ...(preferredCategoryWeights?.keys() ?? []),
  ]);

  if (allowExploration && exploited.size > 0) {
    return withExplorationPick(
      scored,
      exploited,
      downvotedCategories ?? new Map(),
      upvotedCategories ?? new Map(),
      random,
    );
  }

  return scored;
}

/**
 * Straight-line metres a walker standing at `from` has to cover to reach this
 * candidate. `from` is undefined only before the first stop is accepted, when
 * the walker is still at the origin — and the origin distance is already baked
 * into the candidate by `rankAttractions`, so there is nothing to recompute yet.
 */
function stepDistanceMeters(
  candidate: Attraction,
  from: Coordinates | undefined,
): number {
  if (!from) return candidate.distanceFromOriginMeters ?? 0;
  return haversineDistance(from, candidate.coordinates);
}

/**
 * `rankAttractions` bakes a `- distanceFromOrigin/1000` term into `score`. Once
 * the walker has moved, that term is about a place they are no longer standing
 * at, so it is added back out and replaced with the distance from where they
 * actually are. Everything else in the score (category, notability, standing
 * preferences) is position-independent and survives untouched.
 *
 * A candidate with no `score` (an explicitly named stop threaded straight
 * through by the walk-plan route, never run through the ranker) scores 0 before
 * the distance term, which leaves the remaining list sorted purely by
 * proximity — the best available answer when there is no relevance signal.
 */
function scoreFrom(candidate: Attraction, from: Coordinates | undefined): number {
  const positionFree =
    (candidate.score ?? 0) + (candidate.distanceFromOriginMeters ?? 0) / 1000;

  return positionFree - stepDistanceMeters(candidate, from) / 1000;
}

/**
 * Return the top N attractions that fit within the time budget.
 *
 * Greedy, but re-evaluated against the route as it grows: after each accepted
 * stop every remaining candidate is re-costed and re-sorted by its distance
 * from that stop rather than from the origin. Costing every candidate off a
 * frozen origin distance (as this did until 2026-08-06) both dropped stops that
 * were a two-minute walk from the previous one — because they happened to sit
 * far from the start — and accepted ones that looked cheap from the origin but
 * sat on the opposite side of it from where the walk had actually reached.
 * Nothing downstream rescued those: `tsp-planner.ts`'s reinsertion pass only
 * reorders what this step already selected.
 *
 * Still haversine, still a heuristic. The real walking-network distances come
 * from the ORS matrix in `tsp-planner.ts`'s ordering step, which runs after
 * this one — a network call per candidate per accepted stop here would be
 * quadratic against a rate-limited API to sharpen a pre-filter.
 */
export function selectFeasibleAttractions(
  ranked: Attraction[],
  availableMinutes: number,
  walkingPaceMinPerKm: number,
  maxAttractions = MAX_WALK_STOPS,
): { selected: Attraction[]; dropped: Attraction[] } {
  const selected: Attraction[] = [];
  const dropped: Attraction[] = [];
  let usedMinutes = 0;
  // Where the walk has reached. Undefined until the first stop is accepted.
  let lastStop: Coordinates | undefined;

  let remaining = [...ranked];

  while (remaining.length > 0) {
    if (selected.length >= maxAttractions) {
      dropped.push(...remaining);
      break;
    }

    const candidate = remaining.shift() as Attraction;

    const walkingMinutes =
      (stepDistanceMeters(candidate, lastStop) / 1000) * walkingPaceMinPerKm;
    const totalCost = walkingMinutes + candidate.avgVisitMinutes;

    if (usedMinutes + totalCost <= availableMinutes) {
      selected.push(candidate);
      usedMinutes += totalCost;
      lastStop = candidate.coordinates;
      // Only an acceptance moves the walker, so only an acceptance can change
      // the order of what is left. A rejection leaves the sort still valid.
      remaining = [...remaining].sort(
        (a, b) => scoreFrom(b, lastStop) - scoreFrom(a, lastStop),
      );
    } else {
      dropped.push(candidate);
    }
  }

  return { selected, dropped };
}
