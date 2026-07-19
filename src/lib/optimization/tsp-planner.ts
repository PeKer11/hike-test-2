import type { Attraction, WalkPlan, WalkSegment, WalkPlanRequest } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

// ---------------------------------------------------------------------------
// Distance matrix (haversine — used for ordering only, not final geometry)
// ---------------------------------------------------------------------------

type Point = { coordinates: { lat: number; lng: number } };

function distBetween(a: Point, b: Point): number {
  return haversineDistance(a.coordinates, b.coordinates);
}

function hasFiniteCoords(p: Point): boolean {
  return Number.isFinite(p.coordinates.lat) && Number.isFinite(p.coordinates.lng);
}

function buildMatrix(origin: Point, attractions: Attraction[]): number[][] {
  const nodes: Point[] = [origin, ...attractions.filter(hasFiniteCoords)];
  const n = nodes.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distBetween(nodes[i], nodes[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// Nearest Neighbor heuristic (index 0 = origin, always fixed as start)
// ---------------------------------------------------------------------------

function nearestNeighbor(matrix: number[][], n: number): number[] {
  // Returns order of indices 1..n-1 (attractions only, origin excluded)
  const visited = new Array<boolean>(n).fill(false);
  visited[0] = true;

  const tour: number[] = [];
  let current = 0;

  for (let step = 0; step < n - 1; step++) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let j = 1; j < n; j++) {
      if (!visited[j] && Number.isFinite(matrix[current][j]) && matrix[current][j] < nearestDist) {
        nearest = j;
        nearestDist = matrix[current][j];
      }
    }

    // No unvisited reachable node found (e.g. all remaining distances are NaN)
    if (nearest === -1) break;

    visited[nearest] = true;
    tour.push(nearest);
    current = nearest;
  }

  return tour; // indices into [origin, ...attractions]
}

// ---------------------------------------------------------------------------
// 2-opt improvement (operates only on the attraction sub-tour, not origin)
// ---------------------------------------------------------------------------

function twoOpt(tour: number[], matrix: number[][], originIndex: number): number[] {
  let improved = true;
  let best = [...tour];

  while (improved) {
    improved = false;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const prev_i = i === 0 ? originIndex : best[i - 1];

        const before =
          matrix[prev_i][best[i]] +
          (j + 1 < best.length ? matrix[best[j]][best[j + 1]] : 0);
        const after =
          matrix[prev_i][best[j]] +
          (j + 1 < best.length ? matrix[best[i]][best[j + 1]] : 0);

        if (after < before - 0.1) {
          // Reverse the segment between i and j (inclusive)
          const newTour = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1),
          ];
          best = newTour;
          improved = true;
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TspResult {
  orderedAttractions: Attraction[];
  segments: WalkSegment[];
  totalDistanceMeters: number;
  totalWalkingMinutes: number;
  totalVisitMinutes: number;
  feasible: boolean;
  droppedAttractions: Attraction[];
}

export interface TspDebugResult extends TspResult {
  debug: {
    allNodes: Array<{ label: string; coordinates: { lat: number; lng: number } }>;
    matrix: number[][];
    nnTourIndices: number[];
    optimizedTourIndices: number[];
  };
}

export function planWalkOrderDebug(
  request: WalkPlanRequest,
  candidates: Attraction[],
): TspDebugResult {
  const originPoint = { coordinates: request.origin };
  const matrix = buildMatrix(originPoint, candidates);
  const n = matrix.length;
  const nnTourIndices = nearestNeighbor(matrix, n);
  const optimizedTourIndices = twoOpt([...nnTourIndices], matrix, 0);

  const base = planWalkOrder(request, candidates);

  const allNodes = [
    { label: "Start", coordinates: request.origin },
    ...candidates.map((a) => ({ label: a.name, coordinates: a.coordinates })),
  ];

  return {
    ...base,
    debug: { allNodes, matrix, nnTourIndices, optimizedTourIndices },
  };
}

export function planWalkOrder(
  request: WalkPlanRequest,
  candidates: Attraction[],
): TspResult {
  const { origin, availableMinutes, walkingPaceMinPerKm } = request;
  const originPoint = { coordinates: origin };

  if (candidates.length === 0) {
    return {
      orderedAttractions: [],
      segments: [],
      totalDistanceMeters: 0,
      totalWalkingMinutes: 0,
      totalVisitMinutes: 0,
      feasible: false,
      droppedAttractions: [],
    };
  }

  // Build distance matrix: index 0 = origin, 1..n = attractions
  const matrix = buildMatrix(originPoint, candidates);
  const n = matrix.length; // 1 (origin) + candidates.length

  // Get initial order via Nearest Neighbor
  let tourIndices = nearestNeighbor(matrix, n);

  // Improve with 2-opt
  tourIndices = twoOpt(tourIndices, matrix, 0);

  // tourIndices are 1-based indices into [origin, ...candidates]
  const ordered = tourIndices.map((i) => candidates[i - 1]);

  // Build segments and check feasibility.
  // Before dropping an over-budget attraction, try inserting it at earlier positions
  // in the already-accepted list — keep it if any earlier slot fits within budget.
  const feasibleAttractions: Attraction[] = [];
  const droppedAttractions: Attraction[] = [];

  for (const attraction of ordered) {
    // Try appending at the current end first
    const appendFits = (() => {
      const prev = feasibleAttractions.length === 0 ? originPoint : feasibleAttractions[feasibleAttractions.length - 1];
      const dist = distBetween(prev, attraction);
      const walkMin = (dist / 1000) * walkingPaceMinPerKm;
      const usedWalk = feasibleAttractions.reduce((s, _, idx) => {
        const from = idx === 0 ? originPoint : feasibleAttractions[idx - 1];
        return s + (distBetween(from, feasibleAttractions[idx]) / 1000) * walkingPaceMinPerKm;
      }, 0);
      const usedVisit = feasibleAttractions.reduce((s, a) => s + a.avgVisitMinutes, 0);
      return usedWalk + usedVisit + walkMin + attraction.avgVisitMinutes <= availableMinutes;
    })();

    if (appendFits) {
      feasibleAttractions.push(attraction);
      continue;
    }

    // Attempt reinsertion at each earlier position (MEDIUM-3)
    let inserted = false;
    for (let pos = 0; pos < feasibleAttractions.length; pos++) {
      // Build a trial list with attraction inserted at `pos`
      const trial = [
        ...feasibleAttractions.slice(0, pos),
        attraction,
        ...feasibleAttractions.slice(pos),
      ];
      // Compute total cost for the trial tour
      let trialWalk = 0;
      let trialVisit = 0;
      let prev: Point = originPoint;
      for (const a of trial) {
        trialWalk += (distBetween(prev, a) / 1000) * walkingPaceMinPerKm;
        trialVisit += a.avgVisitMinutes;
        prev = a;
      }
      if (trialWalk + trialVisit <= availableMinutes) {
        feasibleAttractions.splice(pos, 0, attraction);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      droppedAttractions.push(attraction);
    }
  }

  // Build segments from final feasibleAttractions order
  const segments: WalkSegment[] = [];
  let totalDistanceMeters = 0;
  let totalWalkingMinutes = 0;
  let totalVisitMinutes = 0;
  let prevPoint: Point = originPoint;
  let prevLabel: WalkSegment["from"] = { name: "origin", coordinates: origin };

  for (const attraction of feasibleAttractions) {
    const segDistMeters = distBetween(prevPoint, attraction);
    const segWalkMinutes = (segDistMeters / 1000) * walkingPaceMinPerKm;

    segments.push({
      from: prevLabel,
      to: attraction,
      distanceMeters: segDistMeters,
      walkingMinutes: segWalkMinutes,
    });

    totalDistanceMeters += segDistMeters;
    totalWalkingMinutes += segWalkMinutes;
    totalVisitMinutes += attraction.avgVisitMinutes;

    prevPoint = attraction;
    prevLabel = attraction;
  }

  return {
    orderedAttractions: feasibleAttractions,
    segments,
    totalDistanceMeters,
    totalWalkingMinutes,
    totalVisitMinutes,
    feasible: feasibleAttractions.length > 0,
    droppedAttractions,
  };
}

export function buildWalkPlan(
  request: WalkPlanRequest,
  candidates: Attraction[],
): WalkPlan {
  const tsp = planWalkOrder(request, candidates);

  return {
    orderedAttractions: tsp.orderedAttractions,
    segments: tsp.segments,
    totalDistanceMeters: tsp.totalDistanceMeters,
    totalMinutes: tsp.totalWalkingMinutes + tsp.totalVisitMinutes,
    feasible: tsp.feasible,
    droppedAttractions: tsp.droppedAttractions,
  };
}
