import type { Coordinates } from "@/lib/types";
import { bearingBetween, haversineDistance } from "@/lib/utils/geo";

export type Relation = "here" | "ahead" | "left" | "right" | "behind";

/** Closer than this is simply "here" whatever way the walker faces. */
const HERE_METERS = 25;
/** With no heading at all, only this close is it safe to say "here". */
const HERE_NO_HEADING_METERS = 60;
const AHEAD_HALF_ANGLE_DEG = 30;
const BEHIND_FROM_DEG = 150;

/** Signed bearing difference `to - from`, normalised to (-180, 180]. */
export function relativeBearing(fromDeg: number, toDeg: number): number {
  const rel = (((toDeg - fromDeg + 540) % 360) + 360) % 360 - 180;
  return rel === -180 ? 180 : rel;
}

/**
 * Where a place is relative to the walker. The reference direction is the
 * route's own direction when they are on it (steady), else their recent heading
 * (noisy); with neither, only "here" or "ahead" can be claimed honestly.
 */
export function relatePlace(
  pos: Coordinates,
  headingDeg: number | null,
  routeDirDeg: number | null,
  place: Coordinates,
): { relation: Relation; distanceM: number } {
  const distanceM = haversineDistance(pos, place);
  if (distanceM < HERE_METERS) return { relation: "here", distanceM };

  const reference = routeDirDeg ?? headingDeg;
  if (reference === null) {
    return {
      relation: distanceM < HERE_NO_HEADING_METERS ? "here" : "ahead",
      distanceM,
    };
  }

  const rel = relativeBearing(reference, bearingBetween(pos, place));
  let relation: Relation;
  if (Math.abs(rel) <= AHEAD_HALF_ANGLE_DEG) relation = "ahead";
  else if (rel > AHEAD_HALF_ANGLE_DEG && rel <= BEHIND_FROM_DEG) relation = "right";
  else if (rel < -AHEAD_HALF_ANGLE_DEG && rel >= -BEHIND_FROM_DEG) relation = "left";
  else relation = "behind";
  return { relation, distanceM };
}
