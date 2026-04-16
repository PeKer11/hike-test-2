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

export interface RankerOptions {
  origin: Coordinates;
  preferredCategories?: AttractionCategory[];
  availableMinutes: number;
  walkingPaceMinPerKm: number;
}

export function rankAttractions(
  attractions: Attraction[],
  options: RankerOptions,
): Attraction[] {
  const { origin, preferredCategories, availableMinutes, walkingPaceMinPerKm } =
    options;

  // Maximum walk distance that could fit in the available time (rough upper bound)
  const maxReachableMeters =
    (availableMinutes / walkingPaceMinPerKm) * 1000 * 0.5; // use half the time for walking

  type ScoredAttraction = Attraction & {
    distanceFromOriginMeters: number;
    score: number;
  };

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
      (attraction.distanceFromOriginMeters ?? 0) / 1000 / walkingPaceMinPerKm;

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
