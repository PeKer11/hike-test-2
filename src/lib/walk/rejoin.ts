import type { Coordinates } from "@/lib/types";
import {
  bearingBetween,
  closestPointOnSegment,
  haversineDistance,
} from "@/lib/utils/geo";
import { relativeBearing } from "@/lib/walk/poi-relation";
import { walkCopy } from "@/lib/walk/walk-copy";

export interface RejoinCandidate {
  point: Coordinates;
  /** Index of the geometry segment `point` lies on. */
  segmentIndex: number;
  /** Route distance from the walker's matched point to `point`, metres. */
  alongM: number;
}

const SAMPLE_STEP_M = 20;
const MAX_LOOKAHEAD_M = 500;
const CROW_TO_STREET = 1.3;
const MAX_CANDIDATES = 2;
// Two candidates a few metres apart make the second ORS call pointless.
const MIN_CANDIDATE_SEPARATION_M = 60;

/**
 * Points on the planned route the walker could rejoin at: sampled every 20 m
 * ahead of where they are matched, scored by (crow-flies distance x 1.3) minus
 * how far along the route the point is — near me and far ahead is best — and the
 * best two returned.
 *
 * `nextStopAlongM` is how far (along the route, from the matched point) the next
 * unvisited stop is, or null if there is none: candidates never go past it, so a
 * rejoin cannot skip a stop. They never go behind `segmentIndex` either.
 */
export function rejoinCandidates(
  pos: Coordinates,
  geometry: Coordinates[],
  segmentIndex: number,
  nextStopAlongM: number | null,
): RejoinCandidate[] {
  if (geometry.length < 2) return [];
  const startSeg = Math.min(Math.max(segmentIndex, 0), geometry.length - 2);
  const limit = Math.min(
    MAX_LOOKAHEAD_M,
    nextStopAlongM === null ? MAX_LOOKAHEAD_M : Math.max(0, nextStopAlongM),
  );

  const matched = closestPointOnSegment(
    pos,
    geometry[startSeg],
    geometry[startSeg + 1],
  );

  const samples: RejoinCandidate[] = [
    { point: matched, segmentIndex: startSeg, alongM: 0 },
  ];

  // Walk the route from the matched point, dropping a sample every 20 m.
  let along = 0;
  let nextSampleAt = SAMPLE_STEP_M;
  let from = matched;
  for (let seg = startSeg; seg < geometry.length - 1 && nextSampleAt <= limit; seg += 1) {
    const to = geometry[seg + 1];
    const segLen = haversineDistance(from, to);
    while (segLen > 0 && nextSampleAt <= limit && nextSampleAt <= along + segLen) {
      const t = (nextSampleAt - along) / segLen;
      samples.push({
        point: {
          lat: from.lat + t * (to.lat - from.lat),
          lng: from.lng + t * (to.lng - from.lng),
        },
        segmentIndex: seg,
        alongM: nextSampleAt,
      });
      nextSampleAt += SAMPLE_STEP_M;
    }
    along += segLen;
    from = to;
  }

  const ranked = samples
    .map((c) => ({
      c,
      score: haversineDistance(pos, c.point) * CROW_TO_STREET - c.alongM,
    }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.c);

  const picked: RejoinCandidate[] = [];
  for (const c of ranked) {
    if (picked.every((p) => Math.abs(p.alongM - c.alongM) >= MIN_CANDIDATE_SEPARATION_M)) {
      picked.push(c);
      if (picked.length === MAX_CANDIDATES) break;
    }
  }
  return picked;
}

/** A way back that is much longer than the crow-flies gap is a detour, not a rejoin. */
export function isPlausibleConnector(connectorM: number, crowM: number): boolean {
  return connectorM <= 2 * crowM + 100;
}

/** The route from here on: the connector, then the old route after the rejoin point. */
export function spliceRoute(
  geometry: Coordinates[],
  candidate: RejoinCandidate,
  connector: Coordinates[],
): Coordinates[] {
  return [
    ...connector,
    candidate.point,
    ...geometry.slice(candidate.segmentIndex + 1),
  ];
}

export type TurnKind = "straight" | "left" | "right" | "around" | "compass";

/**
 * What to tell a walker who needs to get to `target`. With a heading it is a
 * turn; without one (standing still, no recent movement) it is a compass
 * direction, because "left" relative to nothing is meaningless.
 */
export function turnInstruction(
  headingDeg: number | null,
  pos: Coordinates,
  target: Coordinates,
): { kind: TurnKind; text: string } {
  const distanceM = haversineDistance(pos, target);
  const bearing = bearingBetween(pos, target);

  if (headingDeg === null) {
    return { kind: "compass", text: walkCopy.turn.compass(bearing, distanceM) };
  }

  const rel = relativeBearing(headingDeg, bearing);
  if (Math.abs(rel) <= 30) {
    return { kind: "straight", text: walkCopy.turn.straight(distanceM) };
  }
  if (rel > 30 && rel <= 150) {
    return { kind: "right", text: walkCopy.turn.right(distanceM) };
  }
  if (rel < -30 && rel >= -150) {
    return { kind: "left", text: walkCopy.turn.left(distanceM) };
  }
  return { kind: "around", text: walkCopy.turn.around(distanceM) };
}
