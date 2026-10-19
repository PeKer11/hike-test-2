import "server-only";

import {
  categoryOfGooglePlace,
  googlePlacesAvailable,
  searchNearbyAnyPlaces,
} from "@/lib/api/google-places-client";
import { simplifyPath } from "@/lib/places/path";
import type { Coordinates, NearbyPlace } from "@/lib/types";
import { visitMinutes } from "@/lib/assistant/state";

/** Search points along the route: a long walk gets a few, never one per GPS fix. */
const MAX_SEARCH_POINTS = 3;

/**
 * Google Places next to the OSM scan, for walkers who want more than OSM knows.
 * Never throws and never blocks: no key, cap reached or any failure is just
 * "no extra places". Results are returned to the caller only — they are not
 * written to the shared tile cache (Google data is never stored).
 */
export async function fetchGoogleNearby(
  points: Coordinates[],
  radiusMeters: number,
): Promise<NearbyPlace[]> {
  if (!googlePlacesAvailable() || points.length === 0) return [];
  const samples = points.length <= MAX_SEARCH_POINTS ? points : simplifyPath(points, MAX_SEARCH_POINTS);
  const results = await Promise.allSettled(samples.map((c) => searchNearbyAnyPlaces(c, radiusMeters)));
  const seen = new Set<string>();
  const out: NearbyPlace[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const g of r.value) {
      if (seen.has(g.placeId)) continue;
      seen.add(g.placeId);
      const category = categoryOfGooglePlace(g);
      out.push({
        id: `google-${g.placeId}`,
        name: g.name,
        coordinates: g.coordinates,
        category,
        avgVisitMinutes: visitMinutes(category),
        tags: { name: g.name, ...(g.primaryType ? { googleType: g.primaryType } : {}) },
        source: "google",
        verification: "registered",
        kind: "poi",
      });
    }
  }
  return out;
}
