import type { Coordinates } from "@/lib/types";
import { closestPointOnSegment, haversineDistance } from "@/lib/utils/geo";

// Only flag deviation when user is this far off-route
const DEVIATION_THRESHOLD_METERS = 50;

export interface DeviationResult {
  deviationMeters: number;
  needsReroute: boolean;
  closestPointOnRoute: Coordinates;
  closestSegmentIndex: number;
}

/**
 * Given the user's current position and a route (array of coordinates),
 * return how far off-route the user is and whether re-routing is needed.
 */
export function detectDeviation(
  currentPosition: Coordinates,
  routeCoordinates: Coordinates[],
): DeviationResult {
  if (routeCoordinates.length < 2) {
    return {
      deviationMeters: 0,
      needsReroute: false,
      closestPointOnRoute: routeCoordinates[0] ?? currentPosition,
      closestSegmentIndex: 0,
    };
  }

  let minDist = Infinity;
  let closestPoint = routeCoordinates[0];
  let closestSegIdx = 0;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const candidate = closestPointOnSegment(
      currentPosition,
      routeCoordinates[i],
      routeCoordinates[i + 1],
    );
    const dist = haversineDistance(currentPosition, candidate);

    if (dist < minDist) {
      minDist = dist;
      closestPoint = candidate;
      closestSegIdx = i;
    }
  }

  return {
    deviationMeters: minDist,
    needsReroute: minDist > DEVIATION_THRESHOLD_METERS,
    closestPointOnRoute: closestPoint,
    closestSegmentIndex: closestSegIdx,
  };
}

/**
 * Given the segment index closest to the user, return the remaining
 * route coordinates from that point onward (used for re-routing).
 */
export function remainingRoute(
  routeCoordinates: Coordinates[],
  fromSegmentIndex: number,
  currentPosition: Coordinates,
): Coordinates[] {
  if (fromSegmentIndex >= routeCoordinates.length - 1) {
    return [currentPosition];
  }
  return [currentPosition, ...routeCoordinates.slice(fromSegmentIndex + 1)];
}
