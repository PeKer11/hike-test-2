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
}

export interface WalkPlanRequest {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  preferredCategories?: AttractionCategory[];
  explicitAttractions?: Attraction[];
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
}
