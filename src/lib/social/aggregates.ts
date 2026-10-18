/**
 * Pure rules for the community aggregates (plan §4.3). The database enforces
 * them (`20261012110000_social_aggregates.sql`); this file is their TypeScript
 * twin, used to validate what the RPCs return and pinned to the SQL by a test.
 * Nothing here ever sees a user id or a coordinate.
 */
import type { AttractionCategory } from "@/lib/types/walk-plan";

/** k-anonymity: distinct opted-in walkers needed before a place is reported. */
export const K_MIN = 5;
/** Votes and opt-ins younger than this do not count. */
export const DELAY_HOURS = 48;
export const DELAY_MS = DELAY_HOURS * 3_600_000;
/** S2: distinct similar walkers needed per place, and neighbours needed overall. */
export const SIMILAR_MIN_SUPPORTERS = 3;
export const SIMILAR_MIN_NEIGHBOURS = 5;
export const MAX_KEYS = 50;

export type SupportBucket = "5+" | "10+" | "25+";
export const SUPPORT_BUCKETS: readonly SupportBucket[] = ["5+", "10+", "25+"];

/** k-anonymity gate. */
export function meetsK(distinctUsers: number): boolean {
  return Number.isFinite(distinctUsers) && distinctUsers >= K_MIN;
}

/** The rounded label for a distinct-supporter count; null below k (not reported). */
export function bucketOf(distinctUsers: number): SupportBucket | null {
  if (!meetsK(distinctUsers)) return null;
  if (distinctUsers >= 25) return "25+";
  if (distinctUsers >= 10) return "10+";
  return "5+";
}

/** Whether a vote/opt-in made at `atMs` is old enough to count at `nowMs`. */
export function delayElapsed(atMs: number, nowMs: number): boolean {
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs)) return false;
  return atMs < nowMs - DELAY_MS;
}

/**
 * The app's own place id (`Attraction.id`, overpass-client.ts) is `osm-node-123`.
 * It is stored verbatim as `attraction_feedback.osm_id` (walk-feedback), and
 * `poi_key` is `coalesce(nullif(osm_id,''), ...)`, so this is exactly what the
 * SQL functions compare `poi_key` against. The `node/123` form never matches a row.
 */
const KEY_RE = /^osm-(node|way|relation)-[0-9]{1,15}$/;

/** OSM keys only (the only rows the database counts); at most `MAX_KEYS`, deduplicated. */
export function cleanPoiKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const k of raw) {
    if (typeof k === "string" && KEY_RE.test(k)) out.add(k);
    if (out.size >= MAX_KEYS) break;
  }
  return [...out];
}

const CATEGORIES: readonly AttractionCategory[] = [
  "landmark",
  "museum",
  "park",
  "food",
  "viewpoint",
  "religious",
  "shopping",
  "entertainment",
  "nature",
];

export interface CommunityAggregates {
  /** poi_key -> bucket (S1). */
  support: Record<string, SupportBucket>;
  /** poi_key -> 1..2 categories that make the walker similar to the supporters (S2). */
  similar: Record<string, AttractionCategory[]>;
}

export const EMPTY_AGGREGATES: CommunityAggregates = { support: {}, similar: {} };

/** Rows from `community_place_support`, keeping only well-formed ones for requested keys. */
export function sanitizeSupportRows(raw: unknown, requested: readonly string[]): Record<string, SupportBucket> {
  const out: Record<string, SupportBucket> = {};
  if (!Array.isArray(raw)) return out;
  const ok = new Set(requested);
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.poi_key !== "string" || !ok.has(r.poi_key)) continue;
    if (!SUPPORT_BUCKETS.includes(r.supporters_bucket as SupportBucket)) continue;
    out[r.poi_key] = r.supporters_bucket as SupportBucket;
  }
  return out;
}

/** Rows from `similar_walkers_places`. */
export function sanitizeSimilarRows(raw: unknown, requested: readonly string[]): Record<string, AttractionCategory[]> {
  const out: Record<string, AttractionCategory[]> = {};
  if (!Array.isArray(raw)) return out;
  const ok = new Set(requested);
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.poi_key !== "string" || !ok.has(r.poi_key)) continue;
    if (!Array.isArray(r.reason_categories)) continue;
    const cats = r.reason_categories
      .filter((c): c is AttractionCategory => CATEGORIES.includes(c as AttractionCategory))
      .slice(0, 2);
    if (cats.length > 0) out[r.poi_key] = cats;
  }
  return out;
}

// --- Fixed templates: no LLM, no user text, ever ----------------------------
export type SocialLang = "en" | "he";

const CATEGORY_NAME: Record<SocialLang, Record<AttractionCategory, string>> = {
  en: {
    landmark: "landmarks",
    museum: "museums",
    park: "parks",
    food: "food spots",
    viewpoint: "viewpoints",
    religious: "religious sites",
    shopping: "shopping",
    entertainment: "entertainment",
    nature: "nature",
    other: "places",
  },
  he: {
    landmark: "אתרי מורשת",
    museum: "מוזיאונים",
    park: "פארקים",
    food: "מקומות אוכל",
    viewpoint: "תצפיות",
    religious: "אתרי קודש",
    shopping: "קניות",
    entertainment: "בידור",
    nature: "טבע",
    other: "מקומות",
  },
};

/** "Recommended by walkers" / "מומלץ על ידי הולכים". Bucket shown as a rounded count. */
export function supportBadgeText(lang: SocialLang, bucket: SupportBucket): string {
  return lang === "he"
    ? `מומלץ על ידי הולכים (${bucket})`
    : `Recommended by walkers (${bucket})`;
}

/** "Walkers who also like parks and viewpoints liked this". */
export function similarBadgeText(lang: SocialLang, categories: readonly AttractionCategory[]): string {
  const names = categories.slice(0, 2).map((c) => CATEGORY_NAME[lang][c]);
  if (names.length === 0) return "";
  const list = names.join(lang === "he" ? " ו" : " and ");
  return lang === "he"
    ? `הולכים שגם אוהבים ${list} אהבו את זה`
    : `Walkers who also like ${list} liked this`;
}
