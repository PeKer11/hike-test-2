import { runOverpassQuery } from "@/lib/attractions/overpass-client";
import type { Coordinates } from "@/lib/types";

export interface ForbiddenWay {
  name: string;
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

/** A street name as an Overpass-QL regex literal. */
function nameRegex(names: string[]): string {
  return names
    .map((n) => n.trim().replace(/[.*+?^${}()|[\]\\"]/g, "\\$&"))
    .filter(Boolean)
    .join("|")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

export function parseForbiddenWays(elements: WayElement[], streets: string[]): ForbiddenWay[] {
  const wanted = streets.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out: ForbiddenWay[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const name = el.tags?.name ?? el.tags?.["name:en"] ?? "";
    const named = wanted.includes(name.toLowerCase()) || wanted.includes((el.tags?.["name:en"] ?? "").toLowerCase());
    out.push({
      name: name || el.tags?.highway || "unnamed road",
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
    parts.push(`way["highway"]["name"~"^(${re})$",i]${around};`, `way["highway"]["name:en"~"^(${re})$",i]${around};`);
  }
  if (opts.dangerous) parts.push(...DANGEROUS.map((q) => `${q}${around};`));
  if (parts.length === 0) return [];
  try {
    const elements = await runOverpassQuery(`[out:json][timeout:25];(${parts.join("")});out tags geom;`);
    return parseForbiddenWays(elements as unknown as WayElement[], streets);
  } catch {
    opts.onError?.(); // the caller must say the check did not happen
    return [];
  }
}
