import type { CalculatedRoute } from "./route";
import type { Coordinates } from "./waypoint";

export type TrailBriefingLevel = "go" | "caution" | "no-go";
export type TrailBriefingSourceStatus = "live" | "heuristic" | "unavailable";

export interface TrailBriefingSourceNote {
  source: string;
  status: TrailBriefingSourceStatus;
  summary: string;
}

export interface TrailBriefingItem {
  title: string;
  summary: string;
  details: string[];
  level?: TrailBriefingLevel;
  sourceStatus: TrailBriefingSourceStatus;
}

export interface TrailBriefingRecommendation {
  level: TrailBriefingLevel;
  title: string;
  summary: string;
  reasons: string[];
}

export interface TrailIntelligenceInput {
  route: CalculatedRoute;
  userLocation?: Coordinates;
  generatedAt?: string;
}

export interface TrailIntelligenceReport {
  generatedAt: string;
  regionLabel: string;
  routeSummary: TrailBriefingItem;
  bestTime: TrailBriefingItem;
  currentConditions: TrailBriefingItem;
  safety: TrailBriefingItem;
  recommendation: TrailBriefingRecommendation;
  sourceNotes: TrailBriefingSourceNote[];
}
