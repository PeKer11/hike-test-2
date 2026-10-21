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
