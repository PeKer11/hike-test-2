import { WORLDCOVER_ATTRIBUTION } from "@/lib/types/landcover";
import { appUserAgent } from "@/lib/api/http-identity";
import { createCircuitBreaker, parseRetryAfterMs } from "@/lib/api/circuit-breaker";
import { classifyComponent } from "@/lib/places/detected-classifier";
import {
  cellsCovering,
  getLandcoverComponents,
  type LandcoverCellStore,
  type LandcoverDeps,
} from "@/lib/places/landcover";
import { classifyArea } from "@/lib/places/safety-zones";
import type { Coordinates } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import type {
  Bbox,
  DetectedDecision,
  HazardContext,
  LandcoverComponent,
  OsmFeature,
} from "@/lib/types/landcover";
import { discoveryCopy } from "@/lib/walk/discovery-copy";
import { haversineDistance } from "@/lib/utils/geo";

/**
 * The imagery ("detected") tier, end to end: land-cover cells -> candidate
 * patches -> one Overpass hazard query -> per-patch decision -> DiscoveryItems.
 *
 * Off unless `NEXT_PUBLIC_DETECTED_TIER=1`. With the flag off this makes ZERO
 * network or database calls. Any failure (no cache, no network, Overpass down)
 * yields no items: it never throws and never degrades to "show anyway".
 */

export const DETECTED_FLAG = "NEXT_PUBLIC_DETECTED_TIER";
export const DETECTED_MAX_CANDIDATES = 12;
export const DETECTED_TIMEOUT_MS = 8_000;
/**
 * The server-side query budget, one second under the client's: Overpass stops
 * working when we have already given up, and a query it can finish in time is
 * one we will still be listening for (it was `[timeout:25]` against an 8 s client).
 */
export const DETECTED_QUERY_TIMEOUT_S = Math.floor(DETECTED_TIMEOUT_MS / 1000) - 1;
export { WORLDCOVER_ATTRIBUTION };
const WIKI_MATCH_M = 75;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** Breaker for the detected tier's own Overpass calls (keyed by endpoint). */
export const detectedOverpassBreaker = createCircuitBreaker();

export function isDetectedTierEnabled(): boolean {
  return process.env[DETECTED_FLAG] === "1";
}

// ---- hazard context (Overpass) --------------------------------------------

function union(boxes: Bbox[], padM: number): Bbox {
  const padLat = padM / 111_000;
  const lat = (Math.min(...boxes.map((b) => b.south)) + Math.max(...boxes.map((b) => b.north))) / 2;
  const padLng = padM / (111_000 * Math.cos((lat * Math.PI) / 180));
  return {
    south: Math.min(...boxes.map((b) => b.south)) - padLat,
    north: Math.max(...boxes.map((b) => b.north)) + padLat,
    west: Math.min(...boxes.map((b) => b.west)) - padLng,
    east: Math.max(...boxes.map((b) => b.east)) + padLng,
  };
}

/** landuse values that make a patch private / closed (query regex and parser share this). */
const HAZARD_LANDUSE = "military|farmland|orchard|vineyard|aquaculture|salt_pond|landfill|quarry|industrial";
const HAZARD_MAN_MADE = "wastewater_plant|works|water_works|storage_tank";

const ENCLOSING_FILTERS = [
  `["landuse"~"^(${HAZARD_LANDUSE})$"]`,
  `["man_made"~"^(${HAZARD_MAN_MADE})$"]`,
  '["military"]',
  '["hazard"]',
  '["landmine"]',
  '["danger_area"]',
  '["access"~"^(private|no)$"]',
  '["leisure"="nature_reserve"]',
  '["boundary"~"^(protected_area|national_park)$"]',
];

/** Marker element type emitted after each candidate's enclosing areas. */
export const ENCLOSING_SEPARATOR = "detected_sep";
/** Marker emitted once after the bbox part: everything after it is is_in output. */
export const ENCLOSING_BEGIN = "detected_begin";

/** Does a tag set mean "this area is military / private / hazardous / a reserve"? */
export function isEnclosingHazardTags(t: Record<string, string>): boolean {
  return (
    (t.landuse !== undefined && new RegExp(`^(${HAZARD_LANDUSE})$`).test(t.landuse)) ||
    (t.man_made !== undefined && new RegExp(`^(${HAZARD_MAN_MADE})$`).test(t.man_made)) ||
    t.military !== undefined ||
    t.hazard !== undefined ||
    t.landmine !== undefined ||
    t.danger_area !== undefined ||
    t.access === "private" ||
    t.access === "no" ||
    t.leisure === "nature_reserve" ||
    t.boundary === "protected_area" ||
    t.boundary === "national_park"
  );
}

function padBox(b: Bbox, padM: number): string {
  const padLat = padM / 111_000;
  const lat = (b.south + b.north) / 2;
  const padLng = padM / (111_000 * Math.cos((lat * Math.PI) / 180));
  return `${(b.south - padLat).toFixed(5)},${(b.west - padLng).toFixed(5)},${(b.north + padLat).toFixed(5)},${(b.east + padLng).toFixed(5)}`;
}

export function buildHazardQuery(
  candidates: LandcoverComponent[],
  padM = 250,
): string {
  const b = union(candidates.map((c) => c.bbox), padM);
  const box = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  // Fences / walls / gates across the WHOLE patch bbox (+60 m), per candidate.
  const fences = candidates
    .map(
      (c) =>
        `way["barrier"~"^(fence|wall|gate|chain|retaining_wall)$"](${padBox(c.bbox, 60)});`,
    )
    .join("");
  // Per candidate: every area (Overpass assembles multipolygons, so multi-piece
  // outlines count) that CONTAINS the patch centre. A patch fully inside a big
  // military / private area is not returned by the bbox query, only by is_in.
  const enclosing = candidates
    .map((c, i) => {
      const at = `${c.centroid.lat.toFixed(5)},${c.centroid.lng.toFixed(5)}`;
      const filters = ENCLOSING_FILTERS.map((f) => `area.a${i}${f};way.a${i}${f};relation.a${i}${f};`).join("");
      return `is_in(${at})->.a${i};(${filters})->.e${i};.e${i} out tags;make ${ENCLOSING_SEPARATOR} idx="${i}";out;`;
    })
    .join("\n");
  return `[out:json][timeout:${DETECTED_QUERY_TIMEOUT_S}];(
way["landuse"](${box});relation["landuse"~"^(${HAZARD_LANDUSE})$"](${box});
way["man_made"~"^(${HAZARD_MAN_MADE})$"](${box});relation["man_made"~"^(${HAZARD_MAN_MADE})$"](${box});
way["military"](${box});relation["military"](${box});
nwr["hazard"~"^(minefield|landmine|mine|danger_area)$"](${box});nwr["landmine"](${box});nwr["danger_area"](${box});
way["military"="danger_area"](${box});
way["leisure"~"^(park|garden|nature_reserve)$"](${box});relation["leisure"="nature_reserve"](${box});
way["natural"~"^(wood|water|grassland|scrub|wetland|cliff|coastline)$"](${box});relation["natural"~"^(wood|water)$"](${box});
way["boundary"~"^(protected_area|national_park)$"](${box});relation["boundary"~"^(protected_area|national_park)$"](${box});
way["amenity"="grave_yard"](${box});
way["access"~"^(private|no)$"]["highway"!~"."](${box});
way["waterway"~"^(wadi|stream|river|drain|canal|ditch)$"](${box});way["intermittent"="yes"](${box});
way["highway"~"^(footway|path|track|pedestrian|steps|cycleway|bridleway|living_street|residential|service|unclassified|tertiary)$"](${box});
${fences}
);out geom;
make ${ENCLOSING_BEGIN} x="1";out;
${enclosing}`;
}

interface OverpassGeomPoint {
  lat?: number;
  lon?: number;
}
interface OverpassElement {
  type?: string;
  lat?: number;
  lon?: number;
  id?: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeomPoint[];
  members?: Array<{ type?: string; role?: string; geometry?: OverpassGeomPoint[] }>;
}

function toLine(geometry: OverpassGeomPoint[] | undefined): Coordinates[] {
  return (geometry ?? []).flatMap((p) =>
    typeof p.lat === "number" && typeof p.lon === "number"
      ? [{ lat: p.lat, lng: p.lon }]
      : [],
  );
}

function isRingLine(line: Coordinates[]): boolean {
  if (line.length < 4) return false;
  const a = line[0];
  const b = line[line.length - 1];
  return a.lat === b.lat && a.lng === b.lng;
}

/**
 * Overpass JSON -> features. A way closes into a polygon only when it is a
 * closed ring (and not a linear tag); relation members become rings when
 * closed, else lines (open outer pieces are then treated by proximity only).
 */
export function parseHazardResponse(
  json: unknown,
  expectedCandidates?: number,
): OsmFeature[] | null {
  const root = json as { elements?: OverpassElement[]; remark?: unknown } | null;
  // A `remark` on a 200 means a timeout / out-of-memory PARTIAL result: unknown.
  if (root && root.remark !== undefined) return null;
  const elements = root?.elements;
  if (!Array.isArray(elements)) return null;
  const out: OsmFeature[] = [];
  let pending: Array<Record<string, string>> = [];
  let separators = 0;
  // Since Overpass 0.7.57 `is_in` returns closed ways as {"type":"way","tags"}
  // WITHOUT geometry (only relation-built areas are type "area"). So after the
  // begin marker, ANY tagged element is an enclosing area, whatever its type.
  let inEnclosing = false;
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === ENCLOSING_BEGIN) {
      inEnclosing = true;
    } else if (el.type === ENCLOSING_SEPARATOR) {
      separators += 1;
      const idx = Number(tags.idx);
      if (Number.isInteger(idx)) {
        for (const t of pending) out.push({ tags: t, geometry: [], closed: false, encloses: idx });
      }
      pending = [];
    } else if (el.type === "area" || (inEnclosing && el.tags !== undefined)) {
      if (el.type === "area" || isEnclosingHazardTags(tags)) pending.push(tags);
    } else if (el.type === "node") {
      if (typeof el.lat === "number" && typeof el.lon === "number") {
        out.push({ tags, geometry: [{ lat: el.lat, lng: el.lon }], closed: false });
      }
    } else if (el.type === "way") {
      const line = toLine(el.geometry);
      if (line.length === 0) continue;
      const linearOnly = Boolean(tags.highway || tags.waterway || tags.barrier);
      out.push({ tags, geometry: line, closed: !linearOnly && isRingLine(line) });
    } else if (el.type === "relation") {
      for (const m of el.members ?? []) {
        if (m.type !== "way") continue;
        if (m.role !== undefined && m.role !== "outer" && m.role !== "") continue;
        const line = toLine(m.geometry);
        if (line.length === 0) continue;
        out.push({ tags, geometry: line, closed: isRingLine(line) });
      }
    }
  }
  // Fail closed: enclosing-area results cut off (no separator for some
  // candidate, or trailing areas without one) mean we cannot rule out a
  // containing military / private area.
  if (pending.length > 0) return null;
  if (expectedCandidates !== undefined && (!inEnclosing || separators !== expectedCandidates)) {
    return null;
  }
  return out;
}

/**
 * Binds an `encloses` feature (an area containing the patch centre) to its
 * candidate by giving it the patch bbox as a closed ring; drops features that
 * enclose a different candidate.
 */
export function contextForCandidate(
  ctx: HazardContext | null,
  comp: LandcoverComponent,
  index: number,
): HazardContext | null {
  if (!ctx) return null;
  const { south, north, west, east } = comp.bbox;
  const ringPts: Coordinates[] = [
    { lat: south, lng: west },
    { lat: south, lng: east },
    { lat: north, lng: east },
    { lat: north, lng: west },
    { lat: south, lng: west },
  ];
  return {
    features: ctx.features.flatMap((f) => {
      if (f.encloses === undefined) return [f];
      if (f.encloses !== index) return [];
      return [{ tags: f.tags, geometry: ringPts, closed: true }];
    }),
  };
}

export type FetchLike = typeof fetch;

/**
 * `null` = unknown (network, timeout, bad response, breaker open): the caller
 * must fail closed. `onCall` fires once per real upstream request.
 */
export async function fetchHazardContext(
  candidates: LandcoverComponent[],
  fetchImpl: FetchLike = fetch,
  onCall?: () => void,
): Promise<HazardContext | null> {
  if (candidates.length === 0) return { features: [] };
  if (detectedOverpassBreaker.isOpen(OVERPASS_URL)) return null;
  try {
    onCall?.();
    const response = await fetchImpl(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": appUserAgent(),
      },
      body: new URLSearchParams({ data: buildHazardQuery(candidates) }).toString(),
      signal: AbortSignal.timeout(DETECTED_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        detectedOverpassBreaker.recordFailure(
          OVERPASS_URL,
          parseRetryAfterMs(response.headers?.get?.("Retry-After")),
        );
      }
      return null;
    }
    const features = parseHazardResponse(await response.json(), candidates.length);
    if (!features) return null;
    detectedOverpassBreaker.recordSuccess(OVERPASS_URL);
    return { features };
  } catch {
    detectedOverpassBreaker.recordFailure(OVERPASS_URL);
    return null;
  }
}

// ---- items ----------------------------------------------------------------

export function componentToItem(
  comp: LandcoverComponent,
  decision: Extract<DetectedDecision, { action: "show" }>,
  index: number,
  lang: "en" | "he" = "en",
): DiscoveryItem {
  const id = `detected:${comp.centroid.lat.toFixed(4)},${comp.centroid.lng.toFixed(4)}:${index}`;
  const name =
    comp.cls === "water"
      ? discoveryCopy[lang]["detected.nameWater"]
      : discoveryCopy[lang]["detected.nameGreen"];
  return {
    id,
    attraction: {
      id,
      name,
      coordinates: comp.centroid,
      category: comp.cls === "grass" ? "park" : "nature",
      avgVisitMinutes: 5,
      tags: {
        detected: "1",
        "detected:class": comp.cls,
        "detected:hazards": decision.hazards.join(","),
        "detected:confidence": String(decision.confidence),
        "detected:source": WORLDCOVER_ATTRIBUTION,
      },
    },
    kind: "scenery",
    tier: "detected",
    sources: ["worldcover"],
    notable: false,
    score: 0,
    frame: null,
    detourMin: 0,
    state: "new",
  };
}

// ---- store ----------------------------------------------------------------

/**
 * Reads precomputed `landcover_cells` with the request's Supabase client (RLS:
 * select only). One query for all cells; any error = "no cache".
 */
export async function createSupabaseCellStore(
  cells: string[],
): Promise<LandcoverCellStore> {
  const rows = new Map<string, LandcoverComponent[]>();
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("landcover_cells")
      .select("cell, components")
      .in("cell", cells);
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<{ cell: string; components: unknown }>) {
        if (Array.isArray(row.components)) {
          rows.set(row.cell, row.components as LandcoverComponent[]);
        }
      }
    }
  } catch {
    // No cache: no detected items.
  }
  return { get: async (cell) => rows.get(cell) ?? null };
}

// ---- orchestrator ---------------------------------------------------------

export interface DetectedScanDeps extends LandcoverDeps {
  fetchImpl?: FetchLike;
  now?: Date;
  /** Skip the flag check (tests only). */
  force?: boolean;
  /** Language of the patch name (default en). */
  lang?: "en" | "he";
  /** Known places from the other signals, to avoid re-announcing them. */
  wikiPlaces?: Coordinates[];
  photoClusters?: Array<{ coordinates: Coordinates; photoCount: number }>;
}

export async function runDetectedScan(
  points: Coordinates[],
  ringRadiusMeters: number,
  deps: DetectedScanDeps = {},
): Promise<DiscoveryItem[]> {
  return (await runDetectedScanCounted(points, ringRadiusMeters, deps)).items;
}

/** Same as `runDetectedScan`, also reporting how many Overpass requests were made. */
export async function runDetectedScanCounted(
  points: Coordinates[],
  ringRadiusMeters: number,
  deps: DetectedScanDeps = {},
): Promise<{ items: DiscoveryItem[]; overpassCalls: number }> {
  let overpassCalls = 0;
  if (!deps.force && !isDetectedTierEnabled()) return { items: [], overpassCalls };
  try {
    const now = deps.now ?? new Date();
    const cells = cellsCovering(points, ringRadiusMeters);
    if (cells.length === 0) return { items: [], overpassCalls };
    const store = deps.store ?? (deps.reader ? undefined : await createSupabaseCellStore(cells));
    const all = await getLandcoverComponents(cells, { store, reader: deps.reader });

    // Cheap pre-filter before spending an Overpass call: restricted zones.
    const candidates = all
      .filter((c) => classifyArea(c.centroid, c.bbox).status !== "denied")
      .sort((a, b) => b.areaM2 - a.areaM2)
      .slice(0, DETECTED_MAX_CANDIDATES);
    if (candidates.length === 0) return { items: [], overpassCalls };

    const ctx = await fetchHazardContext(candidates, deps.fetchImpl, () => {
      overpassCalls += 1;
    });
    const items: DiscoveryItem[] = [];
    candidates.forEach((comp, i) => {
      const wikiMatch = (deps.wikiPlaces ?? []).some(
        (w) => haversineDistance(w, comp.centroid) <= WIKI_MATCH_M,
      );
      const photoCount = Math.max(
        0,
        ...(deps.photoClusters ?? [])
          .filter((c) => haversineDistance(c.coordinates, comp.centroid) <= 150)
          .map((c) => c.photoCount),
      );
      const decision = classifyComponent(comp, contextForCandidate(ctx, comp, i), { now, wikiMatch, photoCount });
      if (decision.action === "show") items.push(componentToItem(comp, decision, i, deps.lang));
    });
    return { items, overpassCalls };
  } catch {
    return { items: [], overpassCalls };
  }
}
