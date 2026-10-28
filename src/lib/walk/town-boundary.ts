import "server-only";

import { nominatimBreaker } from "@/lib/api/nominatim-client";
import { appUserAgent } from "@/lib/api/http-identity";
import { clampBoundary, type Boundary } from "./loop-search";

/** The walkable town: municipal outlines are cut back to this radius around the town centre. */
const TOWN_RADIUS_M = 1500;

// The public instance allows ~1 request/s; caching per name keeps us far below it.
interface TownOutline {
  footprint: Boundary;
  routingBoundary: Boundary;
}
const cache = new Map<string, TownOutline | null>();

async function fetchTownOutline(name: string): Promise<TownOutline | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (nominatimBreaker.isOpen("nominatim")) return null;
  try {
    const params = new URLSearchParams({ q: name, format: "jsonv2", limit: "1", polygon_geojson: "1", polygon_threshold: "0.0003" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": appUserAgent(), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const hit = ((await res.json()) as Array<{ lat?: string; lon?: string; addresstype?: string; geojson?: { type: string; coordinates: number[][][] | number[][][][] } }>)[0];
    const geo = hit?.geojson;
    let boundary: Boundary | null = null;
    if (geo?.type === "Polygon") boundary = [(geo.coordinates as number[][][])[0]];
    else if (geo?.type === "MultiPolygon") boundary = (geo.coordinates as number[][][][]).map((p) => p[0]);
    if (!boundary?.length || boundary.some((ring) => ring.length < 4 || ring.some((point) => point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])))) {
      cache.set(key, null);
      return null;
    }
    // Keep the actual municipal outline for membership. The smaller routing/search heuristic must never
    // label a walker in another part of the same town as outside it (e.g. Binyamina–Giv'at Ada).
    let routingBoundary = boundary;
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && ["village", "town", "hamlet", "municipality", "suburb", "neighbourhood"].includes(hit?.addresstype ?? "")) routingBoundary = clampBoundary(boundary, { lat, lng }, TOWN_RADIUS_M);
    const outline = { footprint: boundary, routingBoundary };
    cache.set(key, outline);
    return outline;
  } catch {
    return null;
  }
}

/** Actual town/municipality footprint, without the routing-radius clamp. Null means membership is unknown. */
export async function fetchTownFootprint(name: string): Promise<Boundary | null> {
  return (await fetchTownOutline(name))?.footprint ?? null;
}

/** Outline used for route search; small towns are kept near their centre. Cached with the full footprint. */
export async function fetchTownBoundary(name: string): Promise<Boundary | null> {
  return (await fetchTownOutline(name))?.routingBoundary ?? null;
}
