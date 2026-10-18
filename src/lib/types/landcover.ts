import type { Coordinates } from "@/lib/types";

/** What a satellite land-cover component looks like. Never "a place". */
export type LandClass = "tree" | "water" | "grass";

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** One connected patch of a land-cover class (from ESA WorldCover 2021). */
export interface LandcoverComponent {
  cls: LandClass;
  areaM2: number;
  centroid: Coordinates;
  bbox: Bbox;
  /** Share of pixels with canopy height >= 3 m; null when not checked. */
  canopyShare: number | null;
}

/**
 * Why a detected card carries a warning. `private` is always present: a thing
 * that is not on the map may be private, fenced or closed.
 */
export type DetectedHazard =
  | "private"
  | "reserve"
  | "flood"
  | "fire"
  | "cliff"
  | "mixed-area";

export type DetectedDecision =
  | { action: "suppress"; reason: string }
  | { action: "merge"; reason: string }
  | { action: "show"; confidence: number; hazards: DetectedHazard[] };

/** A mapped OSM feature near a candidate, reduced to what the filter reads. */
export interface OsmFeature {
  tags: Record<string, string>;
  /** Ring (closed) or polyline (open). */
  geometry: Coordinates[];
  closed: boolean;
  /** Set only on raw parsed "area contains the patch centre" features: candidate index. */
  encloses?: number;
}

/** All OSM context the hazard filter needs; `null` upstream means "unknown". */
export interface HazardContext {
  features: OsmFeature[];
}

/** Credit shown whenever a satellite (detected) find is on the map. */
export const WORLDCOVER_ATTRIBUTION = "ESA WorldCover 2021 (CC BY 4.0)";
