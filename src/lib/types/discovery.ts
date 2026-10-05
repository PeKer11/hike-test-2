import type { Attraction, Coordinates } from "@/lib/types";

/** How well we know a place is real (mirrors `PlaceVerification`). */
export type DiscoveryTier =
  | "registered"
  | "mapped-unnamed"
  | "crowd-signal"
  | "detected";

export type DiscoverySource =
  | "osm"
  | "wikidata"
  | "wikipedia"
  | "commons"
  | "worldcover"
  | "google";

export type DiscoveryState =
  | "new"
  | "announced"
  | "offered"
  | "dismissed"
  | "added"
  | "visited";

export type WalkEnvironment = "urban" | "park" | "rural";

export type CalloutLevel = "quiet" | "normal" | "chatty";

/** Where a place sits relative to the planned route. */
export interface RouteFrame {
  /** Metres along the route to the point nearest the place. */
  alongM: number;
  /** Cross-track metres; positive = right of travel, negative = left. */
  lateralM: number;
  side: "left" | "right" | "on";
  segIdx: number;
}

export interface DiscoveryItem {
  id: string;
  attraction: Attraction;
  kind: "poi" | "scenery";
  tier: DiscoveryTier;
  sources: DiscoverySource[];
  notable: boolean;
  photoCount?: number;
  score: number;
  frame: RouteFrame | null;
  /** Round-trip minutes to visit the place from the route. */
  detourMin: number;
  state: DiscoveryState;
}

export interface DiscoveryCollection {
  items: Map<string, DiscoveryItem>;
  /** Scanned polylines; a place beyond `ringRadiusM` of these is unknown. */
  coverage: Coordinates[][];
  ringRadiusM: number;
  routeVersion: number;
  scannedAtFixMs: number;
}
