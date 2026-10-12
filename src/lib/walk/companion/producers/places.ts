import type { Candidate } from "../companion-types";

export const TOWARD_GREEN_MIN_M = 60;
const TTL_MS = 60_000;

/** toward-green: only after >= 60 m of heading toward it. value = score / 3. */
export function towardGreenCandidate(args: {
  parkName: string;
  /** DiscoveryItem.score of the green place. */
  score: number;
  /** Metres walked continuously heading toward it. */
  headingTowardM: number;
  nowMs: number;
}): Candidate | null {
  if (args.headingTowardM < TOWARD_GREEN_MIN_M) return null;
  const value = Math.max(0, Math.min(1, args.score / 3));
  if (value <= 0) return null;
  return {
    kind: "toward-green",
    urgency: 0,
    value,
    answers: [
      {
        id: "loop",
        label: "answer.loopFromHere",
        operator: { op: "loop-from-here", theme: "nature" },
      },
      { id: "back", label: "answer.backToRoute", operator: { op: "dismiss" } },
    ],
    expiresAtMs: args.nowMs + TTL_MS,
    context: { park: args.parkName },
  };
}

/** stop-closing: when the stop shuts before the walker would get there plus slack. */
export const CLOSING_SLACK_MIN = 15;

/**
 * Last stop left and it is closing: nothing to skip, so info only
 * ("closes at {hhmm}", single OK answer). Null when not tight, or >1 stops left.
 */
export function stopClosingInfoCandidate(args: {
  stopId: string;
  stopName: string;
  remainingStopCount: number;
  closesAtMs: number;
  closesAtHhmm: string;
  etaMin: number;
  nowMs: number;
}): Candidate | null {
  if (args.remainingStopCount !== 1) return null;
  const minutesLeft = (args.closesAtMs - args.nowMs) / 60_000;
  if (minutesLeft <= 0) return null;
  const margin = minutesLeft - args.etaMin;
  if (margin > CLOSING_SLACK_MIN) return null;
  const value = Math.max(0, Math.min(1, 1 - margin / (2 * CLOSING_SLACK_MIN)));
  if (value <= 0) return null;
  return {
    kind: "stop-closing",
    urgency: 1,
    value,
    answers: [{ id: "ok", label: "answer.ok", operator: { op: "dismiss" } }],
    expiresAtMs: args.nowMs + TTL_MS,
    context: { stop: args.stopName, stopId: args.stopId, hhmm: args.closesAtHhmm, info: 1 },
  };
}

export function stopClosingCandidate(args: {
  stopId: string;
  stopName: string;
  /** Stops still ahead, including this one. Skipping the only one left is not offered. */
  remainingStopCount: number;
  closesAtMs: number;
  /** Local closing time as "HH:MM", formatted by the caller (no timezone logic here). */
  closesAtHhmm: string;
  etaMin: number;
  nowMs: number;
}): Candidate | null {
  if (args.remainingStopCount <= 1) return null;
  const minutesLeft = (args.closesAtMs - args.nowMs) / 60_000;
  if (minutesLeft <= 0) return null;
  const margin = minutesLeft - args.etaMin;
  if (margin > CLOSING_SLACK_MIN) return null;
  const value = Math.max(0, Math.min(1, 1 - margin / (2 * CLOSING_SLACK_MIN)));
  if (value <= 0) return null;
  return {
    kind: "stop-closing",
    urgency: 1,
    value,
    answers: [
      {
        id: "skip",
        label: "answer.skip",
        operator: { op: "shorten", dropStopIds: [args.stopId] },
      },
      { id: "keep", label: "answer.notNow", operator: { op: "dismiss" } },
    ],
    expiresAtMs: args.nowMs + TTL_MS,
    context: { stop: args.stopName, stopId: args.stopId, hhmm: args.closesAtHhmm },
  };
}
