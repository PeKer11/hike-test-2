import type { ProviderChoice } from "@/lib/llm/config";
import { estimateCostMicros } from "@/lib/llm/pricing";
import { callOpenAiTools, type ChatMessage } from "@/lib/llm/providers/openai-tools";
import { TURN_ROUTING_CALLS } from "@/lib/assistant/route-check";
import type { AssistantState, Candidate, WalkParams } from "@/lib/assistant/state";
import { ASSISTANT_TOOLS, runTool } from "@/lib/assistant/tools";
import type { Attraction, Coordinates } from "@/lib/types";
import { makeBudget } from "@/lib/walk/routing-budget";

import { AI_BUILDER_SYSTEM } from "./prompt";

const MAX_MODEL_CALLS = 16;
const MAX_OUTPUT_TOKENS = 700;
const TIMEOUT_MS = 100_000;
const TOOLS = new Set(["search_place", "find_nearby", "set_walk_params", "estimate_walk", "find_clean_walk", "check_weather", "check_safety", "build_walk"]);

export interface AiBuildRequest {
  origin: Coordinates;
  /** Where the walker is now when it differs from the start (mid-walk re-plan). */
  reason: string;
  params: WalkParams;
  keep: Attraction[];
  pinnedIds: string[];
  visitedIds: string[];
  preferredCategories?: string[];
  stopCount?: number;
  notableOnly?: boolean;
  heading?: number;
  fillRemainingTime?: boolean;
}

export interface AiBuildResult {
  stops: Attraction[];
  ordered: boolean;
  geometry?: Coordinates[];
  params: WalkParams;
  summary: string;
  billedMicros: number;
}

function toAttraction(c: Candidate, kept: Map<string, Attraction>): Attraction {
  const original = kept.get(c.id);
  if (original) return original;
  return {
    id: `ai-${c.placeId || c.id}`,
    name: c.name,
    coordinates: c.coordinates,
    category: c.category === "area" ? "landmark" : c.category,
    avgVisitMinutes: c.category === "food" ? 45 : c.category === "museum" ? 60 : 30,
    tags: { source: "ai-builder", placeId: c.placeId },
  };
}

/** One AI build: the model loops over the assistant's tools until build_walk accepts a walk, fixing what the verdicts reject. */
export async function runAiBuild(req: AiBuildRequest, choice: ProviderChoice, effort?: string, call: typeof callOpenAiTools = callOpenAiTools): Promise<AiBuildResult> {
  const kept = new Map<string, Attraction>();
  const candidates: Candidate[] = req.keep.map((a, i) => {
    const id = `k${i + 1}`;
    kept.set(id, a);
    return { id, name: a.name, coordinates: a.coordinates, category: a.category, placeId: a.tags?.placeId ?? a.id };
  });
  const idOf = (attractionId: string) => candidates.find((c) => kept.get(c.id)?.id === attractionId)?.id;
  const pinned = req.pinnedIds.filter((id) => idOf(id));
  let state: AssistantState = { origin: req.origin, params: { ...req.params }, candidates, chosen: [], limitsSettled: true };

  const situation = {
    reason: req.reason,
    start: req.origin,
    limits: state.params,
    currentPlanStops: req.keep.map((a) => ({ id: idOf(a.id), name: a.name, kind: a.category })),
    pinnedStopIds: pinned.map(idOf),
    visitedStops: req.visitedIds,
    preferredKinds: req.preferredCategories ?? [],
    stopCount: req.stopCount ?? null,
    notableOnly: req.notableOnly === true,
    headingDegrees: req.heading ?? null,
    fillRemainingTime: req.fillRemainingTime === true,
  };
  const messages: ChatMessage[] = [
    { role: "system", content: AI_BUILDER_SYSTEM },
    { role: "user", content: `Build the walk for this request:\n${JSON.stringify(situation)}` },
  ];
  const tools = ASSISTANT_TOOLS.filter((t) => TOOLS.has(t.function.name));
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const budget = makeBudget(TURN_ROUTING_CALLS);
  let billed = 0;

  for (let i = 0; i < MAX_MODEL_CALLS; i += 1) {
    // Last round: only build_walk is left, so the model must commit its best checked walk.
    const response = await call({
      model: choice.model,
      messages,
      tools: i === MAX_MODEL_CALLS - 1 ? tools.filter((t) => t.function.name === "build_walk") : tools,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      signal,
      reasoningEffort: effort,
    });
    billed += estimateCostMicros(choice.model, response.inTok, response.outTok);
    if (response.toolCalls.length === 0) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: "Call build_walk now with your best walk that passed estimate_walk." });
      continue;
    }
    messages.push({ role: "assistant", content: response.content, tool_calls: response.toolCalls });
    let nag = false;
    for (const tc of response.toolCalls) {
      const run = await runTool(tc.function.name, tc.function.arguments, state, budget);
      state = run.state;
      messages.push({ role: "tool", tool_call_id: tc.id, content: run.output });
      if (run.action) {
        const stops = run.action.stops.map((c) => toAttraction(c, kept));
        // Pinned stops are the walker's, whatever the model decided.
        const missing = pinned.filter((id) => !stops.some((s) => s.id === id));
        if (missing.length === 0) {
          return { stops, ordered: run.action.ordered === true, geometry: run.action.geometry, params: run.action.params, summary: (response.content ?? "").trim(), billedMicros: billed };
        }
        nag = true;
      }
    }
    if (nag) messages.push({ role: "user", content: "That walk left out stops the walker pinned. Include every pinned stop and build again." });
  }
  throw new Error("AI builder did not produce a walk that passed the checks");
}
