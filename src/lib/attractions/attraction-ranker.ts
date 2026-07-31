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

export interface RankerOptions {
  origin: Coordinates;
  preferredCategories?: AttractionCategory[];
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
 */
function withExplorationPick(
  ranked: ScoredAttraction[],
  preferredCategories: AttractionCategory[],
  random: () => number,
): ScoredAttraction[] {
  if (random() >= EXPLORATION_RATE) return ranked;

  const picks: ScoredAttraction[] = [];
  const rest: ScoredAttraction[] = [];

  for (const attraction of ranked) {
    if (
      picks.length < MAX_EXPLORATION_PICKS &&
      !preferredCategories.includes(attraction.category)
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

    if (preferredCategories?.includes(a.category)) score += 4;

    score -= distanceMeters / 1000;

    scored.push({ ...a, distanceFromOriginMeters: distanceMeters, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Nothing to explore away from when no preference is known — the ranking is
  // already showing the walker whatever is best nearby.
  if (allowExploration && preferredCategories && preferredCategories.length > 0) {
    return withExplorationPick(scored, preferredCategories, random);
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
