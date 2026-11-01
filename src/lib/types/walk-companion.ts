import type { AttractionCategory, Coordinates } from "@/lib/types";

export interface WalkCompanionInput {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  /** Undefined when the walker left the end-distance field blank. */
  maxEndDistanceFromOriginMeters?: number;
  /**
   * Where the end-distance constraint is measured from, when that is no longer
   * `origin`. The form never sets it — a walk planned here starts where it is
   * anchored. A mid-walk rebuild does, because it moves `origin` to wherever
   * the walker has got to and the place they want to finish near has not moved.
   */
  endAnchor?: Coordinates;
  preferredCategories?: AttractionCategory[];
}
