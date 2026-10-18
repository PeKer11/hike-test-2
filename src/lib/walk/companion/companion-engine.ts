import type { CalloutLevel } from "@/lib/types/discovery";

import { arbiterPolicy } from "@/lib/companion/arbiter-policy";
import type { AskPolicy } from "@/lib/companion/ports";

import { recordAsk, recordFromCandidate } from "./companion-arbiter";
import type {
  Answer,
  ArbiterCtx,
  AskHistory,
  AskPriors,
  AskRecord,
  Candidate,
} from "./companion-types";
import { resolveOperator, type OperatorAction } from "./operator-map";

export interface EngineCtx {
  level: CalloutLevel;
  nearTurn: boolean;
  crossing?: boolean;
  pausedStopId?: string | null;
  lowBattery?: boolean;
  atBreakpoint?: boolean;
  /** Another card (off-route, a place, the direction sheet) is up: never stack a question on it. */
  otherCardUp?: boolean;
}

export interface ShownQuestion {
  cand: Candidate;
  /** Fix time it went up. */
  askedAt: number;
}

export interface AnsweredQuestion {
  cand: Candidate;
  answer: Answer;
  action: OperatorAction;
}

/**
 * The state behind the single question slot: what is on screen, and the walk's
 * ask history. Every outcome (answered, ignored on timeout, cancelled) goes
 * through `recordFromCandidate` + `recordAsk`, otherwise the arbiter's
 * dismissal logic would see an empty history. All times are fix timestamps.
 */
export class CompanionEngine {
  private history: AskHistory;
  private current: ShownQuestion | null = null;

  private readonly policy: AskPolicy;

  /** `policy` defaults to the arbiter; tests and variants inject their own. */
  constructor(priors?: AskPriors, deps?: { policy?: AskPolicy }) {
    this.history = { records: [], priors };
    this.policy = deps?.policy ?? arbiterPolicy;
  }

  get question(): ShownQuestion | null {
    return this.current;
  }

  get records(): AskRecord[] {
    return this.history.records;
  }

  setPriors(priors: AskPriors): void {
    this.history = { ...this.history, priors };
  }

  /**
   * Expire a stale question (recorded as ignored), then, if the slot is free,
   * ask the arbiter. Returns whether what is on screen changed.
   */
  tick(candidates: Candidate[], ctx: EngineCtx, nowMs: number): boolean {
    let changed = false;
    if (this.current && this.current.cand.expiresAtMs <= nowMs) {
      this.finish("ignored");
      changed = true;
    }
    const { otherCardUp, ...rest } = ctx;
    const arbiterCtx: ArbiterCtx = {
      ...rest,
      questionOnScreen: this.current !== null || otherCardUp === true,
    };
    const pick = this.policy.choose(candidates, arbiterCtx, this.history, nowMs);
    if (pick) {
      this.current = { cand: pick, askedAt: nowMs };
      changed = true;
    }
    return changed;
  }

  /** The walker tapped an answer. Null when nothing is up or the id is unknown. */
  answer(answerId: string): AnsweredQuestion | null {
    if (!this.current) return null;
    const answer = this.current.cand.answers.find((a) => a.id === answerId);
    if (!answer) return null;
    const cand = this.current.cand;
    this.finish("answered", answerId);
    return { cand, answer, action: resolveOperator(answer.operator) };
  }

  /** The walk ended or the card was taken away without an answer. */
  cancel(): void {
    if (this.current) this.finish("ignored");
  }

  reset(priors?: AskPriors): void {
    this.history = { records: [], priors: priors ?? this.history.priors };
    this.current = null;
  }

  private finish(outcome: "answered" | "ignored", answerId?: string): void {
    if (!this.current) return;
    // Recorded at the time it went up: the 3-minute floor counts from there.
    const record = recordFromCandidate(this.current.cand, this.current.askedAt, outcome, answerId);
    this.history = recordAsk(this.history, record);
    this.current = null;
  }
}
