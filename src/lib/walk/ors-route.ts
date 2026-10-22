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

/**
 * Stretches of the plain walking route that run along streets with one of `names`,
 * read from ORS step names: a check that needs no map-data service. [] when ORS gave no
 * names (backup router), which the caller must treat as "not checked" via `named`.
 */
export async function namedStreetPaths(waypoints: Coordinates[], names: string[]): Promise<{ named: boolean; paths: Coordinates[][] }> {
  const res = await getDirections({ coordinates: waypoints.map(toOrsCoord), profile: "foot-walking", instructions: true });
  const route = res.routes[0];
  if (!route?.geometry) throw new Error("no geometry");
  const steps = route.segments.flatMap((s) => s.steps);
  if (!steps.some((s) => s.name && s.way_points)) return { named: false, paths: [] };
  const geometry = decodePolyline(route.geometry);
  const wanted = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  const paths = steps
    .filter((s) => s.name && s.way_points && wanted.some((w) => s.name!.toLowerCase().includes(w)))
    .map((s) => geometry.slice(s.way_points![0], s.way_points![1] + 1))
    .filter((p) => p.length >= 2);
  return { named: true, paths };
}
