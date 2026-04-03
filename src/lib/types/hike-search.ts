import type { CalculatedRoute } from "./route";
import type { Coordinates } from "./waypoint";

export type TrailSource = "rtg" | "fallback";
export type TrailDataSource = "rtg-official" | "rtg-curated" | "fallback";

export interface RtgTrail {
  id: string;
  name: string;
  region: string;
  geometry: Coordinates[];
  lengthMeters: number;
  difficulty?: string;
  source: TrailDataSource;
  dataVersion: string;
  lastUpdated: string;
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
  routeApproximated: boolean;
}

export interface HikeSearchResult {
  selected: HikeCandidate;
  route: CalculatedRoute;
  alternates?: HikeCandidate[];
  fallbackReason?: string;
}
