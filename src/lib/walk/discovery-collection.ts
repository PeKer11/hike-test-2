import type { AttractionCategory, Coordinates } from "@/lib/types";
import type {
  DiscoveryCollection,
  DiscoveryItem,
  DiscoveryState,
  DiscoveryTier,
} from "@/lib/types/discovery";
import { haversineDistance } from "@/lib/utils/geo";
import {
  COVER_MIN_FRACTION,
  COVER_RING_MARGIN_M,
  COVER_SAMPLE_M,
  DETOUR_FACTOR,
  DETOUR_MAX_MIN,
  DETOUR_MIN_MIN,
  DETOUR_SHARE,
  MERGE_MATCH_M,
  RING_RADIUS_M,
  SCORE_DETOUR_PENALTY_PER_MIN,
  SCORE_NOTABLE_BONUS,
  SCORE_PHOTO_CAP,
  SCORE_PHOTO_DIVISOR,
  SCORE_PREFERRED_BONUS,
  SCORE_TIER_WEIGHT,
} from "./discovery-cadence";
import { routeFrame } from "./route-frame";
import { distanceToPolylineM, samplePath } from "./route-overlap";

const TIER_RANK: Record<DiscoveryTier, number> = {
  detected: 0,
  "crowd-signal": 1,
  "mapped-unnamed": 2,
  registered: 3,
};

// "dismissed" outranks the soft states so a merge can never resurface it.
const STATE_RANK: Record<DiscoveryState, number> = {
  new: 0,
  offered: 1,
  announced: 2,
  dismissed: 3,
  added: 4,
  visited: 5,
};

export function emptyCollection(routeVersion = 0): DiscoveryCollection {
  return {
    items: new Map(),
    coverage: [],
    ringRadiusM: RING_RADIUS_M,
    routeVersion,
    scannedAtFixMs: 0,
  };
}

function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isUnverified(tier: DiscoveryTier): boolean {
  return tier === "crowd-signal" || tier === "detected";
}

/** The existing item an incoming one is the same place as, if any. */
function findMatch(
  items: Iterable<DiscoveryItem>,
  incoming: DiscoveryItem,
): DiscoveryItem | null {
  const qid = incoming.attraction.tags.wikidata;
  const name = normaliseName(incoming.attraction.name);
  let absorbedBy: DiscoveryItem | null = null;
  for (const existing of items) {
    if (existing.id === incoming.id) return existing;
    if (qid && existing.attraction.tags.wikidata === qid) return existing;
    const dist = haversineDistance(
      existing.attraction.coordinates,
      incoming.attraction.coordinates,
    );
    if (dist > MERGE_MATCH_M) continue;
    if (name !== "" && normaliseName(existing.attraction.name) === name) {
      return existing;
    }
    // A photo cluster or detection beside a listed place is that place.
    const eitherUnverified = isUnverified(existing.tier) !== isUnverified(incoming.tier);
    if (eitherUnverified && absorbedBy === null) absorbedBy = existing;
  }
  return absorbedBy;
}

function combine(existing: DiscoveryItem, incoming: DiscoveryItem): DiscoveryItem {
  const upgrade = TIER_RANK[incoming.tier] > TIER_RANK[existing.tier];
  const base = upgrade ? incoming : existing;
  const photoCounts = [existing.photoCount, incoming.photoCount].filter(
    (n): n is number => n !== undefined,
  );
  return {
    ...base,
    id: existing.id,
    attraction: { ...base.attraction, id: existing.attraction.id },
    tier: upgrade ? incoming.tier : existing.tier,
    sources: [...new Set([...existing.sources, ...incoming.sources])],
    notable: existing.notable || incoming.notable,
    photoCount: photoCounts.length ? Math.max(...photoCounts) : undefined,
    frame: incoming.frame ?? existing.frame,
    state:
      STATE_RANK[incoming.state] > STATE_RANK[existing.state]
        ? incoming.state
        : existing.state,
  };
}

/**
 * Fold freshly scanned items into the collection. Tier only upgrades, state
 * never regresses (so a dismissed place stays dismissed), and a crowd/detected
 * candidate within 50 m of a listed place is absorbed into it. Returns a new
 * collection; the input is not mutated.
 */
export function mergeItems(
  col: DiscoveryCollection,
  incoming: DiscoveryItem[],
): DiscoveryCollection {
  const items = new Map(col.items);
  for (const item of incoming) {
    const match = findMatch(items.values(), item);
    if (match === null) {
      items.set(item.id, item);
    } else {
      items.set(match.id, combine(match, item));
    }
  }
  return { ...col, items };
}

export function scoreItem(
  item: DiscoveryItem,
  preferred: AttractionCategory[] = [],
): number {
  const preferredBonus = preferred.includes(item.attraction.category)
    ? SCORE_PREFERRED_BONUS
    : 0;
  const notableBonus = item.notable ? SCORE_NOTABLE_BONUS : 0;
  const photoBonus = Math.min(
    SCORE_PHOTO_CAP,
    Math.log10(1 + (item.photoCount ?? 0)) / SCORE_PHOTO_DIVISOR,
  );
  return (
    SCORE_TIER_WEIGHT[item.tier] * (1 + preferredBonus + notableBonus + photoBonus) -
    SCORE_DETOUR_PENALTY_PER_MIN * item.detourMin
  );
}

/** Round-trip minutes to step `lateralM` off the route and back. */
export function detourMinutes(lateralM: number, speedMpm: number): number {
  if (speedMpm <= 0) return 0;
  return (2 * Math.abs(lateralM) * DETOUR_FACTOR) / speedMpm;
}

/** Whether a detour this long is worth offering with this much walk left. */
export function isDetourOfferable(
  detourMin: number,
  remainingWalkMin: number,
): boolean {
  return (
    detourMin <=
    Math.min(DETOUR_MAX_MIN, Math.max(DETOUR_MIN_MIN, DETOUR_SHARE * remainingWalkMin))
  );
}

/**
 * Recompute every item's route frame, detour cost and score against the
 * current route. Local only; run on each `routeVersion` change. (The base
 * spec's `remainingWalkMin` is not a parameter: it only matters to
 * `isDetourOfferable`, which callers apply at offer time.)
 */
export function reframe(
  col: DiscoveryCollection,
  geometry: Coordinates[],
  cumDist: number[],
  speedMpm: number,
  preferred: AttractionCategory[] = [],
  routeVersion: number = col.routeVersion + 1,
): DiscoveryCollection {
  const items = new Map<string, DiscoveryItem>();
  for (const item of col.items.values()) {
    const frame = routeFrame(item.attraction.coordinates, geometry, cumDist);
    const withFrame: DiscoveryItem = {
      ...item,
      frame,
      detourMin: frame ? detourMinutes(frame.lateralM, speedMpm) : 0,
    };
    items.set(item.id, { ...withFrame, score: scoreItem(withFrame, preferred) });
  }
  return { ...col, items, routeVersion };
}

/**
 * Whether `path` is already inside what was scanned: at least 90% of its 20 m
 * samples lie within (ring radius - 150 m) of a covered polyline.
 */
export function isCovered(
  col: DiscoveryCollection,
  path: Coordinates[],
): boolean {
  const samples = samplePath(path, COVER_SAMPLE_M);
  if (samples.length === 0) return true;
  if (col.coverage.length === 0) return false;
  const reach = col.ringRadiusM - COVER_RING_MARGIN_M;
  const covered = samples.filter((s) =>
    col.coverage.some((line) => distanceToPolylineM(s, line) <= reach),
  ).length;
  return covered / samples.length >= COVER_MIN_FRACTION;
}

/** Items within `radiusM` of `pos`, nearest first, skipping `exclude` ids. */
export function nearby(
  col: DiscoveryCollection,
  pos: Coordinates,
  radiusM: number,
  exclude: ReadonlySet<string> = new Set(),
): DiscoveryItem[] {
  return [...col.items.values()]
    .filter((i) => !exclude.has(i.id))
    .map((item) => ({ item, d: haversineDistance(pos, item.attraction.coordinates) }))
    .filter(({ d }) => d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .map(({ item }) => item);
}

/** Set one item's state; a no-op that never regresses it. */
export function markState(
  col: DiscoveryCollection,
  id: string,
  state: DiscoveryState,
): DiscoveryCollection {
  const item = col.items.get(id);
  if (!item || STATE_RANK[state] <= STATE_RANK[item.state]) return col;
  const items = new Map(col.items);
  items.set(id, { ...item, state });
  return { ...col, items };
}
