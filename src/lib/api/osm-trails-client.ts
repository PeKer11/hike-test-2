import type { Coordinates, RtgTrail } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const DEFAULT_SEARCH_RADIUS_METERS = 10_000;
const TIMEOUT_MS = 25_000;

interface OverpassGeomPoint {
  lat: number;
  lon: number;
}

interface OverpassWayMember {
  type: "way";
  ref: number;
  role: string;
  geometry: OverpassGeomPoint[];
}

interface OverpassRelation {
  type: "relation";
  id: number;
  members: OverpassWayMember[];
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassRelation[];
}

function buildQuery(center: Coordinates, radiusMeters: number): string {
  const { lat, lng } = center;
  return `
[out:json][timeout:25];
relation["route"="hiking"](around:${radiusMeters},${lat},${lng});
out geom;
`.trim();
}

function assembleGeometry(members: OverpassWayMember[]): Coordinates[] {
  // Collect all points from all way members in order.
  // We do a simple chain-assembly: try to connect each way end-to-end.
  // If a way's start is close to the previous end, append it forward;
  // if its end is close, append it reversed.
  const SNAP_METERS = 50;

  const wayGeoms: Coordinates[][] = members
    .filter((m) => m.type === "way" && Array.isArray(m.geometry) && m.geometry.length >= 2)
    .map((m) => m.geometry.map((p) => ({ lat: p.lat, lng: p.lon })));

  if (wayGeoms.length === 0) return [];

  const result: Coordinates[] = [...wayGeoms[0]];

  for (let i = 1; i < wayGeoms.length; i++) {
    const way = wayGeoms[i];
    const lastPoint = result[result.length - 1];
    const wayStart = way[0];
    const wayEnd = way[way.length - 1];

    const distToStart = haversineDistance(lastPoint, wayStart);
    const distToEnd = haversineDistance(lastPoint, wayEnd);

    if (distToStart <= distToEnd || distToStart <= SNAP_METERS) {
      // Append forward, skip first point if it overlaps
      const skip = distToStart <= SNAP_METERS ? 1 : 0;
      result.push(...way.slice(skip));
    } else {
      // Append reversed
      const reversed = [...way].reverse();
      const skip = distToEnd <= SNAP_METERS ? 1 : 0;
      result.push(...reversed.slice(skip));
    }
  }

  return result;
}

function geometryLengthMeters(geometry: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineDistance(geometry[i - 1], geometry[i]);
  }
  return total;
}

function inferDifficulty(tags: Record<string, string>): string | undefined {
  const sac = tags["sac_scale"];
  if (!sac) return undefined;
  if (sac === "hiking") return "easy";
  if (sac === "mountain_hiking") return "moderate";
  if (sac === "demanding_mountain_hiking" || sac === "alpine_hiking") return "hard";
  return "moderate";
}

function inferRegion(tags: Record<string, string>, geometry: Coordinates[]): string {
  // Prefer OSM tags
  const area = tags["area"] ?? tags["region"] ?? tags["network"];
  if (area) return area;

  // Fall back to coordinate-based region (Israel-centric)
  const center = geometry[Math.floor(geometry.length / 2)];
  if (!center) return "Unknown";

  if (center.lat > 33.0) return "Upper Galilee";
  if (center.lat > 32.7) return "Lower Galilee";
  if (center.lat > 32.0) return "Carmel & Sharon";
  if (center.lat > 31.6 && center.lng > 35.05) return "Jerusalem Hills";
  if (center.lat > 31.2) return "Judean Foothills";
  if (center.lat < 30.5) return "Eilat & Arava";
  return "Negev";
}

function relationToTrail(rel: OverpassRelation): RtgTrail | null {
  const tags = rel.tags ?? {};
  const name =
    tags.name ?? tags["name:en"] ?? tags["name:he"] ?? tags["ref"];
  if (!name) return null;

  const geometry = assembleGeometry(rel.members);
  if (geometry.length < 3) return null;

  // Use OSM-reported distance if available, otherwise compute from geometry
  let lengthMeters: number;
  const osmDistance = tags.distance ?? tags.length;
  if (osmDistance) {
    const parsed = parseFloat(osmDistance);
    // OSM distance is usually in km
    lengthMeters = Number.isFinite(parsed) ? parsed * 1000 : geometryLengthMeters(geometry);
  } else {
    lengthMeters = geometryLengthMeters(geometry);
  }

  if (lengthMeters <= 0) return null;

  return {
    id: `osm-relation-${rel.id}`,
    name,
    region: inferRegion(tags, geometry),
    geometry,
    lengthMeters,
    difficulty: inferDifficulty(tags),
    source: "osm-hiking",
    dataVersion: new Date().toISOString().split("T")[0],
    lastUpdated: new Date().toISOString(),
    metadata: {
      osmId: rel.id,
      osmTags: tags,
    },
  };
}

export async function fetchOsmHikingTrails(
  center: Coordinates,
  radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS,
): Promise<RtgTrail[]> {
  const query = buildQuery(center, radiusMeters);
  const body = `data=${encodeURIComponent(query)}`;
  let lastError: Error = new Error("Overpass API unavailable.");

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        lastError = new Error(`Overpass error: ${response.status}`);
        continue;
      }

      const data = (await response.json()) as OverpassResponse;
      const trails: RtgTrail[] = [];
      const seenIds = new Set<string>();

      for (const el of data.elements) {
        if (el.type !== "relation") continue;
        const trail = relationToTrail(el);
        if (!trail) continue;
        if (seenIds.has(trail.id)) continue;
        seenIds.add(trail.id);
        trails.push(trail);
      }

      return trails;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Overpass request failed.");
    }
  }

  throw lastError;
}
