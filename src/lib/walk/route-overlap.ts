import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import {
  OVERLAP_SKIP_FIRST_M,
  OVERLAP_STEP_M,
  OVERLAP_TOL_M,
} from "./discovery-cadence";
import { localProjector } from "./route-frame";
import { cumulativeDistances } from "./walk-stats";

/** Points every `stepM` along `path`, beginning `skipFirstM` in. */
export function samplePath(
  path: Coordinates[],
  stepM: number,
  skipFirstM = 0,
): Coordinates[] {
  if (path.length === 0) return [];
  if (path.length === 1) return skipFirstM > 0 ? [] : [path[0]];
  const cum = cumulativeDistances(path);
  const total = cum[cum.length - 1];
  const out: Coordinates[] = [];
  let seg = 0;
  for (let d = skipFirstM; d <= total; d += stepM) {
    while (seg < path.length - 2 && cum[seg + 1] < d) seg += 1;
    const span = cum[seg + 1] - cum[seg];
    const t = span === 0 ? 0 : (d - cum[seg]) / span;
    out.push({
      lat: path[seg].lat + t * (path[seg + 1].lat - path[seg].lat),
      lng: path[seg].lng + t * (path[seg + 1].lng - path[seg].lng),
    });
  }
  return out;
}

/** Metres from `p` to the nearest point of the polyline `ref` (local metres). */
export function distanceToPolylineM(p: Coordinates, ref: Coordinates[]): number {
  if (ref.length === 0) return Infinity;
  if (ref.length === 1) return haversineDistance(p, ref[0]);
  const proj = localProjector(p);
  let best = Infinity;
  for (let i = 0; i < ref.length - 1; i += 1) {
    const a = proj.toXY(ref[i]);
    const b = proj.toXY(ref[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

/**
 * Fraction of `candidate` (sampled every `stepM`, ignoring the first
 * `skipFirstM`, where any route starts on the walker) lying within `tolM` of
 * `reference`. 1 = retraces it, 0 = never touches it.
 */
export function overlap(
  candidate: Coordinates[],
  reference: Coordinates[],
  opts: { skipFirstM?: number; stepM?: number; tolM?: number } = {},
): number {
  const {
    skipFirstM = OVERLAP_SKIP_FIRST_M,
    stepM = OVERLAP_STEP_M,
    tolM = OVERLAP_TOL_M,
  } = opts;
  const samples = samplePath(candidate, stepM, skipFirstM);
  if (samples.length === 0 || reference.length === 0) return 0;
  const near = samples.filter(
    (s) => distanceToPolylineM(s, reference) <= tolM,
  ).length;
  return near / samples.length;
}
