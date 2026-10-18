import { resolveT3Mode, type T3Mode } from "./config";
import type { LlmResult } from "./types";

/** Facts the caller already knows after a tier-1/2 call; the model never decides to escalate. */
export interface EscalationSignals {
  /** Tier-1 JSON failed validation, or the model flagged the request as needing planning. */
  invalidOrNeedsPlanning?: boolean;
  lowConfidence?: boolean;
  constraintCount?: number;
  solverNoSolution?: boolean;
  preferenceConflict?: boolean;
  nearTie?: boolean;
}

export const MAX_SIMPLE_CONSTRAINTS = 3;

/** First matching trigger, or null when the cheap model's answer stands. */
export function escalationReason(s: EscalationSignals): string | null {
  if (s.invalidOrNeedsPlanning) return "invalid-or-needs-planning";
  if (s.lowConfidence) return "low-confidence";
  if ((s.constraintCount ?? 0) > MAX_SIMPLE_CONSTRAINTS) return "many-constraints";
  if (s.solverNoSolution) return "solver-no-solution";
  if (s.preferenceConflict) return "preference-conflict";
  if (s.nearTie) return "near-tie";
  return null;
}

/** Best-effort, per process: serverless instances do not share it, the daily budget is the hard cap. */
export class WalkEscalationLimiter {
  private readonly used = new Map<string, number>();
  constructor(private readonly maxWalks = 500) {}

  tryTake(walkKey: string): boolean {
    if (this.used.has(walkKey)) return false;
    if (this.used.size >= this.maxWalks) this.used.delete(this.used.keys().next().value!);
    this.used.set(walkKey, Date.now());
    return true;
  }
}

const sharedLimiter = new WalkEscalationLimiter();

export type EscalationOutcome<U> =
  | { escalated: false; reason: string | null; skipped?: "no-trigger" | "walk-cap" }
  | { escalated: true; reason: string; result: LlmResult<U> };

/**
 * Hand a complex task to the tier-3 model. `run` builds and runs the tier-3
 * LlmTask (so it resolves LLM_MODEL_T3). Any failure returns "not escalated":
 * the caller keeps the cheap model's draft instead of failing the walk.
 */
export async function maybeEscalate<U>(opts: {
  signals: EscalationSignals;
  walkKey: string;
  run: () => Promise<LlmResult<U>>;
  mode?: T3Mode;
  limiter?: WalkEscalationLimiter;
}): Promise<EscalationOutcome<U>> {
  const reason = escalationReason(opts.signals);
  if (!reason) return { escalated: false, reason: null, skipped: "no-trigger" };

  const mode = opts.mode ?? resolveT3Mode();
  if (mode === "once-per-walk" && !(opts.limiter ?? sharedLimiter).tryTake(opts.walkKey)) {
    return { escalated: false, reason, skipped: "walk-cap" };
  }
  try {
    return { escalated: true, reason, result: await opts.run() };
  } catch (error) {
    console.warn(`T3 escalation (${reason}) failed; keeping the tier-1 draft.`, error);
    return { escalated: false, reason };
  }
}
