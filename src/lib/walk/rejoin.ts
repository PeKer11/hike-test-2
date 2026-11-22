import type { Coordinates } from "@/lib/types";
import {
  bearingBetween,
  closestPointOnSegment,
  haversineDistance,
} from "@/lib/utils/geo";
import { relativeBearing } from "@/lib/walk/poi-relation";
import { walkCopy } from "@/lib/walk/walk-copy";
import { LOCAL_REJOIN_COOLDOWN_MS } from "@/lib/walk/walk-cadence";

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
): { kind: TurnKind; text: string; distanceM: number; bearing: number } {
  const distanceM = haversineDistance(pos, target);
  const bearing = bearingBetween(pos, target);

  if (headingDeg === null) {
    return { kind: "compass", text: walkCopy.turn.compass(bearing, distanceM), distanceM, bearing };
  }

  const rel = relativeBearing(headingDeg, bearing);
  if (Math.abs(rel) <= 30) {
    return { kind: "straight", text: walkCopy.turn.straight(distanceM), distanceM, bearing };
  }
  if (rel > 30 && rel <= 150) {
    return { kind: "right", text: walkCopy.turn.right(distanceM), distanceM, bearing };
  }
  if (rel < -30 && rel >= -150) {
    return { kind: "left", text: walkCopy.turn.left(distanceM), distanceM, bearing };
  }
  return { kind: "around", text: walkCopy.turn.around(distanceM), distanceM, bearing };
}

/**
 * How a "Back to my route" attempt ended. Every outcome but `routed` is a reason nothing was drawn,
 * and the walker is told which one (a sheet notice), so a tap is never silent.
 *
 * - `routed`: a street way back was spliced in front of the rest of the route.
 * - `busy`: another way back is still being routed.
 * - `cooldown`: an automatic attempt came within a minute of a successful one.
 * - `collapsing`: direction options are pending or on screen (an automatic attempt stands aside).
 * - `stale`: no usable GPS fix lately, so a connector would start where the walker was.
 * - `failed`: no street way back; the failure was handed to the collapse (direction options).
 * - `rebuilding`: a full re-plan from here was started instead.
 * - `ended`: the walk ended, or its route was replaced, while this was in flight.
 */
export type RejoinOutcome = "routed" | "busy" | "cooldown" | "collapsing" | "stale" | "failed" | "rebuilding" | "ended";

export interface RejoinGateInput {
  /** The walker tapped "Back to my route" (as opposed to the silence timeout answering for them). */
  manual: boolean;
  inFlight: boolean;
  /** Direction options are being fetched or are on screen. */
  collapsed: boolean;
  /** No engine-grade fix in the last 20 s (or none at all). */
  fixStale: boolean;
  /** Fix-clock ms since the last successful way back; `Infinity` when there has been none. */
  sinceLastRejoinMs: number;
}

/**
 * The guards in front of a way-back attempt, in order. A tap is the walker's own decision, so it
 * skips the one-a-minute cooldown (a second stray inside that minute used to be a dead button) and
 * cancels a pending collapse rather than being refused by it; but it never splices from a stale fix.
 * `null` means go ahead.
 */
export function rejoinBlock(input: RejoinGateInput): RejoinOutcome | null {
  if (input.inFlight) return "busy";
  if (input.collapsed && !input.manual) return "collapsing";
  if (input.manual && input.fixStale) return "stale";
  if (!input.manual && input.sinceLastRejoinMs < LOCAL_REJOIN_COOLDOWN_MS) return "cooldown";
  return null;
}

/** A connector that starts further than this from the walker begins at a street they are not on yet. */
export const WALK_TO_ROAD_FIRST_M = 40;

/** Length of a drawn connector, metres. */
export function pathLengthM(path: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversineDistance(path[i - 1], path[i]);
  return total;
}

/**
 * Preview deployments name the outcome at the end of the notice, so the next field test says exactly
 * which path a tap took. Production text is untouched.
 */
export function withOutcomeTag(text: string, outcome: RejoinOutcome, preview: boolean): string {
  return preview ? `${text} [${outcome}]` : text;
}
