import { runOverpassQuery } from "@/lib/attractions/overpass-client";
import type { Coordinates } from "@/lib/types";

export interface ForbiddenWay {
  name: string;
  /** Every spelling OSM has for the street (name, name:he, name:en). */
  names: string[];
  reason: "named" | "dangerous";
  path: Coordinates[];
}

interface WayElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

/** Fast roads, and slower ones with no sidewalk: the streets OSM itself marks as unsafe on foot. */
const DANGEROUS = [
  `way["highway"~"^(motorway|trunk|primary)(_link)?$"]`,
  `way["highway"~"^(secondary|tertiary)$"]["sidewalk"~"^(no|none)$"]`,
];

const MAX_WAYS = 400;

const STREET_WORDS = /^(רחוב|רח|שדרות|שד|דרך|street|st|road|rd|avenue|ave|boulevard|blvd)$/;

/**
 * What identifies a street once the word for "street", quotes and the leading ה of each word are dropped, so
 * "רחוב הנביאים", "הנביאים" and "HaNeviim St" can be compared. Hebrew and Latin spellings stay separate.
 */
export function streetCore(name: string): string {
  return name
    .toLowerCase()
    .replace(/['׳"״`.,-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STREET_WORDS.test(w))
    .map((w) => w.replace(/^ה(?=.{2,})/, ""))
    .join(" ");
}

/** True when OSM spelling `candidate` is (or contains) the street the walker named. */
export function matchesStreet(candidate: string, wanted: string): boolean {
  const core = streetCore(wanted);
  return core.length >= 2 && streetCore(candidate).includes(core);
}

// Overpass is a free shared server that is often at capacity: remember what it did answer.
const cache = new Map<string, ForbiddenWay[]>();

/** Street cores as an Overpass-QL regex literal (contains-match, so "נביאים" finds "הנביאים"). */
function nameRegex(streets: string[]): string {
  return streets
    .map(streetCore)
    .filter((c) => c.length >= 2)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&"))
    .join("|")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

export function parseForbiddenWays(elements: WayElement[], streets: string[]): ForbiddenWay[] {
  const out: ForbiddenWay[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const names = [el.tags?.name, el.tags?.["name:he"], el.tags?.["name:en"]].filter((n): n is string => Boolean(n));
    const named = streets.some((w) => names.some((n) => matchesStreet(n, w)));
    out.push({
      name: names[0] || el.tags?.highway || "unnamed road",
      names,
      reason: named ? "named" : "dangerous",
      path: el.geometry.map((g) => ({ lat: g.lat, lng: g.lon })),
    });
  }
  return out.slice(0, MAX_WAYS);
}

/**
 * Streets the walker does not want to walk along, around `center`: ones they
 * named, and (if asked) roads OSM tags as unsafe on foot. Empty on any failure,
 * so a lookup outage never blocks building a walk; `onError` tells the caller it failed.
 */
export async function fetchForbiddenWays(
  center: Coordinates,
  radiusM: number,
  opts: { streets?: string[]; dangerous?: boolean; onError?: () => void },
): Promise<ForbiddenWay[]> {
  const streets = (opts.streets ?? []).filter((s) => s.trim());
  const around = `(around:${Math.min(Math.max(Math.round(radiusM), 500), 8000)},${center.lat},${center.lng})`;
  const parts: string[] = [];
  if (streets.length) {
    const re = nameRegex(streets);
    if (re) parts.push(...["name", "name:he", "name:en"].map((k) => `way["highway"]["${k}"~"${re}",i]${around};`));
  }
  if (opts.dangerous) parts.push(...DANGEROUS.map((q) => `${q}${around};`));
  if (parts.length === 0) return [];
  const query = `[out:json][timeout:25];(${parts.join("")});out tags geom;`;
  const hit = cache.get(query);
  if (hit) return hit;
  try {
    const elements = await runOverpassQuery(query);
    const ways = parseForbiddenWays(elements as unknown as WayElement[], streets).filter((w) => w.reason === "named" || opts.dangerous);
    cache.set(query, ways);
    return ways;
  } catch {
    opts.onError?.(); // the caller must say the check did not happen
    return [];
  }
}
