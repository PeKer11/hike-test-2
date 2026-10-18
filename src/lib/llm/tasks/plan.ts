import { z } from "zod";

import { CANDIDATES_MAX_CHARS, fitListToChars, WALK_END_MAX_CHARS } from "../fit";
import { PLANNER_T3 } from "../prompts/planner-v1";
import type { LlmTask } from "../types";

export const planSchema = z.object({
  decision: z.enum(["plan", "ask", "decline"]),
  stops: z
    .array(
      z.object({
        placeId: z.string(),
        role: z.enum(["anchor", "rest", "food", "optional"]),
        reason: z.string().max(80),
      }),
    )
    .max(12),
  constraints: z.object({
    maxDurationMin: z.number().int().optional(),
    endBy: z.string().optional(),
    avoid: z.array(z.string().max(30)).max(6).optional(),
  }),
  question: z
    .object({ text: z.string().max(120), answers: z.array(z.string().max(30)).min(2).max(3) })
    .nullable(),
  warnings: z.array(z.object({ code: z.string().max(30), text: z.string().max(200) })).max(6),
  summary: z.string().max(240),
  draftChanges: z
    .array(z.object({ change: z.enum(["added", "removed", "reordered"]), placeId: z.string(), why: z.string().max(80) }))
    .max(12),
  injectionDetected: z.boolean(),
});

export type PlanResult = z.infer<typeof planSchema>;

export interface PlanInput {
  request: string;
  /** Candidate ids and the data the app already verified (name, tags, hazards). */
  candidates: { id: string; [k: string]: unknown }[];
  /** The tier-1 model's attempt, if any: a hypothesis, never instructions. */
  draft?: unknown;
  escalationReason: string;
  uiLang: "en" | "he";
  /** 1 when the companion may ask the walker one question, else 0. */
  askBudget: 0 | 1;
}

/** Throws (a schema failure) when the answer names a place the app never offered. */
export function parsePlan(text: string, candidateIds: readonly string[], askBudget: 0 | 1): PlanResult {
  const plan = planSchema.parse(JSON.parse(text));
  const known = new Set(candidateIds);
  if (plan.stops.some((s) => !known.has(s.placeId))) {
    throw new Error("plan: placeId is not a candidate");
  }
  if (plan.decision === "ask" && askBudget === 0) {
    throw new Error("plan: asked a question with ASK_BUDGET=0");
  }
  return plan;
}

/** Tier 3. Build this inside `maybeEscalate`'s `run` so it resolves LLM_MODEL_T3. */
export function buildPlanTask(input: PlanInput): LlmTask<PlanResult> {
  // Shorten by count, never mid-JSON; the id check below sees exactly what was sent.
  const candidates = fitListToChars(input.candidates, CANDIDATES_MAX_CHARS);
  const ids = candidates.map((c) => c.id);
  return {
    name: "plan",
    system: PLANNER_T3,
    user: [
      "TASK: plan",
      `UI_LANG: ${input.uiLang}`,
      `ASK_BUDGET: ${input.askBudget}`,
      `ESCALATION: ${input.escalationReason}`,
    ].join("\n"),
    untrusted: [
      { source: "request", text: input.request },
      { source: "candidates", text: JSON.stringify(candidates), maxChars: CANDIDATES_MAX_CHARS },
      ...(input.draft ? [{ source: "draft", text: JSON.stringify(input.draft), maxChars: WALK_END_MAX_CHARS }] : []),
    ],
    schema: planSchema,
    parse: (text) => parsePlan(text, ids, input.askBudget),
    maxOutputTokens: 900,
    tier: 3,
  };
}
