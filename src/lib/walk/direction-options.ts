import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import { angleDifference, bearingBetween, haversineDistance } from "@/lib/utils/geo";
import {
  OPTIONS_CAME_FROM_HALF_DEG,
  OPTIONS_CAME_FROM_LOOKBACK_M,
  OPTIONS_MAX,
  OPTIONS_MAX_STOPS,
  OPTIONS_REACH_DETOUR,
  OPTIONS_ROUNDTRIP_FACTOR,
  OPTIONS_ROUNDTRIP_NEAR_ANCHOR_M,
  OPTIONS_SECTOR_COUNT,
  OPTIONS_SECTOR_DEG,
  OPTIONS_SHORT_FRACTION,
  OPTIONS_TOP_PER_SECTOR,
} from "./discovery-cadence";

export type OptionTheme = "nature" | "food" | "short";
export type OptionMode = "via" | "roundtrip" | "alternatives";

export interface DirectionOption {
  theme: OptionTheme;
  mode: OptionMode;
  stops: DiscoveryItem[];
  /** Sector 0-5 (60 degrees each from north); null for a route-engine fallback. */
  sector: number | null;
  /** Sum of the stops' scores; fallbacks score 0. */
  score: number;
  estMinutes: number;
  seed?: number;
  /** Target length for `roundtrip` mode. */
  roundTripLengthM?: number;
}

export interface DirectionInput {
  origin: Coordinates;
  /** Where the old plan was heading; null for an open-ended walk. */
  endAnchor: Coordinates | null;
  /** The walk's start, the "home" anchor when there is no end anchor. */
  startPoint?: Coordinates;
  /** Simplified walked track, oldest first; last point is the walker. */
  walked: Coordinates[];
  remainingMin: number;
  speedMpm: number;
  items: DiscoveryItem[];
  /** Ids never to offer: visited, dismissed, offered twice, behind the walker. */
  excludeIds: ReadonlySet<string>;
}

const NATURE_CATEGORIES: AttractionCategory[] = ["nature", "park", "viewpoint"];
const FOOD_CATEGORIES: AttractionCategory[] = [
  "food",
  "museum",
  "landmark",
  "religious",
];

export function sectorOf(bearingDeg: number): number {
  const b = ((bearingDeg % 360) + 360) % 360;
  return Math.floor(b / OPTIONS_SECTOR_DEG) % OPTIONS_SECTOR_COUNT;
}

export function sectorsAdjacent(a: number, b: number): boolean {
  const d = Math.abs(a - b) % OPTIONS_SECTOR_COUNT;
  return Math.min(d, OPTIONS_SECTOR_COUNT - d) <= 1;
}

/** Bearing from the walker to the track point ~300 m back, or null. */
export function cameFromBearing(
  origin: Coordinates,
  walked: Coordinates[],
): number | null {
  let back: Coordinates | null = null;
  for (let i = walked.length - 1; i >= 0; i -= 1) {
    back = walked[i];
    if (haversineDistance(origin, back) >= OPTIONS_CAME_FROM_LOOKBACK_M) break;
  }
  if (back === null || haversineDistance(origin, back) < 1) return null;
  return bearingBetween(origin, back);
}

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list];
  return list.flatMap((item, i) =>
    permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/** Best visiting order (brute force, <= 24 orders) and its walking minutes. */
function bestOrder(
  origin: Coordinates,
  stops: DiscoveryItem[],
  end: Coordinates | null,
  speedMpm: number,
): { order: DiscoveryItem[]; minutes: number } {
  const visit = stops.reduce((s, i) => s + i.attraction.avgVisitMinutes, 0);
  let best: { order: DiscoveryItem[]; minutes: number } | null = null;
  for (const order of permutations(stops)) {
    let metres = 0;
    let at = origin;
    for (const stop of order) {
      metres += haversineDistance(at, stop.attraction.coordinates);
      at = stop.attraction.coordinates;
    }
    if (end) metres += haversineDistance(at, end);
    const minutes = (metres * OPTIONS_REACH_DETOUR) / speedMpm + visit;
    if (best === null || minutes < best.minutes) best = { order, minutes };
  }
  return best ?? { order: [], minutes: 0 };
}

/** Add best-scoring stops while the whole trip still fits the time budget. */
function pickStops(
  origin: Coordinates,
  candidates: DiscoveryItem[],
  end: Coordinates | null,
  budgetMin: number,
  speedMpm: number,
): { stops: DiscoveryItem[]; minutes: number } {
  let chosen: DiscoveryItem[] = [];
  let minutes = end
    ? (haversineDistance(origin, end) * OPTIONS_REACH_DETOUR) / speedMpm
    : 0;
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  for (const item of ranked) {
    if (chosen.length >= OPTIONS_MAX_STOPS) break;
    const trial = bestOrder(origin, [...chosen, item], end, speedMpm);
    if (trial.minutes <= budgetMin) {
      chosen = trial.order;
      minutes = trial.minutes;
    }
  }
  return { stops: chosen, minutes };
}

function topSum(items: DiscoveryItem[]): number {
  return [...items]
    .sort((a, b) => b.score - a.score)
    .slice(0, OPTIONS_TOP_PER_SECTOR)
    .reduce((s, i) => s + i.score, 0);
}

/**
 * Up to three different ways to carry on from where the walker has ended up:
 * toward nature, toward food and sights, and a shorter way back. Stops come
 * from the discovery collection (no network); each theme takes its best
 * 60-degree sector, away from where the walker came from and from each other.
 * Route-engine fallbacks (round trip / alternatives) fill themes the
 * collection can't. Pure; the caller turns options into ORS routes.
 */
export function buildDirectionOptions(input: DirectionInput): DirectionOption[] {
  const { origin, endAnchor, walked, remainingMin, speedMpm, excludeIds } = input;
  if (remainingMin <= 0 || speedMpm <= 0) return [];

  const reachM = ((remainingMin / 2) * speedMpm) / OPTIONS_REACH_DETOUR;
  const cameFrom = cameFromBearing(origin, walked);
  const anchor = endAnchor ?? input.startPoint ?? null;
  const anchorBearing = anchor ? bearingBetween(origin, anchor) : null;
  // Don't send them back the way they came, unless that is also where home is.
  const blockCameFrom =
    cameFrom !== null &&
    !(
      endAnchor !== null &&
      angleDifference(cameFrom, bearingBetween(origin, endAnchor)) <=
        OPTIONS_CAME_FROM_HALF_DEG
    );

  const usable = input.items
    .filter(
      (i) =>
        !excludeIds.has(i.id) &&
        (i.state === "new" || i.state === "announced" || i.state === "offered") &&
        (i.tier === "registered" || i.tier === "mapped-unnamed"),
    )
    .map((item) => ({
      item,
      distM: haversineDistance(origin, item.attraction.coordinates),
      bearing: bearingBetween(origin, item.attraction.coordinates),
    }))
    .filter(
      ({ distM, bearing }) =>
        distM <= reachM &&
        !(
          blockCameFrom &&
          angleDifference(bearing, cameFrom as number) <= OPTIONS_CAME_FROM_HALF_DEG
        ),
    );

  const bySector = (match: (i: DiscoveryItem) => boolean) => {
    const sectors = new Map<number, DiscoveryItem[]>();
    for (const u of usable) {
      if (!match(u.item)) continue;
      const k = sectorOf(u.bearing);
      sectors.set(k, [...(sectors.get(k) ?? []), u.item]);
    }
    return sectors;
  };

  const out: DirectionOption[] = [];
  const takenSectors: number[] = [];

  // Shorter: toward home, within 60% of the remaining time.
  if (anchor !== null && anchorBearing !== null) {
    const shortSector = sectorOf(anchorBearing);
    const budget = remainingMin * OPTIONS_SHORT_FRACTION;
    const onTheWay = usable
      .filter(({ bearing }) => sectorOf(bearing) === shortSector)
      .map((u) => u.item);
    const { stops, minutes } = pickStops(origin, onTheWay, anchor, budget, speedMpm);
    const direct = (haversineDistance(origin, anchor) * OPTIONS_REACH_DETOUR) / speedMpm;
    if (direct <= budget || stops.length > 0) {
      out.push({
        theme: "short",
        mode: stops.length > 0 ? "via" : "alternatives",
        stops,
        sector: shortSector,
        score: stops.reduce((s, i) => s + i.score, 0),
        estMinutes: stops.length > 0 ? minutes : direct,
      });
      takenSectors.push(shortSector);
    }
  }

  const themes: Array<{ theme: OptionTheme; match: (i: DiscoveryItem) => boolean }> = [
    {
      theme: "nature",
      match: (i) =>
        i.kind === "scenery" || NATURE_CATEGORIES.includes(i.attraction.category),
    },
    { theme: "food", match: (i) => FOOD_CATEGORIES.includes(i.attraction.category) },
  ];
  const ranked = themes
    .map((t) => {
      const sectors = bySector(t.match);
      const scored = [...sectors.entries()]
        .map(([sector, items]) => ({ sector, items, score: topSum(items) }))
        .sort((a, b) => b.score - a.score);
      return { ...t, scored, best: scored[0]?.score ?? 0 };
    })
    .sort((a, b) => b.best - a.best);

  for (const t of ranked) {
    const free = t.scored.find(
      (s) => !takenSectors.some((taken) => sectorsAdjacent(taken, s.sector)),
    );
    // Adjacent sectors only when nothing else is left (unavoidable).
    const pick = free ?? t.scored.find((s) => !takenSectors.includes(s.sector));
    if (pick !== undefined) {
      const { stops, minutes } = pickStops(
        origin,
        pick.items,
        endAnchor,
        remainingMin,
        speedMpm,
      );
      if (stops.length > 0) {
        out.push({
          theme: t.theme,
          mode: "via",
          stops,
          sector: pick.sector,
          score: stops.reduce((s, i) => s + i.score, 0),
          estMinutes: minutes,
        });
        takenSectors.push(pick.sector);
        continue;
      }
    }
    if (
      t.theme === "nature" &&
      (endAnchor === null ||
        haversineDistance(origin, endAnchor) <= OPTIONS_ROUNDTRIP_NEAR_ANCHOR_M)
    ) {
      out.push({
        theme: "nature",
        mode: "roundtrip",
        stops: [],
        sector: null,
        score: 0,
        estMinutes: remainingMin * OPTIONS_ROUNDTRIP_FACTOR,
        seed: out.length,
        roundTripLengthM: remainingMin * speedMpm * OPTIONS_ROUNDTRIP_FACTOR,
      });
    }
  }

  const order: Record<OptionTheme, number> = { nature: 0, food: 1, short: 2 };
  return out.sort((a, b) => order[a.theme] - order[b.theme]).slice(0, OPTIONS_MAX);
}
