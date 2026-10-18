import "server-only";

import type { NearbyProvider } from "@/lib/places/nearby-provider";
import { isRingNotable } from "@/lib/attractions/overpass-client";
import { distanceToPath } from "@/lib/places/path";
import { createSupabaseTileStore, scanWithTileCache } from "@/lib/places/osm-tile-scan";
import { clusterToItem, fetchPhotoClusters } from "@/lib/places/commons-density";
import { runDetectedScanCounted } from "@/lib/places/detected-scan";
import {
  fetchWikiPlaces,
  sampleScanPoints,
  wikiPlaceToItem,
} from "@/lib/places/wiki-geosearch";
import type { Coordinates, NearbyPlace } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import { MERGE_MATCH_M, WIKI_PLACE_MATCH_M } from "@/lib/walk/discovery-cadence";
import { haversineDistance } from "@/lib/utils/geo";

/** The scan, grouped by where each part came from. */
export interface DiscoveryScan {
  /** OSM, within the corridor radius of the path. */
  places: NearbyPlace[];
  /** OSM, notable subset between the corridor and the ring. */
  ring: NearbyPlace[];
  wikipedia: DiscoveryItem[];
  commons: DiscoveryItem[];
  /** Imagery finds (flag NEXT_PUBLIC_DETECTED_TIER=1; empty when off or on any failure). */
  detected: DiscoveryItem[];
  /** Upstream calls made, for the budget (1 Overpass, <=8 Wikipedia, <=4 Commons). */
  calls: { overpass: number; wikipedia: number; commons: number };
}

/**
 * One discovery pass over a path (or a point): a single Overpass union plus,
 * when `signals` is on, Wikipedia geosearch and Commons photo density in
 * parallel. Wikipedia and Commons failures only mean fewer candidates; an
 * Overpass failure is the scan's failure.
 *
 * "Is it registered?" for a photo hotspot: a listed OSM place within 50 m or a
 * Wikipedia page within 75 m means it is that place, not a new one. Imagery is
 * never proof, and the Nominatim check of the design is not built (see the
 * addendum cycle log).
 */
export async function runDiscoveryScan(
  provider: NearbyProvider,
  points: Coordinates[],
  radiusMeters: number,
  ringRadiusMeters: number,
  signals: boolean,
  options: { lang?: "en" | "he"; nowMs?: number } = {},
): Promise<DiscoveryScan> {
  const samples = signals ? sampleScanPoints(points) : [];
  // Shared tile cache (service role): any trouble means the plain scan.
  const tileStore = provider.fetchInBboxes
    ? await createSupabaseTileStore().catch(() => null)
    : null;
  const [osm, wiki, commons] = await Promise.allSettled([
    scanWithTileCache({
      points,
      radiusMeters,
      ringRadiusMeters,
      nowMs: options.nowMs ?? Date.now(),
      store: tileStore,
      fetchInBboxes: provider.fetchInBboxes?.bind(provider),
      fallback: () => provider.fetchScan(points, radiusMeters, ringRadiusMeters),
    }),
    signals ? fetchWikiPlaces(samples) : Promise.resolve({ places: [], calls: 0 }),
    signals ? fetchPhotoClusters(samples) : Promise.resolve({ clusters: [], calls: 0 }),
  ]);
  if (osm.status === "rejected") throw osm.reason;

  const all = osm.value;
  const places = all.filter((p) => distanceToPath(p.coordinates, points) <= radiusMeters + 50);
  const placeIds = new Set(places.map((p) => p.id));
  const ring = all.filter(
    (p) =>
      !placeIds.has(p.id) &&
      // A cached tile holds the whole corridor set: thin it to the plain ring's.
      (tileStore === null || isRingNotable(p.tags)) &&
      distanceToPath(p.coordinates, points) <= ringRadiusMeters + 50,
  );

  const wikiPlaces = wiki.status === "fulfilled" ? wiki.value.places : [];
  const wikipedia = wikiPlaces.map(wikiPlaceToItem);
  const clusters = commons.status === "fulfilled" ? commons.value.clusters : [];
  const commonsItems = clusters
    .filter(
      (c) =>
        !all.some((p) => haversineDistance(p.coordinates, c.coordinates) <= MERGE_MATCH_M) &&
        !wikiPlaces.some(
          (w) => haversineDistance(w.coordinates, c.coordinates) <= WIKI_PLACE_MATCH_M,
        ),
    )
    .map(clusterToItem);

  // Flag off: no calls. Any failure: no items (never throws, never blocks).
  const detectedRun = await runDetectedScanCounted(points, ringRadiusMeters, {
    wikiPlaces: wikiPlaces.map((w) => w.coordinates),
    photoClusters: clusters,
    lang: options.lang,
  });

  return {
    places,
    ring,
    wikipedia,
    commons: commonsItems,
    detected: detectedRun.items,
    calls: {
      overpass: 1 + detectedRun.overpassCalls,
      wikipedia: wiki.status === "fulfilled" ? wiki.value.calls : 0,
      commons: commons.status === "fulfilled" ? commons.value.calls : 0,
    },
  };
}
