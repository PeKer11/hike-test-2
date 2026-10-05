import type { Coordinates } from "@/lib/types";
import type {
  DiscoveryItem,
  RouteFrame,
  WalkEnvironment,
} from "@/lib/types/discovery";
import {
  FRAME_END_SLACK_M,
  FRAME_ON_ROUTE_M,
  RURAL_DENSITY_PER_KM,
  URBAN_DENSITY_PER_KM,
} from "./discovery-cadence";

// Metres per degree of latitude on the same sphere `haversineDistance` uses.
const M_PER_DEG = (Math.PI / 180) * 6_371_000;

export interface LocalProjector {
  toXY(p: Coordinates): { x: number; y: number };
  toLatLng(x: number, y: number): Coordinates;
}

/** Equirectangular east/north metres around `origin`; fine at walking scale. */
export function localProjector(origin: Coordinates): LocalProjector {
  const kLng = M_PER_DEG * Math.cos((origin.lat * Math.PI) / 180);
  return {
    toXY: (p) => ({
      x: (p.lng - origin.lng) * kLng,
      y: (p.lat - origin.lat) * M_PER_DEG,
    }),
    toLatLng: (x, y) => ({
      lat: origin.lat + y / M_PER_DEG,
      lng: origin.lng + x / kLng,
    }),
  };
}

/**
 * Where `p` sits relative to the route: distance along it, and which side and
 * how far across. Cross-track, so GPS heading noise never flips left/right.
 * `lateralM` is signed (right positive). Null when `p` is more than 50 m past
 * either end of the route.
 */
export function routeFrame(
  p: Coordinates,
  geometry: Coordinates[],
  cumDist: number[],
): RouteFrame | null {
  if (geometry.length < 2 || cumDist.length !== geometry.length) return null;
  const proj = localProjector(p);

  let best: {
    i: number;
    t: number;
    rawT: number;
    dist: number;
    cross: number;
    len: number;
  } | null = null;

  for (let i = 0; i < geometry.length - 1; i += 1) {
    const a = proj.toXY(geometry[i]);
    const b = proj.toXY(geometry[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const rawT = (-a.x * dx - a.y * dy) / len2;
    const t = Math.max(0, Math.min(1, rawT));
    const dist = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (best === null || dist < best.dist) {
      // p is the origin, so p - a = (-a.x, -a.y); segDir x (p - a).
      best = { i, t, rawT, dist, cross: dx * -a.y - dy * -a.x, len: Math.sqrt(len2) };
    }
  }
  if (best === null) return null;

  if (best.i === 0 && best.rawT < 0 && -best.rawT * best.len > FRAME_END_SLACK_M) {
    return null;
  }
  if (
    best.i === geometry.length - 2 &&
    best.rawT > 1 &&
    (best.rawT - 1) * best.len > FRAME_END_SLACK_M
  ) {
    return null;
  }

  const alongM =
    cumDist[best.i] + best.t * (cumDist[best.i + 1] - cumDist[best.i]);
  // cross < 0 means p is to the right of the direction of travel.
  const lateralM = best.cross < 0 ? best.dist : -best.dist;
  const side =
    best.dist < FRAME_ON_ROUTE_M ? "on" : lateralM > 0 ? "right" : "left";
  return { alongM, lateralM, side, segIdx: best.i };
}

const PARK_TAG_MATCH = (tags: Record<string, string>): boolean =>
  tags.leisure === "park" ||
  tags.leisure === "nature_reserve" ||
  tags.natural === "wood" ||
  tags.landuse === "forest";

export interface AreaBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  tags?: Record<string, string>;
}

/**
 * Urban, park or rural, for picking the lateral limits. `areas` are bounding
 * boxes of mapped park / wood / reserve polygons (those with `tags` must be of
 * a park-like kind); the walker inside one is in a park. Otherwise corridor POI
 * density per km decides.
 */
export function classifyEnvironment(
  items: Array<Pick<DiscoveryItem, "kind">>,
  routeKm: number,
  pos: Coordinates,
  areas: AreaBox[] = [],
): WalkEnvironment {
  const inPark = areas.some(
    (a) =>
      (a.tags === undefined || PARK_TAG_MATCH(a.tags)) &&
      pos.lat >= a.minLat &&
      pos.lat <= a.maxLat &&
      pos.lng >= a.minLng &&
      pos.lng <= a.maxLng,
  );
  if (inPark) return "park";
  if (routeKm <= 0) return "urban";
  const density = items.filter((i) => i.kind === "poi").length / routeKm;
  if (density >= URBAN_DENSITY_PER_KM) return "urban";
  if (density < RURAL_DENSITY_PER_KM) return "rural";
  return "urban";
}
