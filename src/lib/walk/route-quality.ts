import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { distanceToPolylineM, samplePath } from "./route-overlap";

/** Spacing of the points a route is checked at. */
const STEP_M = 20;
/** A point this close to an earlier part of the route counts as the same street. */
const SAME_STREET_M = 15;
/** Route this far (along the path) behind a point is its own neighbourhood, not a repeat. */
const MIN_LOOP_M = 150;
/** The route starts and ends on the origin, so the first/last metres overlap by design. */
const ENDS_M = 60;
/** A loop that ends within this of the start counts as closed. */
const CLOSE_M = 50;
/** Shorter repeated runs are junction noise (a corner shared by two streets). */
const MIN_RUN_M = 40;

export interface RouteQuality {
  /** Metres between the route's end and its start. */
  endGapM: number;
  closesLoop: boolean;
  /** Kilometres walked over a street the route already used earlier. */
  repeatedKm: number;
  /** The repeated stretches, so a re-route can steer around them. */
  repeatedPaths: Coordinates[][];
  /** Kilometres walked along a street the walker asked to avoid. */
  forbiddenKm: number;
  forbiddenPaths: Coordinates[][];
}

/** Contiguous runs of flagged samples, dropping runs too short to be real (a crossing, a shared corner). */
function runsOf(samples: Coordinates[], flagged: boolean[]): Coordinates[][] {
  const runs: Coordinates[][] = [];
  let run: Coordinates[] = [];
  const flush = () => {
    if (run.length * STEP_M >= MIN_RUN_M) runs.push(run);
    run = [];
  };
  flagged.forEach((isFlagged, i) => (isFlagged ? run.push(samples[i]) : flush()));
  flush();
  return runs;
}

const km = (paths: Coordinates[][]) =>
  Math.round((paths.reduce((sum, p) => sum + p.length * STEP_M, 0) / 1000) * 10) / 10;

/**
 * Checks the loop closes and finds the streets a route walks twice, and the
 * stretches that run along `forbidden` streets (crossing one is not a hit).
 */
export function analyzeRoute(geometry: Coordinates[], forbidden: Coordinates[][] = []): RouteQuality {
  if (geometry.length < 2) {
    return { endGapM: 0, closesLoop: true, repeatedKm: 0, repeatedPaths: [], forbiddenKm: 0, forbiddenPaths: [] };
  }
  const endGapM = haversineDistance(geometry[0], geometry[geometry.length - 1]);

  const samples = samplePath(geometry, STEP_M);
  const lookBack = Math.ceil(MIN_LOOP_M / STEP_M);
  const endSamples = Math.ceil(ENDS_M / STEP_M);
  const repeated = samples.map((point, i) => {
    if (i < endSamples || i >= samples.length - endSamples) return false;
    for (let j = 0; j < i - lookBack; j += 1) {
      if (haversineDistance(point, samples[j]) <= SAME_STREET_M) return true;
    }
    return false;
  });

  const repeatedPaths = runsOf(samples, repeated);
  const forbiddenPaths = forbidden.length
    ? runsOf(
        samples,
        samples.map((pt) => forbidden.some((way) => distanceToPolylineM(pt, way) <= SAME_STREET_M)),
      )
    : [];

  return {
    endGapM: Math.round(endGapM),
    closesLoop: endGapM <= CLOSE_M,
    repeatedKm: km(repeatedPaths),
    repeatedPaths,
    forbiddenKm: km(forbiddenPaths),
    forbiddenPaths,
  };
}
