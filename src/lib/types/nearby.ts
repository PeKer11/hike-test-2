import type { Attraction } from "./walk-plan";

/**
 * How sure we are the place exists as described.
 * `registered`: a named feature someone mapped. `mapped-unnamed`: a mapped
 * feature with no name (a wood, a park polygon). `detected`: inferred from
 * imagery — reserved, nothing produces it yet. `crowd-signal`: many geotagged
 * photos but no listing; shown with a badge and a warning, never as "verified".
 */
export type PlaceVerification =
  | "registered"
  | "mapped-unnamed"
  | "crowd-signal"
  | "detected";

/** A place near the walker, from whichever provider found it. */
export interface NearbyPlace extends Attraction {
  source: "osm" | "wikipedia" | "commons" | "google" | "worldcover";
  verification: PlaceVerification;
  /** A thing to visit, or just something pleasant to walk past. */
  kind: "poi" | "scenery";
}

export type NearbyRequest =
  | { path: Array<{ lat: number; lng: number }>; radiusMeters?: number }
  | { point: { lat: number; lng: number }; radiusMeters?: number };
