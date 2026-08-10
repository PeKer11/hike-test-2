import type { Coordinates } from "@/lib/types";
import { closestPointOnSegment, haversineDistance } from "@/lib/utils/geo";

// Only flag deviation when user is this far off-route
const DEVIATION_THRESHOLD_METERS = 50;

/**
 * How far either side of the walker's last known segment the closest-segment
 * search is allowed to look.
 *
 * A global search over the whole route is wrong for a walk that loops, runs an
 * out-and-back leg, or passes down a parallel street: an off-route offset large
 * enough to matter (the re-route threshold is 50 m) is easily enough to make
 * some route-order-distant segment measure nearer than the one the walker is
 * actually on. The index then flips tick to tick, and since it feeds
 * `remainingRoute` the map polyline is rebuilt from a different part of the
 * route each second — the reported back-and-forth flicker.
 *
 * Forward is the generous side: it has to absorb a GPS gap, a throttled tick,
 * and dense city geometry where consecutive points are only metres apart.
 * Backward is deliberately smaller but non-zero — a walker who takes a wrong
 * turn and retraces a few metres is doing something real, and a strictly
 * forward-only search would refuse to follow them back.
 *
 * These are segment counts rather than metres because the invariant that
 * matters is route *order*: whatever the geometry's point spacing, a bounded
 * index window cannot jump to the far side of a loop.
 */
const SEARCH_WINDOW_FORWARD_SEGMENTS = 50;
const SEARCH_WINDOW_BACKWARD_SEGMENTS = 15;

export interface DeviationResult {
  deviationMeters: number;
  needsReroute: boolean;
  closestPointOnRoute: Coordinates;
  closestSegmentIndex: number;
}

/**
 * Given the user's current position and a route (array of coordinates),
 * return how far off-route the user is and whether re-routing is needed.
 *
 * Pass `previousSegmentIndex` — the `closestSegmentIndex` this returned for the
 * previous fix on *this same route* — to constrain the search to a window
 * around it. Omit it (or pass null) on the first fix of a walk, and after a
 * re-plan hands over new geometry: an index from the old route says nothing
 * about the new one, so that case falls back to a global search for one tick
 * and constrains itself from there. An out-of-range index is treated the same
 * way rather than trusted.
 */
export function detectDeviation(
  currentPosition: Coordinates,
  routeCoordinates: Coordinates[],
  previousSegmentIndex?: number | null,
): DeviationResult {
  if (routeCoordinates.length < 2) {
    return {
      deviationMeters: 0,
      needsReroute: false,
      closestPointOnRoute: routeCoordinates[0] ?? currentPosition,
      closestSegmentIndex: 0,
    };
  }

  const lastSegmentIndex = routeCoordinates.length - 2;
  const anchored =
    typeof previousSegmentIndex === "number" &&
    Number.isInteger(previousSegmentIndex) &&
    previousSegmentIndex >= 0 &&
    previousSegmentIndex <= lastSegmentIndex;

  const from = anchored
    ? Math.max(0, previousSegmentIndex! - SEARCH_WINDOW_BACKWARD_SEGMENTS)
    : 0;
  const to = anchored
    ? Math.min(lastSegmentIndex, previousSegmentIndex! + SEARCH_WINDOW_FORWARD_SEGMENTS)
    : lastSegmentIndex;

  let minDist = Infinity;
  let closestPoint = routeCoordinates[from];
  let closestSegIdx = from;

  for (let i = from; i <= to; i++) {
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
