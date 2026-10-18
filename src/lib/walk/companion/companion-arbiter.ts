import { TURN_QUIET_M } from "@/lib/walk/discovery-cadence";

import type {
  ArbiterCtx,
  AskHistory,
  AskRecord,
  Candidate,
  QuestionKind,
} from "./companion-types";
import type { CalloutLevel } from "@/lib/types/discovery";

/**
 * One arbiter owns the single question slot. Pure: every clock is a fix
 * timestamp passed in, nothing here reads `Date.now()` or touches the network.
 */

/** Hard floor between any two questions, safety included. */
export const ASK_FLOOR_MS = 3 * 60_000;
/** Same kind is not asked again for this long (safety included). */
export const SAME_KIND_GAP_MS = 12 * 60_000;
/** A safety question the walker dismissed is not re-asked as safety for this long unless it escalated. */
export const DISMISSED_SAFETY_GAP_MS = 45 * 60_000;
/** Heat rise (C) that counts as an escalation. */
export const HEAT_ESCALATION_C = 2;
/** Sunset margin loss (min) that counts as an escalation. */
export const SUNSET_ESCALATION_MIN = 10;
export const HOUR_MS = 60 * 60_000;

export const GLOBAL_GAP_MS: Record<CalloutLevel, number> = {
  quiet: 10 * 60_000,
  normal: 4 * 60_000,
  chatty: 2 * 60_000,
};
/** Max questions in the trailing walk-hour. */
export const MAX_PER_HOUR: Record<CalloutLevel, number> = {
  quiet: 2,
  normal: 6,
  chatty: 10,
};
/**
 * A candidate must score above this to be spoken (urgency 3 skips it). A brand
 * new user has p(act) 0.5, so quiet at 0.4 still lets a value > 0.8 question
 * through; normal and chatty work for new users at lower values.
 */
export const THRESHOLD: Record<CalloutLevel, number> = {
  quiet: 0.4,
  normal: 0.3,
  chatty: 0.2,
};

export const COST_CROSSING = 0.3;
export const COST_PAUSED_AT_STOP = 0.5;
export const COST_LOW_BATTERY = 0.2;
/** Prefer activity breakpoints: this much cheaper when at one. */
export const BREAKPOINT_DISCOUNT = 0.1;
export const IGNORED_DAMPING = 0.3;
export const IGNORED_WINDOW = 5;
export const IGNORED_LIMIT = 3;

export { TURN_QUIET_M };

function lastOfKind(records: AskRecord[], kind: QuestionKind): AskRecord[] {
  return records.filter((r) => r.kind === kind);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Sunset margin of a candidate: minutes to sunset minus minutes of walking left. */
function sunsetMargin(cand: Candidate): number | undefined {
  const m = num(cand.context.m);
  const r = num(cand.context.r);
  return m !== undefined && r !== undefined ? m - r : undefined;
}

/** The record to append for a shown candidate, carrying what escalation needs. */
export function recordFromCandidate(
  cand: Candidate,
  askedAt: number,
  outcome: "answered" | "ignored",
  answerId?: string,
): AskRecord {
  const answer = cand.answers.find((a) => a.id === answerId);
  const rec: AskRecord = {
    kind: cand.kind,
    askedAt,
    outcome,
    urgency: cand.urgency,
    dismissed: outcome === "ignored" || answer?.operator === null || answer?.operator.op === "dismiss",
  };
  if (answerId !== undefined) rec.answerId = answerId;
  if (cand.kind === "heat-water") {
    const t = num(cand.context.t);
    if (t !== undefined) rec.heatC = t;
  }
  const margin = sunsetMargin(cand);
  if (cand.kind === "sunset" && margin !== undefined) rec.sunsetMarginMin = margin;
  return rec;
}

/** Worse than when last asked: higher urgency, heat +2 C, or sunset margin down 10 min. */
function escalated(cand: Candidate, last: AskRecord): boolean {
  if (last.urgency !== undefined && cand.urgency > last.urgency) return true;
  const t = num(cand.context.t);
  if (t !== undefined && last.heatC !== undefined && t - last.heatC >= HEAT_ESCALATION_C) {
    return true;
  }
  const margin = sunsetMargin(cand);
  return (
    margin !== undefined &&
    last.sunsetMarginMin !== undefined &&
    last.sunsetMarginMin - margin >= SUNSET_ESCALATION_MIN
  );
}

/** Laplace-smoothed answered/asked for a kind, damped when recently ignored. */
export function pAct(kind: QuestionKind, history: AskHistory): number {
  const prior = history.priors?.[kind] ?? { asked: 0, answered: 0 };
  const own = lastOfKind(history.records, kind);
  const asked = prior.asked + own.length;
  const answered = prior.answered + own.filter((r) => r.outcome === "answered").length;
  let p = (answered + 1) / (asked + 2);
  const recent = own.slice(-IGNORED_WINDOW);
  if (recent.filter((r) => r.outcome === "ignored").length >= IGNORED_LIMIT) {
    p *= IGNORED_DAMPING;
  }
  return p;
}

export function interruptCost(cand: Candidate, ctx: ArbiterCtx): number {
  let cost = 0;
  if (ctx.crossing) cost += COST_CROSSING;
  if (
    ctx.pausedStopId &&
    String(cand.context.stopId ?? "") !== ctx.pausedStopId
  ) {
    cost += COST_PAUSED_AT_STOP;
  }
  if (ctx.lowBattery) cost += COST_LOW_BATTERY;
  if (ctx.atBreakpoint) cost = Math.max(0, cost - BREAKPOINT_DISCOUNT);
  return cost;
}

export function scoreCandidate(
  cand: Candidate,
  ctx: ArbiterCtx,
  history: AskHistory,
): number {
  return cand.value * pAct(cand.kind, history) - interruptCost(cand, ctx);
}

/**
 * The one candidate to show now, or null. Gates, in order:
 *  - a question is already up -> null (at most one on screen)
 *  - within 30 m of a turn -> null (always, safety included)
 *  - the 3-minute floor since the last question -> null (always, safety included)
 *  - expired candidates dropped
 *  - same-kind gap (safety included)
 *  - non-safety: global gap per level, per-hour cap, score > theta
 * Highest urgency wins, then highest score.
 */
export function arbitrate(
  cands: Candidate[],
  ctx: ArbiterCtx,
  history: AskHistory,
  now: number,
): Candidate | null {
  if (!Number.isFinite(now)) return null;
  if (ctx.questionOnScreen || ctx.nearTurn) return null;

  const lastAskedAt = history.records.reduce(
    (m, r) => Math.max(m, r.askedAt),
    Number.NEGATIVE_INFINITY,
  );
  if (now - lastAskedAt < ASK_FLOOR_MS) return null;

  const inHour = history.records.filter((r) => now - r.askedAt < HOUR_MS).length;

  let best: { cand: Candidate; score: number } | null = null;
  for (const cand of cands) {
    if (cand.expiresAtMs <= now) continue;
    const score = scoreCandidate(cand, ctx, history);
    // Even a safety question is not repeated within the same-kind gap: an
    // answered "I'm fine" must not come back every 3 minutes. A higher
    // urgency than the last same-kind ask (2 -> 3) skips that gap, never the floor.
    const sameKind = lastOfKind(history.records, cand.kind);
    const last = sameKind.reduce<AskRecord | null>(
      (m, r) => (m === null || r.askedAt > m.askedAt ? r : m),
      null,
    );
    const safety = cand.urgency === 3;
    if (last) {
      const since = now - last.askedAt;
      const urgencyUp =
        safety && last.urgency !== undefined && cand.urgency > last.urgency;
      if (since < SAME_KIND_GAP_MS && !urgencyUp) continue;
      // A safety question that was already asked (whatever the answer: dismiss,
      // "take me there", or a timeout) comes back only if things got worse or
      // after the long gap, and then stays a safety question.
      // Checked against the last urgency-3 record of the kind, not just the last
      // record: a threshold flap (urgency 2 in between) must not bypass the gap.
      if (safety) {
        const lastSafety = sameKind.reduce<AskRecord | null>(
          (m, r) =>
            r.urgency === 3 && (m === null || r.askedAt > m.askedAt) ? r : m,
          null,
        );
        if (
          lastSafety &&
          !escalated(cand, lastSafety) &&
          now - lastSafety.askedAt < DISMISSED_SAFETY_GAP_MS
        ) {
          continue;
        }
      }
    }
    if (!safety) {
      if (now - lastAskedAt < GLOBAL_GAP_MS[ctx.level]) continue;
      if (inHour >= MAX_PER_HOUR[ctx.level]) continue;
      if (score <= THRESHOLD[ctx.level]) continue;
    }
    if (
      best === null ||
      cand.urgency > best.cand.urgency ||
      (cand.urgency === best.cand.urgency && score > best.score)
    ) {
      best = { cand, score };
    }
  }
  return best?.cand ?? null;
}

/** Append a question's outcome (answered, or ignored when it timed out). */
export function recordAsk(history: AskHistory, record: AskRecord): AskHistory {
  return { ...history, records: [...history.records, record] };
}
