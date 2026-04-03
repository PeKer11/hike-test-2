import type { Coordinates, Waypoint } from "./waypoint";
import type { TrailSource } from "./hike-search";

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteSegment {
  from: Waypoint;
  to: Waypoint;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Coordinates[];
  steps: RouteStep[];
}

export interface CalculatedRoute {
  orderedWaypoints: Waypoint[];
  segments: RouteSegment[];
  geometry: Coordinates[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  warnings: string[];
  source?: TrailSource;
  sourceLabel?: string;
}
