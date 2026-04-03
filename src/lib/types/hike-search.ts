import type { CalculatedRoute } from "./route";
import type { Coordinates } from "./waypoint";

export type TrailSource = "rtg" | "fallback";

export interface RtgTrail {
  id: string;
  name: string;
  region: string;
  geometry: Coordinates[];
  lengthMeters: number;
  difficulty?: string;
  metadata?: Record<string, unknown>;
}

export interface HikeSearchRequest {
  origin: Coordinates;
  endpoint?: Coordinates;
  targetDistanceMeters?: number;
  preferences?: {
    maxDistanceMeters?: number;
    difficulty?: string;
  };
}

export interface HikeCandidate {
  trail: RtgTrail | null;
  source: TrailSource;
  geometry: Coordinates[];
  distanceMeters: number;
  score: number;
}

export interface HikeSearchResult {
  selected: HikeCandidate;
  route: CalculatedRoute;
  alternates?: HikeCandidate[];
  fallbackReason?: string;
}
