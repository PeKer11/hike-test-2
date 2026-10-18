import { amenityKindOfTags } from "@/lib/attractions/amenity-tags";
import { isDaytime } from "@/lib/places/detected-classifier";
import { simplifyPath } from "@/lib/places/path";
import {
  interactionSuppression,
  type InteractionRow,
} from "@/lib/preferences/companion-memory";
import { poiIdentityKeys } from "@/lib/preferences/poi-key";
import type {
  Attraction,
  AttractionCategory,
  Coordinates,
  NearbyPlace,
} from "@/lib/types";
import type {
  CalloutLevel,
  DiscoveryCollection,
  DiscoveryItem,
  DiscoveryState,
  DiscoveryTier,
  RouteFrame,
  WalkEnvironment,
} from "@/lib/types/discovery";
import { haversineDistance } from "@/lib/utils/geo";
import {
  COVER_RING_MARGIN_M,
  COVER_SAMPLE_M,
  LEVELS,
  pointScanDistanceM,
  RING_RADIUS_M,
} from "./discovery-cadence";
import {
  eligibleForCallout,
  frameRelation,
  isNearTurn,
  type AnnouncementRecord,
  type CalloutContext,
} from "./callout-gate";
import {
  emptyCollection,
  isCovered,
  markState,
  mergeItems,
  nearby,
  reframe,
  scoreItem,
} from "./discovery-collection";
import type { Relation } from "./poi-relation";
import { classifyEnvironment, routeFrame } from "./route-frame";
import { distanceToPolylineM, samplePath } from "./route-overlap";
import {
  NEARBY_CORRIDOR_RADIUS_M,
  NEARBY_PATH_MAX_POINTS,
  NEARBY_POINT_CACHE_MS,
  NEARBY_POINT_CELL_DEG,
  NEARBY_POINT_MIN_GAP_MS,
  NEARBY_POINT_RADIUS_M,
} from "./walk-cadence";
import { cumulativeDistances } from "./walk-stats";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** OSM and Wikipedia items are trusted for an hour, then the path is scanned again. */
export const DISCOVERY_TTL_MS = 60 * 60_000;
/** A "While you're here" line needs a place at least this good. */
export const WHILE_HERE_MIN_SCORE = 1;
export const WHILE_HERE_RADIUS_M = 200;
const MAX_HISTORY = 50;

/** Shape of `/api/nearby` when it is asked for a discovery scan. */
interface ScanResponse {
  places?: NearbyPlace[];
  ring?: NearbyPlace[];
  wikipedia?: DiscoveryItem[];
  commons?: DiscoveryItem[];
  /** Imagery finds; only present when the server's flag is on. */
  detected?: DiscoveryItem[];
}

/** The client half of the detected-tier flag (inlined at build; default OFF). */
export function detectedTierEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DETECTED_TIER === "1";
}

/**
 * Detected finds the client will keep: only with the flag on, only items that
 * really are detected-tier, and not after dark at the find (the server already
 * checked, but the response may have been cached for hours).
 */
export function acceptDetected(
  items: DiscoveryItem[] | undefined,
  nowMs: number,
  enabled: boolean = detectedTierEnabled(),
): DiscoveryItem[] {
  if (!enabled || !Array.isArray(items)) return [];
  const when = new Date(nowMs);
  return items.filter(
    (i) =>
      i.tier === "detected" &&
      Number.isFinite(i.attraction?.coordinates?.lat) &&
      Number.isFinite(i.attraction?.coordinates?.lng) &&
      isDaytime(when, i.attraction.coordinates),
  );
}

const TIER_OF: Record<NearbyPlace["verification"], DiscoveryTier> = {
  registered: "registered",
  "mapped-unnamed": "mapped-unnamed",
  "crowd-signal": "crowd-signal",
  detected: "detected",
};

function isNotableTags(tags: Record<string, string>): boolean {
  return Boolean(
    tags.wikidata ||
      tags.wikipedia ||
      tags.historic ||
      tags.tourism === "attraction" ||
      tags.tourism === "viewpoint" ||
      tags.tourism === "museum",
  );
}

/** A mapped place as a (not yet framed) collection item. */
export function placeToItem(place: NearbyPlace): DiscoveryItem {
  const { source, verification, kind, ...attraction } = place;
  return {
    id: place.id,
    attraction,
    kind,
    tier: TIER_OF[verification],
    sources: [source === "worldcover" || source === "google" ? "osm" : source],
    notable: isNotableTags(place.tags),
    score: 0,
    frame: null,
    detourMin: 0,
    state: "new",
  };
}

const VERIFICATION_OF: Record<DiscoveryTier, NearbyPlace["verification"]> = {
  registered: "registered",
  "mapped-unnamed": "mapped-unnamed",
  "crowd-signal": "crowd-signal",
  detected: "detected",
};

/** What `PoiAnnouncer` / `PoiCallouts` take. */
export function itemToPlace(item: DiscoveryItem): NearbyPlace {
  const source = item.sources.includes("osm")
    ? "osm"
    : item.sources.includes("commons")
      ? "commons"
      : item.sources.includes("worldcover")
        ? "worldcover"
        : "wikipedia";
  return {
    ...item.attraction,
    source,
    verification: VERIFICATION_OF[item.tier],
    kind: item.kind,
  };
}

/** The stretch of `path` no scan covers yet (first to last uncovered sample). */
export function uncoveredSubPath(
  col: DiscoveryCollection,
  path: Coordinates[],
): Coordinates[] {
  const samples = samplePath(path, COVER_SAMPLE_M);
  const reach = col.ringRadiusM - COVER_RING_MARGIN_M;
  const uncovered = samples
    .map((s, i) =>
      col.coverage.some((line) => distanceToPolylineM(s, line) <= reach) ? -1 : i,
    )
    .filter((i) => i >= 0);
  if (uncovered.length === 0) return [];
  const first = uncovered[0];
  const last = uncovered[uncovered.length - 1];
  const sub = samples.slice(first, last + 1);
  if (sub.length >= 2) return sub;
  const neighbour = samples[last + 1] ?? samples[first - 1] ?? path[path.length - 1];
  return [samples[first], neighbour];
}

/**
 * The walk's Discovery Collection and the only thing that decides when to ask
 * the server for more. A scan is one `/api/nearby` request (Overpass union,
 * Wikipedia and Commons merged server-side), made:
 *   - for a path no earlier scan covers (plan start, full rebuild, collapse);
 *   - for the uncovered stretch only when a rejoin splice leaves the old cover;
 *   - around the walker when they are far outside everything scanned, at most
 *     once per 2 min and once per ~200 m cell per 10 min.
 * Never once per GPS fix: everything per fix (`eligible`, `relationOf`) is local.
 *
 * Time arguments are fix timestamps, not the wall clock.
 */
export class DiscoveryLoader {
  private col: DiscoveryCollection = emptyCollection();
  private geometry: Coordinates[] = [];
  private cumDist: number[] = [];
  private speedMpm = 1000 / 15;
  private preferred: AttractionCategory[] = [];
  private env: WalkEnvironment = "urban";
  private history: AnnouncementRecord[] = [];
  private readonly offered = new Map<string, number>();
  private readonly cellFetchedAt = new Map<string, number>();
  private lastPointScanAt = Number.NEGATIVE_INFINITY;
  private pointScanInFlight = false;
  /** Water / toilets near the route: for the companion, never announced. */
  private amenityPlaces = new Map<string, NearbyPlace>();
  /** Standing memory: poi keys this walker already visited / dismissed (see `interactionSuppression`). */
  private memory: { rows: InteractionRow[]; session: number } | null = null;
  private lang: "en" | "he" = "en";
  /** Bumped by `reset` so a scan still in flight cannot refill a finished walk. */
  private generation = 0;

  constructor(private readonly doFetch: FetchLike = (input, init) => fetch(input, init)) {}

  get collection(): DiscoveryCollection {
    return this.col;
  }

  items(): DiscoveryItem[] {
    return [...this.col.items.values()];
  }

  get environment(): WalkEnvironment {
    return this.env;
  }

  /** Language of server-made names (detected patches). */
  setLang(lang: "en" | "he"): void {
    this.lang = lang;
  }

  /**
   * Seed memory (`interactionSuppression`): places this walker already visited
   * or dismissed start dismissed, so they are not announced again. Applied to
   * what is collected and to every later scan.
   */
  setMemory(rows: InteractionRow[], session: number): void {
    this.memory = { rows, session };
    this.applySuppression();
  }

  /** Enough declined detours on file that no detour is offered right now. */
  get detourOffersBlocked(): boolean {
    return this.memory
      ? interactionSuppression(this.memory.rows, this.memory.session).detourOffersBlocked
      : false;
  }

  /** Amenities (water, toilets) collected so far. */
  amenities(): NearbyPlace[] {
    return [...this.amenityPlaces.values()];
  }

  /** A new route is in force: every item gets a new frame, detour and score. */
  setRoute(
    geometry: Coordinates[],
    speedMpm: number,
    preferred: AttractionCategory[] = [],
  ): void {
    this.geometry = geometry;
    this.cumDist = cumulativeDistances(geometry);
    this.speedMpm = speedMpm > 0 ? speedMpm : this.speedMpm;
    this.preferred = preferred;
    this.apply(this.col.routeVersion + 1);
  }

  /** Plan stops are collection members (registered, notable) so they are framed and ranked. */
  addPlanStops(attractions: Attraction[]): void {
    const items: DiscoveryItem[] = attractions.map((attraction) => ({
      id: attraction.id,
      attraction,
      kind: "poi",
      tier: "registered",
      sources: ["osm"],
      notable: true,
      score: 0,
      frame: null,
      detourMin: 0,
      state: "new",
    }));
    this.col = mergeItems(this.col, items);
    this.apply(this.col.routeVersion);
  }

  /**
   * Scan `path` unless it is already covered. Returns whether a request was
   * made. A stale collection (older than an hour) is scanned again in full.
   */
  async ensureCovered(path: Coordinates[], nowFixMs: number): Promise<boolean> {
    if (path.length < 2) return false;
    const stale =
      this.col.scannedAtFixMs !== 0 &&
      nowFixMs - this.col.scannedAtFixMs > DISCOVERY_TTL_MS;
    if (!stale && isCovered(this.col, path)) return false;
    const target = stale ? path : uncoveredSubPath(this.col, path);
    if (target.length < 2) return false;
    const simplified = simplifyPath(target, NEARBY_PATH_MAX_POINTS);
    await this.scan({ path: simplified, radiusMeters: NEARBY_CORRIDOR_RADIUS_M }, simplified, nowFixMs);
    return true;
  }

  /** Scan around the walker when they are well outside everything scanned. */
  async maybeScanAround(
    position: Coordinates,
    nowFixMs: number,
    speedMps?: number,
  ): Promise<void> {
    if (this.pointScanInFlight) return;
    // 450 m on foot; a runner or cyclist is "outside" only after ~5 min of travel.
    const reach = pointScanDistanceM(speedMps ?? Number.NaN);
    const outside = this.col.coverage.every(
      (line) => distanceToPolylineM(position, line) > reach,
    );
    if (this.col.coverage.length > 0 && !outside) return;
    if (nowFixMs - this.lastPointScanAt < NEARBY_POINT_MIN_GAP_MS) return;
    const cell = `${Math.round(position.lat / NEARBY_POINT_CELL_DEG)},${Math.round(
      position.lng / NEARBY_POINT_CELL_DEG,
    )}`;
    const at = this.cellFetchedAt.get(cell);
    if (at !== undefined && nowFixMs - at < NEARBY_POINT_CACHE_MS) return;

    this.cellFetchedAt.set(cell, nowFixMs);
    this.lastPointScanAt = nowFixMs;
    this.pointScanInFlight = true;
    try {
      await this.scan(
        { point: position, radiusMeters: NEARBY_POINT_RADIUS_M },
        // A point's coverage: a short stub, so `isCovered` / the ring test see it.
        [position, { lat: position.lat + 1e-6, lng: position.lng }],
        nowFixMs,
      );
    } finally {
      this.pointScanInFlight = false;
    }
  }

  // --- local, per-fix ------------------------------------------------------

  /** Distance along the current route of a matched point. */
  alongM(segmentIndex: number, point: Coordinates): number {
    if (this.geometry.length < 2) return 0;
    const i = Math.min(Math.max(segmentIndex, 0), this.geometry.length - 2);
    return this.cumDist[i] + haversineDistance(this.geometry[i], point);
  }

  /** Where a point sits against the current route (null when no route or far past its ends). */
  frameOf(point: Coordinates): RouteFrame | null {
    return routeFrame(point, this.geometry, this.cumDist);
  }

  isNearTurn(alongM: number): boolean {
    return isNearTurn(this.geometry, this.cumDist, alongM);
  }

  /** Items worth announcing right now (see `eligibleForCallout`). */
  eligible(args: {
    alongM: number;
    speedMps: number;
    level: CalloutLevel;
    nowFixMs: number;
    ctx: Omit<CalloutContext, "history">;
  }): DiscoveryItem[] {
    return eligibleForCallout(
      this.col,
      args.alongM,
      args.speedMps,
      this.env,
      args.level,
      { ...args.ctx, history: this.history },
      args.nowFixMs,
    );
  }

  /** Cross-track relation of a place to a walker at `alongM` / `pos`. */
  relationOf(
    id: string,
    alongM: number,
    pos: Coordinates,
  ): { relation: Relation; distanceM: number } | null {
    const item = this.col.items.get(id);
    if (!item?.frame) return null;
    const distanceM = haversineDistance(pos, item.attraction.coordinates);
    return { relation: frameRelation(item.frame, alongM, distanceM), distanceM };
  }

  /** Places an off-route walker may be told about (relatePlace with a heading). */
  offRoutePlaces(level: CalloutLevel): NearbyPlace[] {
    const tiers = LEVELS[level].tiers;
    return this.items()
      .filter((i) => i.state === "new" && tiers.includes(i.tier))
      .map(itemToPlace);
  }

  /** The one "While you're here" place for the off-route card, if any. */
  whileHere(pos: Coordinates): { item: DiscoveryItem; distanceM: number } | null {
    let best: { item: DiscoveryItem; distanceM: number; score: number } | null = null;
    for (const item of nearby(this.col, pos, WHILE_HERE_RADIUS_M)) {
      if (item.tier !== "registered") continue;
      if (item.state === "dismissed" || item.state === "visited" || item.state === "added") {
        continue;
      }
      // Standing next to it: the old route's detour cost is beside the point.
      const score = scoreItem({ ...item, detourMin: 0 }, this.preferred);
      if (score < WHILE_HERE_MIN_SCORE) continue;
      if (best === null || score > best.score) {
        best = { item, score, distanceM: haversineDistance(pos, item.attraction.coordinates) };
      }
    }
    return best;
  }

  // --- state ---------------------------------------------------------------

  setState(id: string, state: DiscoveryState): void {
    this.col = markState(this.col, id, state);
  }

  /** An announced place is spent for this walk and counts against the level's budgets. */
  recordAnnounced(id: string, nowFixMs: number): void {
    const item = this.col.items.get(id);
    this.col = markState(this.col, id, "announced");
    if (!item) return;
    this.history = [
      ...this.history,
      { atMs: nowFixMs, category: item.attraction.category, tier: item.tier },
    ].slice(-MAX_HISTORY);
  }

  /** Items shown as direction options: offered once more (twice and they stop coming back). */
  markOffered(ids: string[]): void {
    for (const id of ids) {
      this.offered.set(id, (this.offered.get(id) ?? 0) + 1);
      this.col = markState(this.col, id, "offered");
    }
  }

  /** Ids no direction option may use: offered twice already. */
  offeredTwice(): Set<string> {
    return new Set([...this.offered].filter(([, n]) => n >= 2).map(([id]) => id));
  }

  reset(): void {
    this.generation += 1;
    this.col = emptyCollection();
    this.geometry = [];
    this.cumDist = [];
    this.history = [];
    this.offered.clear();
    this.cellFetchedAt.clear();
    this.amenityPlaces.clear();
    this.lastPointScanAt = Number.NEGATIVE_INFINITY;
    this.pointScanInFlight = false;
  }

  // --- internals -----------------------------------------------------------

  private applySuppression(): void {
    if (!this.memory || this.memory.rows.length === 0) return;
    const keysOf = (item: DiscoveryItem): string[] => {
      const { id, name, coordinates } = item.attraction;
      return poiIdentityKeys({
        osmId: id.startsWith("osm-") ? id : null,
        name,
        lat: coordinates.lat,
        lng: coordinates.lng,
      }).filter((k) => k !== "");
    };
    const items = [...this.col.items.values()];
    // A notable place may be announced again even if visited long ago.
    const notableKeys = new Set(items.filter((i) => i.notable).flatMap(keysOf));
    const { suppressedKeys } = interactionSuppression(
      this.memory.rows,
      this.memory.session,
      notableKeys,
    );
    for (const item of items) {
      if (item.state !== "new" || item.tier === "detected") continue;
      if (keysOf(item).some((k) => suppressedKeys.has(k))) {
        this.col = markState(this.col, item.id, "dismissed");
      }
    }
  }

  private apply(routeVersion: number): void {
    if (this.geometry.length < 2) return;
    this.col = reframe(
      this.col,
      this.geometry,
      this.cumDist,
      this.speedMpm,
      this.preferred,
      routeVersion,
    );
    const routeKm = this.cumDist[this.cumDist.length - 1] / 1000;
    const corridor = this.items().filter(
      (i) => i.frame !== null && Math.abs(i.frame.lateralM) <= NEARBY_CORRIDOR_RADIUS_M,
    );
    this.env = classifyEnvironment(corridor, routeKm, this.geometry[0]);
  }

  private async scan(
    body: Record<string, unknown>,
    coverage: Coordinates[],
    nowFixMs: number,
  ): Promise<void> {
    const generation = this.generation;
    // Marked before the request, like the corridor of old: a failure is retried
    // on the next new geometry, not on every fix. Removed again if it fails.
    this.col = {
      ...this.col,
      coverage: [...this.col.coverage, coverage],
      ringRadiusM: RING_RADIUS_M,
      scannedAtFixMs: nowFixMs,
    };
    const forget = () => {
      if (generation !== this.generation) return;
      this.col = {
        ...this.col,
        coverage: this.col.coverage.filter((line) => line !== coverage),
      };
    };
    try {
      const res = await this.doFetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          ringRadiusMeters: RING_RADIUS_M,
          signals: true,
          lang: this.lang,
        }),
      });
      if (!res.ok) {
        forget();
        return;
      }
      const data = (await res.json()) as ScanResponse;
      if (generation !== this.generation) return;
      const mapped = [...(data.places ?? []), ...(data.ring ?? [])];
      // Amenities are for the companion; they never become callout candidates.
      for (const p of mapped) {
        if (amenityKindOfTags(p.tags ?? {})) this.amenityPlaces.set(p.id, p);
      }
      const incoming: DiscoveryItem[] = [
        ...mapped.filter((p) => !amenityKindOfTags(p.tags ?? {})).map(placeToItem),
        ...(data.wikipedia ?? []),
        ...(data.commons ?? []),
        ...acceptDetected(data.detected, nowFixMs),
      ];
      this.col = mergeItems(this.col, incoming);
      this.applySuppression();
      this.apply(this.col.routeVersion);
    } catch {
      // Discovery is an extra; a failed scan must never touch the walk.
      forget();
    }
  }
}
