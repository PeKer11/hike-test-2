/** Validation for "recommend this place" (docs/SOCIAL_PLAN_V2.md §2.1); the SQL twin is 20261023100000_place_recommendations.sql. */
import type { AttractionCategory } from "@/lib/types/walk-plan";

export const PLACE_TAGS = ["view", "shade", "quiet", "kids", "coffee", "food", "photo", "accessible", "sunset"] as const;
export type PlaceTag = (typeof PLACE_TAGS)[number];
export const MAX_TAGS = 3;

/** OSM ids and Google place ids only: never a name@coords key that could name a private place. */
const KEY_RE = /^(osm-(node|way|relation)-[0-9]{1,15}|google-[A-Za-z0-9_-]{10,200})$/;

const CATEGORIES: readonly AttractionCategory[] = ["landmark", "museum", "park", "food", "viewpoint", "religious", "shopping", "entertainment", "nature"];

export interface Recommendation {
  poiKey: string;
  category: AttractionCategory;
  tags: PlaceTag[];
  /** The place's public position and name, so it can be drawn on the map; absent when the client did not send them. */
  lat?: number;
  lng?: number;
  name?: string;
}

/** A well-formed recommendation from a request body, or null. Unknown tags are dropped, extras beyond three ignored. */
export function parseRecommendation(raw: unknown): Recommendation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.poiKey !== "string" || !KEY_RE.test(r.poiKey)) return null;
  if (!CATEGORIES.includes(r.category as AttractionCategory)) return null;
  const tags = Array.isArray(r.tags) ? [...new Set(r.tags.filter((t): t is PlaceTag => PLACE_TAGS.includes(t as PlaceTag)))].slice(0, MAX_TAGS) : [];
  const rec: Recommendation = { poiKey: r.poiKey, category: r.category as AttractionCategory, tags };
  if (typeof r.lat === "number" && typeof r.lng === "number" && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180) {
    rec.lat = Math.round(r.lat * 1e5) / 1e5;
    rec.lng = Math.round(r.lng * 1e5) / 1e5;
  }
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
  if (name) rec.name = name;
  return rec;
}

/** The map box a client asks for; null when it is malformed or larger than half a degree a side (the SQL caps it too). */
export function parseBbox(search: URLSearchParams): { south: number; west: number; north: number; east: number } | null {
  const [south, west, north, east] = ["south", "west", "north", "east"].map((k) => Number(search.get(k)));
  const box = { south, west, north, east };
  if (![south, west, north, east].every((n) => Number.isFinite(n))) return null;
  if (Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) return null;
  if (north <= south || east <= west || north - south > 0.5 || east - west > 0.5) return null;
  return box;
}

/** Same check for a bare key (DELETE). */
export function validPoiKey(key: unknown): key is string {
  return typeof key === "string" && KEY_RE.test(key);
}
