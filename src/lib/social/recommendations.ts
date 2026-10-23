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
}

/** A well-formed recommendation from a request body, or null. Unknown tags are dropped, extras beyond three ignored. */
export function parseRecommendation(raw: unknown): Recommendation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.poiKey !== "string" || !KEY_RE.test(r.poiKey)) return null;
  if (!CATEGORIES.includes(r.category as AttractionCategory)) return null;
  const tags = Array.isArray(r.tags) ? [...new Set(r.tags.filter((t): t is PlaceTag => PLACE_TAGS.includes(t as PlaceTag)))].slice(0, MAX_TAGS) : [];
  return { poiKey: r.poiKey, category: r.category as AttractionCategory, tags };
}

/** Same check for a bare key (DELETE). */
export function validPoiKey(key: unknown): key is string {
  return typeof key === "string" && KEY_RE.test(key);
}
