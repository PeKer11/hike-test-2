import type { Coordinates } from "@/lib/types";
import { toOrsCoord } from "@/lib/utils/geo";
import {
  AVOID_BUFFER_M,
  AVOID_KEEP_DISK_M,
  AVOID_MAX_EXTENT_M,
} from "./discovery-cadence";
import { localProjector } from "./route-frame";

/**
 * MultiPolygon of 20 m-wide strips along the walked track, with 80 m disks
 * around the walker and each stop cut out so a route can still start and end
 * there. Each strip is one 5-vertex ring. Null if the track is too wide for
 * ORS's avoid_polygons limit.
 */
export function buildAvoidPolygons(
  walked: Coordinates[],
  keepDisks: Coordinates[],
): { type: "MultiPolygon"; coordinates: number[][][][] } | null {
  if (walked.length < 2) return null;
  const proj = localProjector(walked[walked.length - 1]);
  const pts = walked.map((p) => proj.toXY(p));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  if (
    Math.max(...xs) - Math.min(...xs) > AVOID_MAX_EXTENT_M ||
    Math.max(...ys) - Math.min(...ys) > AVOID_MAX_EXTENT_M
  ) {
    return null;
  }
  const disks = keepDisks.map((d) => proj.toXY(d));

  const polygons: number[][][][] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    // Parameter intervals of the segment outside every keep-disk.
    let keep: Array<[number, number]> = [[0, 1]];
    for (const c of disks) {
      const fx = a.x - c.x;
      const fy = a.y - c.y;
      const qa = dx * dx + dy * dy;
      const qb = 2 * (fx * dx + fy * dy);
      const qc = fx * fx + fy * fy - AVOID_KEEP_DISK_M * AVOID_KEEP_DISK_M;
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) continue;
      const root = Math.sqrt(disc);
      const t1 = (-qb - root) / (2 * qa);
      const t2 = (-qb + root) / (2 * qa);
      keep = keep.flatMap(([s, e]): Array<[number, number]> => {
        if (t2 <= s || t1 >= e) return [[s, e]];
        const parts: Array<[number, number]> = [];
        if (t1 > s) parts.push([s, t1]);
        if (t2 < e) parts.push([t2, e]);
        return parts;
      });
    }

    const nx = (-dy / len) * AVOID_BUFFER_M;
    const ny = (dx / len) * AVOID_BUFFER_M;
    for (const [s, e] of keep) {
      if ((e - s) * len < 1) continue;
      const p0 = { x: a.x + dx * s, y: a.y + dy * s };
      const p1 = { x: a.x + dx * e, y: a.y + dy * e };
      const ring = [
        { x: p0.x + nx, y: p0.y + ny },
        { x: p1.x + nx, y: p1.y + ny },
        { x: p1.x - nx, y: p1.y - ny },
        { x: p0.x - nx, y: p0.y - ny },
      ].map(({ x, y }) => toOrsCoord(proj.toLatLng(x, y)));
      polygons.push([[...ring, ring[0]]]);
    }
  }
  return polygons.length > 0 ? { type: "MultiPolygon", coordinates: polygons } : null;
}

