import "server-only";

import { nominatimBreaker } from "@/lib/api/nominatim-client";
import { appUserAgent } from "@/lib/api/http-identity";
import type { Boundary } from "./loop-search";

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
    const geo = ((await res.json()) as Array<{ geojson?: { type: string; coordinates: number[][][] | number[][][][] } }>)[0]?.geojson;
    let boundary: Boundary | null = null;
    if (geo?.type === "Polygon") boundary = [(geo.coordinates as number[][][])[0]];
    else if (geo?.type === "MultiPolygon") boundary = (geo.coordinates as number[][][][]).map((p) => p[0]);
    cache.set(key, boundary);
    return boundary;
  } catch {
    return null;
  }
}
