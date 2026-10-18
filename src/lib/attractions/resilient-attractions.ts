import "server-only";

import { searchPlaces } from "@/lib/api/nominatim-client";
import { fetchAttractions } from "@/lib/attractions/overpass-client";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

// The public Overpass mirrors go down for hours. A walk should degrade, not
// fail: reuse the last good answer for the same area, and if there is none,
// build a thinner list from Nominatim.

const CACHE_MAX_ENTRIES = 50;
const cache = new Map<string, Attraction[]>();

const cacheKey = (center: Coordinates, radiusMeters: number) =>
  `${center.lat.toFixed(2)},${center.lng.toFixed(2)},${radiusMeters}`;

/** Nominatim search word and visit length for the few kinds worth one request each. */
const FALLBACK_KINDS: Array<{ category: AttractionCategory; query: string; minutes: number }> = [
  { category: "landmark", query: "monument", minutes: 20 },
  { category: "park", query: "park", minutes: 30 },
  { category: "food", query: "restaurant", minutes: 45 },
  { category: "viewpoint", query: "viewpoint", minutes: 15 },
];

const FALLBACK_SPACING_MS = 1_100;
const PER_KIND_LIMIT = 4;

async function fetchViaNominatim(center: Coordinates, radiusMeters: number): Promise<Attraction[]> {
  const found: Attraction[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < FALLBACK_KINDS.length; i++) {
    const { category, query, minutes } = FALLBACK_KINDS[i];
    try {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, FALLBACK_SPACING_MS));
      const results = await searchPlaces(query, 10, center);
      const nearby = results
        .map((r) => ({ r, coordinates: { lat: Number(r.lat), lng: Number(r.lon) } }))
        .filter(({ coordinates }) => Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng))
        .map((entry) => ({ ...entry, distance: haversineDistance(center, entry.coordinates) }))
        .filter(({ distance }) => distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, PER_KIND_LIMIT);

      for (const { r, coordinates, distance } of nearby) {
        if (seen.has(r.place_id)) continue;
        seen.add(r.place_id);
        found.push({
          id: `nominatim-${r.place_id}`,
          name: r.display_name.split(",")[0].trim(),
          coordinates,
          category,
          avgVisitMinutes: minutes,
          tags: { source: "nominatim-fallback" },
          distanceFromOriginMeters: Math.round(distance),
        });
      }
    } catch {
      // This kind contributes nothing.
    }
  }
  return found;
}

/**
 * `fetchAttractions` that survives Overpass being down: live result (and cache
 * it), else the last result for this area, else a thinner Nominatim list.
 * Throws the original Overpass error only when all three come up empty.
 */
export async function fetchAttractionsResilient(
  center: Coordinates,
  radiusMeters: number,
): Promise<Attraction[]> {
  const key = cacheKey(center, radiusMeters);
  try {
    const live = await fetchAttractions(center, radiusMeters);
    if (live.length > 0) {
      cache.delete(key);
      cache.set(key, live);
      if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    }
    return live;
  } catch (error) {
    const stale = cache.get(key);
    if (stale) return stale;
    const fallback = await fetchViaNominatim(center, radiusMeters);
    if (fallback.length > 0) return fallback;
    throw error;
  }
}
