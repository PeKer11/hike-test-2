import type { Attraction } from "@/lib/types";

import { resolveT3Mode, type T3Mode } from "./config";
import {
  escalationReason,
  maybeEscalate,
  type EscalationSignals,
  type WalkEscalationLimiter,
} from "./escalation";
import { runLlm, type LlmDeps } from "./llm-client";
import { buildPlanTask, type PlanResult } from "./tasks/plan";
import type { LlmCallContext } from "./types";

/**
 * The first real tier-3 call site: after `/api/extract-places` has its stops
 * (named places the geocoder found, plus one app-found stop per stated need),
 * a prompt that states many constraints may be handed to the tier-3 planner to
 * ORDER those stops. Off unless LLM_T3_PLAN=1, and then the route behaves
 * exactly as before when nothing triggers.
 *
 * The model sees ids and app-verified fields only. It can reorder candidates
 * that already exist; it can never add, remove, rename or move one
 * (`parsePlan` rejects an unknown placeId, and `applyPlanOrder` only permutes).
 * Any failure (budget, timeout, bad JSON, unknown id) keeps the cheap result.
 * Habit data is never part of this input.
 */

export function t3PlanEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LLM_T3_PLAN?.trim() === "1";
}

/** Fewer than this and there is nothing to order. */
export const MIN_T3_CANDIDATES = 2;

/** How many separate things the walker's sentence pinned down. */
export function countStatedConstraints(s: {
  durationMinutes?: number | null;
  stopCount?: number | null;
  notableOnly?: boolean | null;
  maxEndDistanceKm?: number | null;
  searchRadiusKm?: number | null;
  needs?: readonly unknown[] | null;
}): number {
  let n = 0;
  if (s.durationMinutes != null) n += 1;
  if (s.stopCount != null) n += 1;
  if (s.notableOnly) n += 1;
  if (s.maxEndDistanceKm != null) n += 1;
  if (s.searchRadiusKm != null) n += 1;
  n += s.needs?.length ?? 0;
  return n;
}

/** What the planner may see of a stop: its id and fields the app itself produced. */
export function candidateFacts(a: Attraction, source: "named" | "need") {
  return { id: a.id, name: a.name, category: a.category, avgVisitMinutes: a.avgVisitMinutes, source };
}

/**
 * Chosen stops first, in the model's order; every other stop keeps its place
 * after them. A pure permutation: nothing is added or dropped. A plan that is
 * not a plan (ask/decline), flags injection, or names nothing changes nothing.
 */
export function applyPlanOrder(attractions: Attraction[], plan: PlanResult): Attraction[] {
  if (plan.decision !== "plan" || plan.injectionDetected) return attractions;
  const byId = new Map(attractions.map((a) => [a.id, a]));
  const chosen: Attraction[] = [];
  const seen = new Set<string>();
  for (const stop of plan.stops) {
    const a = byId.get(stop.placeId);
    if (a && !seen.has(a.id)) {
      seen.add(a.id);
      chosen.push(a);
    }
  }
  if (chosen.length === 0) return attractions;
  return [...chosen, ...attractions.filter((a) => !seen.has(a.id))];
}

export interface T3PlanOptions {
  prompt: string;
  /** Named stops first, then the need stops, as the route would return them. */
  attractions: Attraction[];
  /** Ids of the stops the app found for a stated need (the rest were named). */
  needIds: ReadonlySet<string>;
  signals: EscalationSignals;
  /** Caps `once-per-walk` mode. */
  walkKey: string;
  ctx: LlmCallContext;
  env?: Record<string, string | undefined>;
  deps?: LlmDeps;
  mode?: T3Mode;
  limiter?: WalkEscalationLimiter;
}

const HEBREW = /[֐-׿]/;

/** The attractions, possibly reordered by the tier-3 planner. Never throws. */
export async function maybeReorderWithT3(opts: T3PlanOptions): Promise<Attraction[]> {
  const env = opts.env ?? process.env;
  if (!t3PlanEnabled(env) || opts.attractions.length < MIN_T3_CANDIDATES) return opts.attractions;

  // The same code-decided trigger `maybeEscalate` applies, read here so the
  // task can carry it as its ESCALATION header.
  const reason = escalationReason(opts.signals);
  if (!reason) return opts.attractions;

  try {
    const outcome = await maybeEscalate({
      signals: opts.signals,
      walkKey: opts.walkKey,
      mode: opts.mode ?? resolveT3Mode(env),
      limiter: opts.limiter,
      run: () =>
        runLlm(
          buildPlanTask({
            request: opts.prompt,
            candidates: opts.attractions.map((a) =>
              candidateFacts(a, opts.needIds.has(a.id) ? "need" : "named"),
            ),
            draft: { order: opts.attractions.map((a) => a.id) },
            escalationReason: reason,
            uiLang: HEBREW.test(opts.prompt) ? "he" : "en",
            askBudget: 0,
          }),
          opts.ctx,
          { env, ...opts.deps },
        ),
    });
    return outcome.escalated ? applyPlanOrder(opts.attractions, outcome.result.data) : opts.attractions;
  } catch {
    return opts.attractions;
  }
}
