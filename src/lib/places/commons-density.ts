import "server-only";

import type { Coordinates } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import {
  COMMONS_CELL_M,
  COMMONS_CELL_MIN_FILES,
  COMMONS_LIMIT,
  COMMONS_MAX_CALLS,
  COMMONS_RADIUS_M,
  WIKI_TIMEOUT_MS,
  WIKI_USER_AGENT,
} from "@/lib/walk/discovery-cadence";
import { discoveryCopy } from "@/lib/walk/discovery-copy";

export interface CommonsFile {
  pageid: number;
  coordinates: Coordinates;
}

export interface PhotoCluster {
  coordinates: Coordinates;
  photoCount: number;
}

const M_PER_DEG = (Math.PI / 180) * 6_371_000;

/** Pure: ~50 m cells with at least 8 distinct geotagged files become clusters. */
export function binCommonsFiles(
  files: CommonsFile[],
  cellM = COMMONS_CELL_M,
  minFiles = COMMONS_CELL_MIN_FILES,
): PhotoCluster[] {
  const unique = new Map<number, CommonsFile>();
  for (const f of files) unique.set(f.pageid, f);

  const cells = new Map<string, Coordinates[]>();
  for (const { coordinates: c } of unique.values()) {
    const latStep = cellM / M_PER_DEG;
    const lngStep = cellM / (M_PER_DEG * Math.cos((c.lat * Math.PI) / 180));
    const key = `${Math.floor(c.lat / latStep)}:${Math.floor(c.lng / lngStep)}`;
    const list = cells.get(key) ?? [];
    list.push(c);
    cells.set(key, list);
  }

  const clusters: PhotoCluster[] = [];
  for (const list of cells.values()) {
    if (list.length < minFiles) continue;
    clusters.push({
      coordinates: {
        lat: list.reduce((s, p) => s + p.lat, 0) / list.length,
        lng: list.reduce((s, p) => s + p.lng, 0) / list.length,
      },
      photoCount: list.length,
    });
  }
  return clusters;
}

interface GeosearchHit {
  pageid?: number;
  lat?: number;
  lon?: number;
}

export function parseCommonsResponse(json: unknown): CommonsFile[] {
  const hits = (json as { query?: { geosearch?: GeosearchHit[] } })?.query
    ?.geosearch;
  if (!Array.isArray(hits)) return [];
  return hits.flatMap((h) =>
    h.pageid !== undefined &&
    typeof h.lat === "number" &&
    typeof h.lon === "number"
      ? [{ pageid: h.pageid, coordinates: { lat: h.lat, lng: h.lon } }]
      : [],
  );
}

/**
 * Where people photograph, from Wikimedia Commons geotag density. Only counts
 * coordinates; nothing from the files is displayed. At most 4 serial calls.
 */
export async function fetchPhotoClusters(
  points: Coordinates[],
): Promise<{ clusters: PhotoCluster[]; calls: number }> {
  const files: CommonsFile[] = [];
  let calls = 0;
  for (const p of points.slice(0, COMMONS_MAX_CALLS)) {
    calls += 1;
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "geosearch",
      gscoord: `${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`,
      gsradius: String(COMMONS_RADIUS_M),
      gslimit: String(COMMONS_LIMIT),
      gsnamespace: "6",
    });
    try {
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?${params}`,
        {
          headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
          cache: "no-store",
        },
      );
      if (response.ok) files.push(...parseCommonsResponse(await response.json()));
    } catch {
      // Crowd signal is a bonus; a failed call just means fewer candidates.
    }
  }
  return { clusters: binCommonsFiles(files), calls };
}

/** An unlisted photo hotspot: shown with a badge and a warning, never "verified". */
export function clusterToItem(cluster: PhotoCluster, index: number): DiscoveryItem {
  const id = `commons:${cluster.coordinates.lat.toFixed(4)},${cluster.coordinates.lng.toFixed(4)}:${index}`;
  return {
    id,
    attraction: {
      id,
      name: discoveryCopy.en["badge.crowd"],
      coordinates: cluster.coordinates,
      category: "other",
      avgVisitMinutes: 5,
      tags: {},
    },
    kind: "poi",
    tier: "crowd-signal",
    sources: ["commons"],
    notable: false,
    photoCount: cluster.photoCount,
    score: 0,
    frame: null,
    detourMin: 0,
    state: "new",
  };
}
