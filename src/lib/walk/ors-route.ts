import { getDirections } from "@/lib/api/ors-client";
import type { Coordinates } from "@/lib/types";
import { toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type { AvoidPolygons } from "./clean-route";

/** ORS waytype 1 = state road (primary/trunk class): the roads treated as unsafe on foot when OSM data is unavailable. */
const STATE_ROAD = 1;

/** What the router itself says about a route: street names and state roads, at no extra call. */
export interface RouteDetail {
  /** Stretches of the route with a street name. Empty when the router gave no names (backup router). */
  named: Array<{ name: string; path: Coordinates[] }>;
  /** Stretches on state roads; null when the router gave no road types. */
  stateRoads: Coordinates[][] | null;
}

const details = new WeakMap<Coordinates[], RouteDetail>();

/** Street names / road types of a geometry returned by `orsRoute` (undefined for any other array). */
export function routeDetail(geometry: Coordinates[]): RouteDetail | undefined {
  return details.get(geometry);
}

const CACHE_MAX = 200;
const cache = new Map<string, Coordinates[]>();

function cacheKey(waypoints: Coordinates[], avoid: AvoidPolygons | null): string {
  return `${waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join(";")}|${avoid ? JSON.stringify(avoid) : ""}`;
}

/** True when `orsRoute` would answer from memory (no router call, so no quota used). */
export function isRouteCached(waypoints: Coordinates[], avoid: AvoidPolygons | null): boolean {
  return cache.has(cacheKey(waypoints, avoid));
}

/** Walking geometry through `waypoints`, optionally steering clear of `avoid`. Names and road types go to `routeDetail`. */
export async function orsRoute(waypoints: Coordinates[], avoid: AvoidPolygons | null): Promise<Coordinates[]> {
  const key = cacheKey(waypoints, avoid);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // most recently used last
    return hit;
  }
  const res = await getDirections({
    coordinates: waypoints.map(toOrsCoord),
    profile: "foot-walking",
    instructions: true,
    extra_info: ["waytype"],
    ...(avoid ? { options: { avoid_polygons: avoid } } : {}),
  });
  const route = res.routes[0];
  if (!route?.geometry) throw new Error("no geometry");
  const geometry = decodePolyline(route.geometry);

  const steps = route.segments.flatMap((s) => s.steps);
  const named = steps
    .filter((s) => s.name && s.name !== "-" && s.way_points)
    .map((s) => ({ name: s.name as string, path: geometry.slice(s.way_points![0], s.way_points![1] + 1) }))
    .filter((s) => s.path.length >= 2);
  const wayTypes = route.extras?.waytype?.values;
  const stateRoads = wayTypes ? wayTypes.filter(([, , v]) => v === STATE_ROAD).map(([a, b]) => geometry.slice(a, b + 1)).filter((p) => p.length >= 2) : null;
  details.set(geometry, { named, stateRoads });

  // A backup-router answer has no step positions (no names, no road types): do not keep it as the answer.
  if (steps.some((s) => s.way_points)) {
    cache.set(key, geometry);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  }
  return geometry;
}
