import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

// Same order of magnitude as the POI alert radius (120 m): once the walker has
// been this close to a stop on foot, they have seen it. Slightly tighter than the
// alert radius so a POI can be announced before it counts as done.
export const VISIT_RADIUS_METERS = 100;

/**
 * Tracks which attractions the walker has already reached during the current walk.
 *
 * The signal is plain proximity to the attraction, fed from the same GPS stream
 * as the POI alerter — no dwell time, because a walker who passed within 100 m of
 * a stop should not be routed back to it either way. State is a growing Set for
 * the whole walk (it survives automatic re-plans), so it is never recomputed from
 * the position history.
 */
export class VisitTracker {
  private readonly visited = new Set<string>();

  /**
   * Call on every accepted GPS fix. Returns the ids that became visited on this
   * fix (empty on most ticks).
   */
  recordPosition(position: Coordinates, attractions: Attraction[]): string[] {
    const newlyVisited: string[] = [];

    for (const attraction of attractions) {
      if (this.visited.has(attraction.id)) continue;
      if (haversineDistance(position, attraction.coordinates) <= VISIT_RADIUS_METERS) {
        this.visited.add(attraction.id);
        newlyVisited.push(attraction.id);
      }
    }

    return newlyVisited;
  }

  get visitedIds(): ReadonlySet<string> {
    return this.visited;
  }

  has(attractionId: string): boolean {
    return this.visited.has(attractionId);
  }

  /** Clears visited state — call when a new walk starts, not on a re-plan. */
  reset(): void {
    this.visited.clear();
  }
}

/** Drops already-visited entries from a list of attractions (or pinned ids). */
export function excludeVisited<T extends { id: string }>(
  items: T[],
  visitedIds: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !visitedIds.has(item.id));
}
