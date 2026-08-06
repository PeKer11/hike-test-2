import type { Coordinates } from "./waypoint";

export type AttractionCategory =
  | "landmark"
  | "museum"
  | "park"
  | "food"
  | "viewpoint"
  | "religious"
  | "shopping"
  | "entertainment"
  | "nature"
  | "other";

export interface Attraction {
  id: string;
  name: string;
  coordinates: Coordinates;
  category: AttractionCategory;
  avgVisitMinutes: number;
  tags: Record<string, string>;
  distanceFromOriginMeters?: number;
  score?: number;
  // Set by the ranker when this stop was included DESPITE not matching the
  // walker's preferences, to learn something new about them. Post-walk feedback
  // on such a stop is a real new signal, not a confirmation of what we assumed.
  isExplorationPick?: boolean;
}

export interface WalkPlanRequest {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  preferredCategories?: AttractionCategory[];
  explicitAttractions?: Attraction[];
  // Attractions the user pinned as "must keep". Never dropped by the planner,
  // even when they push the plan over the time budget (`feasible` goes false instead).
  pinnedAttractionIds?: string[];
  /**
   * How far from the start the walk is allowed to *finish*, straight-line —
   * "don't strand me from my car/hotel". Distinct from `radiusMeters`, which
   * only bounds where candidate attractions are looked for: a walk built
   * entirely from POIs within 2 km of the origin can still end 2 km away on
   * the far side of it. Undefined means no constraint, which is the behaviour
   * every caller had before this existed.
   */
  maxEndDistanceFromOriginMeters?: number;
}

export interface WalkSegment {
  from: Attraction | { name: "origin"; coordinates: Coordinates };
  to: Attraction;
  distanceMeters: number;
  walkingMinutes: number;
}

export interface WalkPlan {
  orderedAttractions: Attraction[];
  segments: WalkSegment[];
  totalDistanceMeters: number;
  totalMinutes: number;
  feasible: boolean;
  droppedAttractions: Attraction[];
  geometry?: Coordinates[];
  warnings?: string[];
}
