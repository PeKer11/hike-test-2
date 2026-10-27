import { getDirections } from "@/lib/api/ors-client";
import type { Coordinates } from "@/lib/types";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type { AvoidPolygons } from "./clean-route";
import type { RouteMode } from "./access";

/** A returned line whose first point is farther than this from the start is treated as broken. */
const MAX_START_GAP_M = 400;

/** ORS waytype 8 = steps. */
const STEPS = 8;

/** ORS waytype 1 = state road (primary/trunk class): the roads treated as unsafe on foot when OSM data is unavailable. */
const STATE_ROAD = 1;

/** What the router itself says about a route: street names and state roads, at no extra call. */
export interface RouteDetail {
  /** Stretches of the route with a street name. Empty when the router gave no names (backup router). */
  named: Array<{ name: string; path: Coordinates[] }>;
  /** Stretches on state roads; null when the router gave no road types. */
  stateRoads: Coordinates[][] | null;
  /** Climb per leg (one per pair of waypoints); null when the router gave no heights. */
  legs?: Array<{ distanceM: number; ascentM: number }> | null;
  /** Stretches with steps / their slope class / their surface code; null when the router did not send them (only asked for with a route mode). */
  steps?: Coordinates[][] | null;
  grades?: Array<{ path: Coordinates[]; cls: number }> | null;
  surfaces?: Array<{ path: Coordinates[]; code: number }> | null;
}

const details = new WeakMap<Coordinates[], RouteDetail>();

/** Street names / road types of a geometry returned by `orsRoute` (undefined for any other array). */
export function routeDetail(geometry: Coordinates[]): RouteDetail | undefined {
  return details.get(geometry);
}

const CACHE_MAX = 200;
const cache = new Map<string, Coordinates[]>();

function cacheKey(waypoints: Coordinates[], avoid: AvoidPolygons | null, mode?: RouteMode): string {
  return `${waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join(";")}|${avoid ? JSON.stringify(avoid) : ""}|${mode?.key ?? ""}`;
}

/** True when `orsRoute` would answer from memory (no router call, so no quota used). */
export function isRouteCached(waypoints: Coordinates[], avoid: AvoidPolygons | null, mode?: RouteMode): boolean {
  return cache.has(cacheKey(waypoints, avoid, mode));
}

/** Walking geometry through `waypoints`, optionally steering clear of `avoid`. Names and road types go to `routeDetail`. */
export async function orsRoute(waypoints: Coordinates[], avoid: AvoidPolygons | null, mode?: RouteMode): Promise<Coordinates[]> {
  const key = cacheKey(waypoints, avoid, mode);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // most recently used last
    return hit;
  }
  const res = await getDirections({
    coordinates: waypoints.map(toOrsCoord),
    profile: mode?.profile ?? "foot-walking",
    instructions: true,
    extra_info: mode ? ["waytype", "steepness", "surface"] : ["waytype"],
    elevation: true,
    ...(avoid || mode ? { options: { ...mode?.options, ...(avoid ? { avoid_polygons: avoid } : {}) } } : {}),
  });
  const route = res.routes[0];
  if (!route?.geometry) throw new Error("no geometry");
  // ORS answers with heights (3D line) when asked; the backup router answers in 2D. The step positions say how many points the
  // line really has, so the format is the one whose decoded length matches; without step positions ORS means 3D, the backup 2D.
  const stepEnds = route.segments.flatMap((s) => s.steps.map((st) => st.way_points?.[1] ?? -1));
  const expected = Math.max(...stepEnds, -1) + 1;
  const as3d = decodePolyline(route.geometry, 5, true);
  const as2d = decodePolyline(route.geometry, 5, false);
  // A real 3D line never also decodes to the right count as 2D (3N values read as pairs give 1.5N points), so a tie means 2D.
  const hasElevation = expected > 0 ? (as2d.length === expected ? false : true) : false;
  const geometry = hasElevation ? as3d : as2d;
  // A mis-decoded line starts far from where it was asked to start.
  if (geometry.length > 0 && haversineDistance(waypoints[0], geometry[0]) > MAX_START_GAP_M) throw new Error("route does not start at the start point");
  const legs = hasElevation ? route.segments.map((s) => ({ distanceM: s.distance, ascentM: typeof s.ascent === "number" ? s.ascent : 0 })) : null;

  const steps = route.segments.flatMap((s) => s.steps);
  const named = steps
    .filter((s) => s.name && s.name !== "-" && s.way_points)
    .map((s) => ({ name: s.name as string, path: geometry.slice(s.way_points![0], s.way_points![1] + 1) }))
    .filter((s) => s.path.length >= 2);
  const wayTypes = route.extras?.waytype?.values;
  const stateRoads = wayTypes ? wayTypes.filter(([, , v]) => v === STATE_ROAD).map(([a, b]) => geometry.slice(a, b + 1)).filter((p) => p.length >= 2) : null;
  const pieces = (key: string) => route.extras?.[key]?.values;
  const stepValues = wayTypes?.filter(([, , v]) => v === STEPS).map(([a, b]) => geometry.slice(a, b + 1)).filter((p) => p.length >= 2);
  const gradeValues = pieces("steepness")?.map(([a, b, v]) => ({ path: geometry.slice(a, b + 1), cls: v })).filter((g) => g.path.length >= 2 && g.cls !== 0);
  const surfaceValues = pieces("surface")?.map(([a, b, v]) => ({ path: geometry.slice(a, b + 1), code: v })).filter((s) => s.path.length >= 2);
  details.set(geometry, { named, stateRoads, legs, ...(mode ? { steps: stepValues ?? null, grades: gradeValues ?? null, surfaces: surfaceValues ?? null } : {}) });

  // A backup-router answer has no step positions (no names, no road types): do not keep it as the answer.
  if (steps.some((s) => s.way_points)) {
    cache.set(key, geometry);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  }
  return geometry;
}
