import "server-only";

import { nominatimBreaker } from "@/lib/api/nominatim-client";
import { appUserAgent } from "@/lib/api/http-identity";
import { clampBoundary, type Boundary } from "./loop-search";

/** The walkable town: municipal outlines are cut back to this radius around the town centre. */
const TOWN_RADIUS_M = 1500;

// The public instance allows ~1 request/s; caching per name keeps us far below it.
const cache = new Map<string, Boundary | null>();

/** Outline of a named town from Nominatim; null when it has no polygon or the lookup fails. Cached per name. */
export async function fetchTownBoundary(name: string): Promise<Boundary | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (nominatimBreaker.isOpen("nominatim")) return null;
  try {
    const params = new URLSearchParams({ q: name, format: "jsonv2", limit: "1", polygon_geojson: "1", polygon_threshold: "0.0003" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": appUserAgent(), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const hit = ((await res.json()) as Array<{ lat?: string; lon?: string; addresstype?: string; geojson?: { type: string; coordinates: number[][][] | number[][][][] } }>)[0];
    const geo = hit?.geojson;
    let boundary: Boundary | null = null;
    if (geo?.type === "Polygon") boundary = [(geo.coordinates as number[][][])[0]];
    else if (geo?.type === "MultiPolygon") boundary = (geo.coordinates as number[][][][]).map((p) => p[0]);
    // A city's outline is the city (Tel Aviv includes Jaffa and Ramat Aviv); only villages, towns and similar small places get cut back, because their municipal outline spans fields and neighbouring settlements.
    if (boundary && hit?.lat && hit?.lon && ["village", "town", "hamlet", "municipality", "suburb", "neighbourhood"].includes(hit.addresstype ?? "")) boundary = clampBoundary(boundary, { lat: Number(hit.lat), lng: Number(hit.lon) }, TOWN_RADIUS_M);
    cache.set(key, boundary);
    return boundary;
  } catch {
    return null;
  }
}
