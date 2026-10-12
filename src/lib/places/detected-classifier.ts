import { classifyArea } from "@/lib/places/safety-zones";
import type { Coordinates } from "@/lib/types";
import type {
  Bbox,
  DetectedDecision,
  DetectedHazard,
  HazardContext,
  LandcoverComponent,
  OsmFeature,
} from "@/lib/types/landcover";
import { haversineDistance } from "@/lib/utils/geo";

/**
 * Pure decision for one satellite land-cover component: suppress it, merge it
 * into something already mapped, or show it as an unverified find with
 * warnings. Fail closed: unknown OSM context, night, a restricted zone, a
 * military/private/fenced neighbour or no mapped path all suppress.
 *
 * Imagery never proves a place is real, open or safe. Confidence is capped at
 * 0.8 and the UI never shows the number.
 */

export const DETECTED_MAX_CONFIDENCE = 0.8;
export const REACH_MAX_M = 150;
export const MILITARY_MARGIN_M = 200;
export const FENCE_MARGIN_M = 30;
export const WADI_MARGIN_M = 100;
export const CLIFF_MARGIN_M = 60;
export const COAST_MARGIN_M = 200;

const PRIVATE_LANDUSE = new Set([
  "farmland",
  "orchard",
  "vineyard",
  "greenhouse_horticulture",
  "plant_nursery",
  "farmyard",
  "cemetery",
  "allotments",
  "residential",
  "industrial",
  "commercial",
  "retail",
  "construction",
  "quarry",
  "landfill",
  "brownfield",
  "railway",
  "basin",
  "aquaculture",
  "salt_pond",
]);
const PRIVATE_MAN_MADE = new Set(["wastewater_plant", "works", "water_works", "storage_tank"]);
const REGISTERED_LANDUSE = new Set([
  "forest",
  "meadow",
  "grass",
  "recreation_ground",
  "village_green",
]);
const REGISTERED_NATURAL = new Set(["wood", "water", "grassland", "scrub", "wetland"]);
const REGISTERED_LEISURE = new Set(["park", "garden"]);
const BARRIERS = new Set(["fence", "wall", "gate", "chain", "retaining_wall"]);
const WALKABLE_HIGHWAY = new Set([
  "footway",
  "path",
  "track",
  "pedestrian",
  "steps",
  "cycleway",
  "bridleway",
  "living_street",
  "residential",
  "service",
  "unclassified",
  "tertiary",
  "secondary",
  "primary",
]);

// ---- geometry -------------------------------------------------------------

function inRing(p: Coordinates, ring: Coordinates[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Centroid, corners and edge midpoints of a bbox. */
export function areaSamples(centroid: Coordinates, bbox: Bbox): Coordinates[] {
  const midLat = (bbox.south + bbox.north) / 2;
  const midLng = (bbox.west + bbox.east) / 2;
  return [
    centroid,
    { lat: bbox.south, lng: bbox.west },
    { lat: bbox.south, lng: bbox.east },
    { lat: bbox.north, lng: bbox.west },
    { lat: bbox.north, lng: bbox.east },
    { lat: midLat, lng: bbox.west },
    { lat: midLat, lng: bbox.east },
    { lat: bbox.south, lng: midLng },
    { lat: bbox.north, lng: midLng },
  ];
}

function distanceToBboxM(p: Coordinates, bbox: Bbox): number {
  const lat = Math.min(bbox.north, Math.max(bbox.south, p.lat));
  const lng = Math.min(bbox.east, Math.max(bbox.west, p.lng));
  return haversineDistance(p, { lat, lng });
}

/** Densify a polyline to <= stepM so a long segment is not skipped. */
function densify(line: Coordinates[], stepM = 25): Coordinates[] {
  const out: Coordinates[] = [];
  for (let i = 0; i < line.length; i += 1) {
    out.push(line[i]);
    if (i + 1 >= line.length) break;
    const len = haversineDistance(line[i], line[i + 1]);
    const n = Math.min(400, Math.floor(len / stepM));
    for (let k = 1; k <= n; k += 1) {
      const t = k / (n + 1);
      out.push({
        lat: line[i].lat + (line[i + 1].lat - line[i].lat) * t,
        lng: line[i].lng + (line[i + 1].lng - line[i].lng) * t,
      });
    }
  }
  return out;
}

/** Smallest distance from a feature's geometry to the component's bbox (0 if inside). */
export function featureDistanceM(f: OsmFeature, comp: LandcoverComponent): number {
  if (f.geometry.length === 0) return Number.POSITIVE_INFINITY;
  const samples = areaSamples(comp.centroid, comp.bbox);
  if (f.closed && f.geometry.length >= 3 && samples.some((s) => inRing(s, f.geometry))) {
    return 0;
  }
  const line = f.closed ? [...f.geometry, f.geometry[0]] : f.geometry;
  let best = Number.POSITIVE_INFINITY;
  for (const p of densify(line)) {
    best = Math.min(best, distanceToBboxM(p, comp.bbox));
    if (best === 0) return 0;
  }
  // A ring that fully encloses the bbox was caught above; a bbox corner inside
  // is caught by `samples`. Remaining case: nothing touches, distance is `best`.
  return best;
}

function containsCentroid(f: OsmFeature, comp: LandcoverComponent): boolean {
  return f.closed && f.geometry.length >= 3 && inRing(comp.centroid, f.geometry);
}

// ---- tag rules ------------------------------------------------------------

function isMilitary(t: Record<string, string>): boolean {
  return (
    t.landuse === "military" ||
    t.military !== undefined ||
    t.hazard !== undefined ||
    t.landmine !== undefined ||
    t.danger_area !== undefined
  );
}

function isPrivateArea(t: Record<string, string>): boolean {
  if (t.landuse && PRIVATE_LANDUSE.has(t.landuse)) return true;
  if (t.amenity === "grave_yard") return true;
  if (t.man_made && PRIVATE_MAN_MADE.has(t.man_made)) return true;
  if (t.access === "private" || t.access === "no" || t.access === "customers") {
    return t.highway === undefined;
  }
  return false;
}

function isRegisteredArea(t: Record<string, string>): boolean {
  return Boolean(
    (t.leisure && REGISTERED_LEISURE.has(t.leisure)) ||
      (t.landuse && REGISTERED_LANDUSE.has(t.landuse)) ||
      (t.natural && REGISTERED_NATURAL.has(t.natural)),
  );
}

function isReserve(t: Record<string, string>): boolean {
  return t.leisure === "nature_reserve" || t.boundary === "protected_area" || t.boundary === "national_park";
}

export function isWalkable(t: Record<string, string>): boolean {
  if (!t.highway || !WALKABLE_HIGHWAY.has(t.highway)) return false;
  if (t.foot === "no" || t.access === "no" || t.access === "private") return false;
  if (t.highway === "service" && (t.access === "customers" || t.service === "driveway")) {
    return false;
  }
  return true;
}

// ---- sun ------------------------------------------------------------------

/** Solar elevation in degrees (NOAA-style approximation, good to ~0.5 deg). */
export function sunElevationDeg(now: Date, p: Coordinates): number {
  const rad = Math.PI / 180;
  const jd = now.getTime() / 86_400_000 + 2_440_587.5;
  const n = jd - 2_451_545;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const hour = (gmst + p.lng) * rad - ra;
  const lat = p.lat * rad;
  return (
    Math.asin(
      Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hour),
    ) / rad
  );
}

export function isDaytime(now: Date, p: Coordinates): boolean {
  return sunElevationDeg(now, p) > 0;
}

// ---- decision -------------------------------------------------------------

export interface ClassifyOptions {
  now: Date;
  /** Geotagged Commons photos nearby (a crowd signal). */
  photoCount?: number;
  /** A Wikipedia page within 75 m: it is a known place, not a new one. */
  wikiMatch?: boolean;
}

const suppress = (reason: string): DetectedDecision => ({ action: "suppress", reason });

export function classifyComponent(
  comp: LandcoverComponent,
  ctx: HazardContext | null,
  opts: ClassifyOptions,
): DetectedDecision {
  const zone = classifyArea(comp.centroid, comp.bbox);
  // "mixed" (should no longer be produced) is treated as denied for this tier.
  if (zone.status !== "allowed") return suppress(`zone:${zone.zones.join(",")}`);
  if (!isDaytime(opts.now, comp.centroid)) return suppress("night");
  // Fail closed: without OSM context we cannot rule out a military, private or
  // unreachable area, so we show nothing.
  if (ctx === null) return suppress("no-context");

  const dist = new Map<OsmFeature, number>();
  const d = (f: OsmFeature) => {
    let v = dist.get(f);
    if (v === undefined) {
      v = featureDistanceM(f, comp);
      dist.set(f, v);
    }
    return v;
  };

  for (const f of ctx.features) {
    if (isMilitary(f.tags) && d(f) <= MILITARY_MARGIN_M) return suppress("military");
  }
  for (const f of ctx.features) {
    if (isPrivateArea(f.tags) && f.closed && d(f) === 0) return suppress("private");
  }
  for (const f of ctx.features) {
    if (f.tags.barrier && BARRIERS.has(f.tags.barrier) && d(f) <= FENCE_MARGIN_M) {
      return suppress("fenced");
    }
  }
  // Sea (WorldCover "water" includes it): a water patch with the coastline within
  // COAST_MARGIN_M of its bbox is treated as sea, even if a promenade is near.
  if (
    comp.cls === "water" &&
    ctx.features.some((f) => f.tags.natural === "coastline" && d(f) <= COAST_MARGIN_M)
  ) {
    return suppress("coast");
  }
  if (opts.wikiMatch) return { action: "merge", reason: "wiki" };
  for (const f of ctx.features) {
    if (isRegisteredArea(f.tags) && containsCentroid(f, comp)) {
      return { action: "merge", reason: "registered" };
    }
  }

  // Reachability: a mapped walkable way must touch the patch within 150 m.
  const reachable = ctx.features.some((f) => isWalkable(f.tags) && d(f) <= REACH_MAX_M);
  if (!reachable) return suppress("no-path");

  const hazards: DetectedHazard[] = ["private"];
  if (ctx.features.some((f) => isReserve(f.tags) && d(f) === 0)) hazards.push("reserve");
  if (
    ctx.features.some(
      (f) =>
        (f.tags.waterway === "wadi" ||
          ((f.tags.waterway === "stream" || f.tags.waterway === "river" || f.tags.waterway === "drain") &&
            f.tags.intermittent === "yes")) &&
        d(f) <= WADI_MARGIN_M,
    )
  ) {
    hazards.push("flood");
  }
  if (
    ctx.features.some(
      (f) => (f.tags.natural === "cliff" || f.tags.cliff === "yes") && d(f) <= CLIFF_MARGIN_M,
    )
  ) {
    hazards.push("cliff");
  }
  const month = opts.now.getUTCMonth(); // 5..9 = June..October
  if (comp.cls !== "water" && month >= 5 && month <= 9) hazards.push("fire");

  let confidence = 0.25 + 0.2; // base + reachable (guaranteed here)
  if (comp.cls === "tree" && (comp.canopyShare ?? 0) >= 0.5) confidence += 0.25;
  if (comp.areaM2 >= 5000) confidence += 0.15;
  if ((opts.photoCount ?? 0) >= 3) confidence += 0.15;
  confidence = Math.min(DETECTED_MAX_CONFIDENCE, Math.round(confidence * 100) / 100);

  return { action: "show", confidence, hazards };
}
