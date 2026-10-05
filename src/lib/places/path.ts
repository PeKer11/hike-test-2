import type { Coordinates } from "@/lib/types";
import { closestPointOnSegment, haversineDistance } from "@/lib/utils/geo";

/**
 * Thin a polyline to at most `maxPoints` by even decimation, keeping both ends.
 * Overpass `around:` line queries take every vertex as a literal, so a 3,000
 * point route would be an unusable query; a corridor 250 m wide does not care
 * about the vertices a straight-ish street was drawn with.
 */
export function simplifyPath(path: Coordinates[], maxPoints: number): Coordinates[] {
  if (path.length <= maxPoints || maxPoints < 2) return path;
  const out: Coordinates[] = [];
  const step = (path.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(path[Math.round(i * step)]);
  }
  return out;
}

/** Shortest distance from `point` to the polyline, metres (Infinity if empty). */
export function distanceToPath(point: Coordinates, path: Coordinates[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return haversineDistance(point, path[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i += 1) {
    const p = closestPointOnSegment(point, path[i], path[i + 1]);
    best = Math.min(best, haversineDistance(point, p));
  }
  return best;
}
