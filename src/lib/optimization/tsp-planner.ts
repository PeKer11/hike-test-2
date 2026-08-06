import { getMatrix } from "@/lib/api/ors-client";
import type { Attraction, WalkPlan, WalkSegment, WalkPlanRequest } from "@/lib/types";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";

// ---------------------------------------------------------------------------
// Distance matrix (real ORS walking-network metres, haversine as fallback —
// used for ordering only, not final geometry)
// ---------------------------------------------------------------------------

type Point = { coordinates: { lat: number; lng: number } };

function distBetween(a: Point, b: Point): number {
  return haversineDistance(a.coordinates, b.coordinates);
}

function hasFiniteCoords(p: Point): boolean {
  return Number.isFinite(p.coordinates.lat) && Number.isFinite(p.coordinates.lng);
}

function buildHaversineMatrix(nodes: Point[]): number[][] {
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

// Callers must pass attractions that already passed `hasFiniteCoords`, otherwise
// the matrix indices stop lining up with the caller's attraction array.
//
// Aerial distance can order stops that are minutes apart in a straight line but
// a long detour on foot, so the ordering runs on real walking-network metres.
// The straight line stays as the fallback: a slightly worse order beats no walk
// at all, so ORS being down or slow must never fail `planWalkOrder`.
async function buildMatrix(origin: Point, attractions: Attraction[]): Promise<number[][]> {
  const nodes: Point[] = [origin, ...attractions];
  const fallback = buildHaversineMatrix(nodes);

  // ORS rejects a single-location matrix, and there is nothing to order anyway.
  if (nodes.length < 2) return fallback;

  try {
    const { distances } = await getMatrix({
      // ORS wants [lng, lat] (PROBLEMS.md — "Coordinate Order Confusion").
      // Never hand-swap: `toOrsCoord()` is the only place that ordering lives.
      locations: nodes.map((node) => toOrsCoord(node.coordinates)),
      profile: "foot-walking",
    });

    if (!Array.isArray(distances) || distances.length !== nodes.length) {
      return fallback;
    }

    return distances.map((row, i) => {
      if (!Array.isArray(row) || row.length !== nodes.length) return fallback[i];
      // ORS returns `null` for a pair it could not route between — fill just
      // that cell from the straight line rather than throwing the matrix away.
      return row.map((d, j) => (typeof d === "number" && Number.isFinite(d) ? d : fallback[i][j]));
    });
  } catch {
    return fallback;
  }
}

// Distances are read back by node object, so the ordering, the budget check and
// the reported segments all quote the same matrix the tour was chosen from.
function matrixDistance(
  matrix: number[][],
  nodes: Point[],
): (a: Point, b: Point) => number {
  const indexOf = new Map<Point, number>(nodes.map((node, i) => [node, i]));

  return (a, b) => {
    const i = indexOf.get(a);
    const j = indexOf.get(b);
    return i === undefined || j === undefined ? distBetween(a, b) : matrix[i][j];
  };
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
// End-distance-from-origin constraint
// ---------------------------------------------------------------------------

/** Walking plus visit minutes for a tour starting at the origin. */
function tourMinutes(
  ordered: Attraction[],
  originPoint: Point,
  dist: (a: Point, b: Point) => number,
  walkingPaceMinPerKm: number,
): number {
  let total = 0;
  let prev: Point = originPoint;

  for (const attraction of ordered) {
    total += (dist(prev, attraction) / 1000) * walkingPaceMinPerKm;
    total += attraction.avgVisitMinutes;
    prev = attraction;
  }

  return total;
}

/**
 * Where the end-distance constraint is measured from. `origin` is where this
 * particular plan starts, which a mid-walk rebuild moves to the walker's
 * current position — `endAnchor` is the fixed place they want to finish near.
 */
function endAnchorOf(request: WalkPlanRequest): { lat: number; lng: number } {
  return request.endAnchor ?? request.origin;
}

/** Straight-line metres from the tour's last stop back to the anchor. */
function endDistanceMeters(
  ordered: Attraction[],
  anchor: { lat: number; lng: number },
): number {
  const last = ordered[ordered.length - 1];
  // Deliberately haversine and not the matrix: the constraint is "how far am I
  // from my car when I stop walking", which is a distance on the ground, not a
  // walking-route length. It matches the fallback convention in this file too.
  return last ? haversineDistance(anchor, last.coordinates) : 0;
}

/** Whether the walk finishes inside the stated end-distance constraint (or has none). */
function endsWithinConstraint(
  ordered: Attraction[],
  request: WalkPlanRequest,
): boolean {
  const limitMeters = request.maxEndDistanceFromOriginMeters;
  if (limitMeters === undefined || !Number.isFinite(limitMeters) || limitMeters < 0) {
    return true;
  }

  return endDistanceMeters(ordered, endAnchorOf(request)) <= limitMeters;
}

/**
 * The cheapest rearrangement that finishes inside the constraint, or null if
 * none is worth what it costs.
 *
 * Only "move one stop to the end" is tried, rather than a general re-search.
 * 2-opt has already picked a good order and every candidate here is a stop the
 * walk was going to make anyway — the question is only which one it makes
 * last. Trying every permutation to shave a few metres off a tour that is
 * about to be handed to a human is not worth the factorial.
 *
 * The time budget is the cost threshold. A rearrangement is a detour by
 * definition, and the honest limit on how much detour is acceptable is the one
 * the walker already stated: the time they have. A tour that was already over
 * budget (a pin can do that) is held to its own length instead, so this can
 * never make an over-budget walk longer.
 */
function bestEndDistanceReorder(
  ordered: Attraction[],
  request: WalkPlanRequest,
  originPoint: Point,
  dist: (a: Point, b: Point) => number,
  limitMeters: number,
  budgetMinutes: number,
): Attraction[] | null {
  let best: Attraction[] | null = null;
  let bestDistance = Infinity;
  const anchor = endAnchorOf(request);

  for (let i = 0; i < ordered.length - 1; i++) {
    if (haversineDistance(anchor, ordered[i].coordinates) > limitMeters) {
      continue;
    }

    const trial = [...ordered.slice(0, i), ...ordered.slice(i + 1), ordered[i]];
    if (
      tourMinutes(trial, originPoint, dist, request.walkingPaceMinPerKm) >
      budgetMinutes + 1e-6
    ) {
      continue;
    }

    let trialDistance = 0;
    let prev: Point = originPoint;
    for (const attraction of trial) {
      trialDistance += dist(prev, attraction);
      prev = attraction;
    }

    if (trialDistance < bestDistance) {
      best = trial;
      bestDistance = trialDistance;
    }
  }

  return best;
}

/**
 * Make the walk actually end within `maxEndDistanceFromOriginMeters` of where
 * it started, by rearranging if that is affordable and by dropping the stops
 * that strand the walker if it is not.
 *
 * Reordering is tried first because it costs the walker nothing: every stop is
 * still visited, just in a different order. Only when no affordable
 * arrangement finishes in range does this start trimming from the end — one
 * stop at a time, re-checking after each, since dropping the far stop often
 * leaves a new last stop that is already in range.
 *
 * A pinned stop is the one thing that can defeat the constraint, exactly as it
 * is the one thing that can defeat the time budget: the walker asked for that
 * place by name, and silently dropping it to honour a radius they typed into a
 * secondary field is the wrong trade. `feasible` goes false instead, which is
 * the same signal an over-budget pin already raises.
 */
function enforceEndDistance(
  ordered: Attraction[],
  request: WalkPlanRequest,
  originPoint: Point,
  dist: (a: Point, b: Point) => number,
  pinnedIds: Set<string>,
): { ordered: Attraction[]; dropped: Attraction[] } {
  const limitMeters = request.maxEndDistanceFromOriginMeters;
  const dropped: Attraction[] = [];

  if (
    limitMeters === undefined ||
    !Number.isFinite(limitMeters) ||
    limitMeters < 0
  ) {
    return { ordered, dropped };
  }

  let current = [...ordered];
  const anchor = endAnchorOf(request);
  const budgetMinutes = Math.max(
    request.availableMinutes,
    tourMinutes(current, originPoint, dist, request.walkingPaceMinPerKm),
  );

  while (
    current.length > 0 &&
    endDistanceMeters(current, anchor) > limitMeters
  ) {
    const reordered = bestEndDistanceReorder(
      current,
      request,
      originPoint,
      dist,
      limitMeters,
      budgetMinutes,
    );

    if (reordered) {
      current = reordered;
      break;
    }

    const last = current[current.length - 1];
    if (pinnedIds.has(last.id)) {
      break;
    }

    current.pop();
    dropped.push(last);
  }

  return { ordered: current, dropped };
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

export async function planWalkOrderDebug(
  request: WalkPlanRequest,
  candidates: Attraction[],
): Promise<TspDebugResult> {
  const originPoint = { coordinates: request.origin };
  const plottable = candidates.filter(hasFiniteCoords);
  const matrix = await buildMatrix(originPoint, plottable);
  const n = matrix.length;
  const nnTourIndices = nearestNeighbor(matrix, n);
  const optimizedTourIndices = twoOpt([...nnTourIndices], matrix, 0);

  // Debug-only second matrix call; the production path builds exactly one.
  const base = await planWalkOrder(request, candidates);

  const allNodes = [
    { label: "Start", coordinates: request.origin },
    ...plottable.map((a) => ({ label: a.name, coordinates: a.coordinates })),
  ];

  return {
    ...base,
    debug: { allNodes, matrix, nnTourIndices, optimizedTourIndices },
  };
}

export async function planWalkOrder(
  request: WalkPlanRequest,
  candidates: Attraction[],
): Promise<TspResult> {
  const { origin, availableMinutes, walkingPaceMinPerKm } = request;
  const originPoint = { coordinates: origin };
  const pinnedIds = new Set(request.pinnedAttractionIds ?? []);
  // Attractions with broken coordinates can't be ordered or measured — keep them
  // out of the matrix (and out of the tour) so matrix indices stay aligned.
  const usable = candidates.filter(hasFiniteCoords);
  const unusable = candidates.filter((a) => !hasFiniteCoords(a));

  if (usable.length === 0) {
    return {
      orderedAttractions: [],
      segments: [],
      totalDistanceMeters: 0,
      totalWalkingMinutes: 0,
      totalVisitMinutes: 0,
      feasible: false,
      droppedAttractions: unusable,
    };
  }

  // Build distance matrix: index 0 = origin, 1..n = attractions
  const matrix = await buildMatrix(originPoint, usable);
  const n = matrix.length; // 1 (origin) + usable.length
  const dist = matrixDistance(matrix, [originPoint, ...usable]);

  // Get initial order via Nearest Neighbor
  let tourIndices = nearestNeighbor(matrix, n);

  // Improve with 2-opt
  tourIndices = twoOpt(tourIndices, matrix, 0);

  // tourIndices are 1-based indices into [origin, ...usable]
  const ordered = tourIndices.map((i) => usable[i - 1]);

  // Build segments and check feasibility.
  // Before dropping an over-budget attraction, try inserting it at earlier positions
  // in the already-accepted list — keep it if any earlier slot fits within budget.
  const feasibleAttractions: Attraction[] = [];
  // Unusable coordinates, plus anything Nearest Neighbor could not reach, are
  // dropped up front rather than disappearing from the result silently.
  const droppedAttractions: Attraction[] = [
    ...unusable,
    ...usable.filter((a) => !ordered.includes(a)),
  ];

  for (const attraction of ordered) {
    // A pinned attraction is kept no matter what the budget says — going over
    // budget is reported through `feasible` so the UI can ask the user.
    if (pinnedIds.has(attraction.id)) {
      feasibleAttractions.push(attraction);
      continue;
    }

    // Try appending at the current end first
    const appendFits = (() => {
      const prev = feasibleAttractions.length === 0 ? originPoint : feasibleAttractions[feasibleAttractions.length - 1];
      const legMeters = dist(prev, attraction);
      const walkMin = (legMeters / 1000) * walkingPaceMinPerKm;
      const usedWalk = feasibleAttractions.reduce((s, _, idx) => {
        const from = idx === 0 ? originPoint : feasibleAttractions[idx - 1];
        return s + (dist(from, feasibleAttractions[idx]) / 1000) * walkingPaceMinPerKm;
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
        trialWalk += (dist(prev, a) / 1000) * walkingPaceMinPerKm;
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

  // Only now, once the budget pass has settled which stops are actually on the
  // walk, is there a final stop whose distance from the origin means anything.
  const endConstrained = enforceEndDistance(
    feasibleAttractions,
    request,
    originPoint,
    dist,
    pinnedIds,
  );
  const finalAttractions = endConstrained.ordered;
  droppedAttractions.push(...endConstrained.dropped);

  // Build segments from the final order
  const segments: WalkSegment[] = [];
  let totalDistanceMeters = 0;
  let totalWalkingMinutes = 0;
  let totalVisitMinutes = 0;
  let prevPoint: Point = originPoint;
  let prevLabel: WalkSegment["from"] = { name: "origin", coordinates: origin };

  for (const attraction of finalAttractions) {
    const segDistMeters = dist(prevPoint, attraction);
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
    orderedAttractions: finalAttractions,
    segments,
    totalDistanceMeters,
    totalWalkingMinutes,
    totalVisitMinutes,
    // Without pins neither pass above lets the total exceed the budget or the
    // walk end out of range, so these only turn false when a pinned attraction
    // no longer fits the remaining time, or strands the walker at the end.
    feasible:
      finalAttractions.length > 0 &&
      totalWalkingMinutes + totalVisitMinutes <= availableMinutes + 1e-6 &&
      endsWithinConstraint(finalAttractions, request),
    droppedAttractions,
  };
}

export async function buildWalkPlan(
  request: WalkPlanRequest,
  candidates: Attraction[],
): Promise<WalkPlan> {
  const tsp = await planWalkOrder(request, candidates);

  return {
    orderedAttractions: tsp.orderedAttractions,
    segments: tsp.segments,
    totalDistanceMeters: tsp.totalDistanceMeters,
    totalMinutes: tsp.totalWalkingMinutes + tsp.totalVisitMinutes,
    feasible: tsp.feasible,
    droppedAttractions: tsp.droppedAttractions,
  };
}
