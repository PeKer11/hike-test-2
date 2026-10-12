import type { CalloutLevel } from "@/lib/types/discovery";

/** Every question the companion can put to the walker. One arbiter owns the slot. */
export type QuestionKind =
  | "pace-slow"
  | "pace-fast"
  | "toward-green"
  | "sunset"
  | "heat-water"
  | "rest"
  | "stop-closing"
  | "rain";

export type AmenityKind = "drinking_water" | "toilets" | "bench" | "shade" | "cafe";

/**
 * What an answer does to the plan. Each op maps to a rebuild that already
 * exists, or to the new drop-stops planner-actions builder (see
 * `operator-map.ts`, which is exhaustive over this union).
 */
export type PlanOperator =
  | { op: "shorten"; dropStopIds?: string[]; capMin?: number }
  | { op: "keep-all-extend" }
  | { op: "extend"; addFrom: "collection" }
  | { op: "loop-from-here"; theme: "nature" }
  | { op: "find-amenity"; kind: AmenityKind }
  | { op: "head-back" }
  | { op: "dismiss" };

/** A numeric, consent-gated behaviour signal. Never free text. */
export interface MemorySignal {
  kind: QuestionKind;
  answerId: string;
  /** "dismiss"-style answers still count as answered; only a timeout is ignored. */
  outcome: "answered" | "ignored";
}

export interface Answer {
  id: string;
  /** Key into `companion-copy.ts`. */
  label: string;
  operator: PlanOperator | null;
}

export interface Candidate {
  kind: QuestionKind;
  /** 3 = safety: bypasses quotas, never the 3-minute floor. */
  urgency: 0 | 1 | 2 | 3;
  /** Expected benefit 0..1. */
  value: number;
  /** 2-3 answers. */
  answers: Answer[];
  /** Fix timestamp (ms) after which the question is stale. */
  expiresAtMs: number;
  /** Interpolation values for the copy. */
  context: Record<string, string | number>;
}

export interface AskRecord {
  kind: QuestionKind;
  /** Fix timestamp, ms. */
  askedAt: number;
  outcome: "answered" | "ignored";
  urgency?: 0 | 1 | 2 | 3;
  /** Which answer was tapped (absent when ignored). */
  answerId?: string;
  /** Answered with a dismiss-type operator (or ignored): the walker waved it off. */
  dismissed?: boolean;
  /** Apparent temperature (C) when asked (heat-water). */
  heatC?: number;
  /** Minutes to sunset minus minutes of walking left when asked (sunset). */
  sunsetMarginMin?: number;
}

/** Cross-walk answer stats per kind (from memory), the pAct prior. */
export type AskPriors = Partial<Record<QuestionKind, { asked: number; answered: number }>>;

export interface AskHistory {
  /** This walk's questions, oldest first. */
  records: AskRecord[];
  priors?: AskPriors;
}

export interface ArbiterCtx {
  level: CalloutLevel;
  /** A question card is on screen right now. */
  questionOnScreen: boolean;
  /** Within `TURN_QUIET_M` of a route turn (`isNearTurn`). */
  nearTurn: boolean;
  /** Probably crossing a road (speed spike after a pause). Heuristic. */
  crossing?: boolean;
  /** Paused at a stop; the question is exempt if it is about that stop. */
  pausedStopId?: string | null;
  /** Battery below 20% (Chromium only; omit when unknown). */
  lowBattery?: boolean;
  /** Just arrived at / left a stop, finished a turn, or resumed from a pause. */
  atBreakpoint?: boolean;
}
