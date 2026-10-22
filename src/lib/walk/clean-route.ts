import type { Coordinates } from "@/lib/types";
import { buildAvoidPolygons } from "./avoid-polygons";
import { analyzeRoute, type RouteQuality } from "./route-quality";

export type AvoidPolygons = { type: "MultiPolygon"; coordinates: number[][][][] };

/** Repeats / forbidden stretches at or below this are junction noise. */
export const ACCEPTABLE_BAD_KM = 0.05;

export interface CleanRouteResult {
  geometry: Coordinates[];
  quality: RouteQuality;
  /** Routing calls made, including the first. */
  attempts: number;
}

/**
 * Routes through `waypoints`, then improvises: while the route walks a street
 * twice (`noRepeat`) or along a forbidden street, steers the next attempt away
 * from those stretches and keeps the best result. Returns the plain route when
 * nothing is wrong or when no better route exists.
 */
export async function buildCleanRoute(opts: {
  waypoints: Coordinates[];
  route: (waypoints: Coordinates[], avoid: AvoidPolygons | null) => Promise<Coordinates[]>;
  noRepeat: boolean;
  /** Streets the walker does not want to walk along (named or dangerous); crossing one is fine. */
  forbiddenWays?: Coordinates[][];
  maxAttempts?: number;
}): Promise<CleanRouteResult> {
  const { waypoints, route, noRepeat, forbiddenWays = [], maxAttempts = 3 } = opts;
  let geometry = await route(waypoints, null);
  let quality = analyzeRoute(geometry, forbiddenWays);
  let attempts = 1;
  // What the walker asked us to avoid; a repeat only counts when noRepeat is on.
  const cost = (q: RouteQuality) => (noRepeat ? q.repeatedKm : 0) + q.forbiddenKm;
  if (cost(quality) <= ACCEPTABLE_BAD_KM) return { geometry, quality, attempts };

  let avoid = null as AvoidPolygons | null;
  let best = { geometry, quality };
  while (attempts < maxAttempts && cost(best.quality) > ACCEPTABLE_BAD_KM) {
    const strips = [...(noRepeat ? best.quality.repeatedPaths : []), ...best.quality.forbiddenPaths]
      .map((path) => buildAvoidPolygons(path, waypoints))
      .filter((p): p is AvoidPolygons => p !== null);
    if (strips.length === 0) break;
    avoid = {
      type: "MultiPolygon",
      coordinates: [...(avoid?.coordinates ?? []), ...strips.flatMap((s) => s.coordinates)],
    };
    attempts += 1;
    try {
      geometry = await route(waypoints, avoid);
    } catch {
      break; // no route avoids those streets; keep the best one found
    }
    quality = analyzeRoute(geometry, forbiddenWays);
    if (cost(quality) < cost(best.quality)) best = { geometry, quality };
  }
  return { ...best, attempts };
}
