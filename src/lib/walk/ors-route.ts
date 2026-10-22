import { getDirections } from "@/lib/api/ors-client";
import type { Coordinates } from "@/lib/types";
import { toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type { AvoidPolygons } from "./clean-route";

/** Walking geometry through `waypoints`, optionally steering clear of `avoid`. */
export async function orsRoute(waypoints: Coordinates[], avoid: AvoidPolygons | null): Promise<Coordinates[]> {
  const res = await getDirections({
    coordinates: waypoints.map(toOrsCoord),
    profile: "foot-walking",
    instructions: false,
    ...(avoid ? { options: { avoid_polygons: avoid } } : {}),
  });
  const encoded = res.routes[0]?.geometry;
  if (!encoded) throw new Error("no geometry");
  return decodePolyline(encoded);
}

/** ORS waytype 1 = state road (primary/trunk class): the unsafe-on-foot roads, read without Overpass. */
const STATE_ROAD = 1;

/**
 * Stretches of the plain walking route that run along streets with one of `names` (ORS step names),
 * and along state roads when `dangerous`: a check that needs no map-data service. `named` is false when ORS
 * gave no names (backup router), which the caller must treat as "not checked".
 */
export async function namedStreetPaths(
  waypoints: Coordinates[],
  names: string[],
  dangerous = false,
): Promise<{ named: boolean; paths: Coordinates[][] }> {
  const res = await getDirections({ coordinates: waypoints.map(toOrsCoord), profile: "foot-walking", instructions: true, ...(dangerous ? { extra_info: ["waytype"] } : {}) });
  const route = res.routes[0];
  if (!route?.geometry) throw new Error("no geometry");
  const steps = route.segments.flatMap((s) => s.steps);
  const wayTypes = route.extras?.waytype?.values;
  if (!steps.some((s) => s.name && s.way_points) || (dangerous && !wayTypes)) return { named: false, paths: [] };
  const geometry = decodePolyline(route.geometry);
  const wanted = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  const byName = steps
    .filter((s) => s.name && s.way_points && wanted.some((w) => s.name!.toLowerCase().includes(w)))
    .map((s) => geometry.slice(s.way_points![0], s.way_points![1] + 1));
  const byType = dangerous && wayTypes ? wayTypes.filter(([, , v]) => v === STATE_ROAD).map(([a, b]) => geometry.slice(a, b + 1)) : [];
  return { named: true, paths: [...byName, ...byType].filter((p) => p.length >= 2) };
}
