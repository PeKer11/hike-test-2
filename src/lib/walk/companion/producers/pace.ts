import type { Answer, Candidate } from "../companion-types";

export interface PaceStop {
  id: string;
  name: string;
  pinned?: boolean;
}

export interface PaceProducerInput {
  advice: "slow" | "fast";
  currentPaceMinPerKm: number;
  plannedPaceMinPerKm: number;
  /** Minutes the plan still has left at the planned pace. */
  remainingPlannedMin: number;
  /** Stops still ahead, in visit order. */
  remainingStops: PaceStop[];
  /** Fast only: a collection place worth adding. */
  addPlace?: { name: string; detourMin: number };
  nowMs: number;
  ttlMs?: number;
}

export const PACE_QUESTION_TTL_MS = 60_000;

const DISMISS: Answer = { id: "dismiss", label: "answer.notNow", operator: { op: "dismiss" } };

/** Slow: min(1, projectedOverrun / 20). Fast: spare minutes / 30, needs a place to add. */
export function paceCandidate(input: PaceProducerInput): Candidate | null {
  const { currentPaceMinPerKm: cur, plannedPaceMinPerKm: planned } = input;
  if (!(cur > 0) || !(planned > 0) || !(input.remainingPlannedMin > 0)) return null;
  const ratio = cur / planned;
  const expiresAtMs = input.nowMs + (input.ttlMs ?? PACE_QUESTION_TTL_MS);

  if (input.advice === "slow") {
    const overrunMin = input.remainingPlannedMin * (ratio - 1);
    if (overrunMin <= 0) return null;
    // Never offer to drop the only stop left: an empty list makes the planner rediscover.
    const droppable =
      input.remainingStops.length > 1
        ? [...input.remainingStops].reverse().find((s) => !s.pinned)
        : undefined;
    const extendMin = Math.max(1, Math.round(overrunMin));
    const answers: Answer[] = [
      {
        id: "shorten",
        label: "answer.shorten",
        operator: { op: "shorten", dropStopIds: droppable ? [droppable.id] : undefined },
      },
      { id: "keep-all", label: "answer.keepAll", operator: { op: "keep-all-extend" } },
      DISMISS,
    ];
    return {
      kind: "pace-slow",
      urgency: 1,
      value: Math.min(1, overrunMin / 20),
      answers,
      expiresAtMs,
      context: { stop: droppable?.name ?? "", n: extendMin },
    };
  }

  const spareMin = input.remainingPlannedMin * (1 - ratio);
  if (spareMin <= 0 || !input.addPlace) return null;
  return {
    kind: "pace-fast",
    urgency: 1,
    value: Math.min(1, spareMin / 30),
    answers: [
      { id: "add", label: "answer.add", operator: { op: "extend", addFrom: "collection" } },
      { id: "finish-early", label: "answer.finishEarly", operator: { op: "head-back" } },
    ],
    expiresAtMs,
    context: { place: input.addPlace.name, d: Math.max(1, Math.round(input.addPlace.detourMin)) },
  };
}
