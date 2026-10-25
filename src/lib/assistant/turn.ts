import type { ProviderChoice } from "@/lib/llm/config";
import { estimateCostMicros } from "@/lib/llm/pricing";
import {
  callOpenAiTools,
  type ChatMessage,
} from "@/lib/llm/providers/openai-tools";

import { ASSISTANT_SYSTEM } from "./prompt";
import type { AssistantState, BuildAction } from "./state";
import { makeBudget } from "@/lib/walk/routing-budget";
import { TURN_ROUTING_CALLS } from "./route-check";
import { ASSISTANT_TOOLS, runTool } from "./tools";
import type { LoadWalks } from "./recall-walks";

/** A user turn is at most this many model calls (each tool round is one). */
const MAX_MODEL_CALLS = 12;
const MAX_OUTPUT_TOKENS = 700;
const TURN_TIMEOUT_MS = 90_000;

export interface TurnMessage {
  role: "user" | "assistant";
  content: string;
  /** Data-URL images attached to this message (the model sees them; they are not stored). */
  images?: string[];
}

export interface TurnResult {
  reply: string;
  state: AssistantState;
  action?: BuildAction;
  askLimits?: boolean;
  choices?: string[];
  /** Lasting facts Sol decided to save this turn. */
  remembered?: string[];
  billedMicros: number;
}

export interface TurnDeps {
  call?: typeof callOpenAiTools;
}

/**
 * Runs one walker message through Sol with tools. `summary` is the compact
 * memory of the older conversation; `history` is only the recent messages.
 */
export async function runAssistantTurn(
  input: {
    summary: string | null;
    /** Taste guidance for open-ended requests (see defaults.ts). */
    tasteNote?: string;
    /** What is already remembered about the walker (see route.ts). */
    memoryNote?: string;
    history: TurnMessage[];
    state: AssistantState;
    choice: ProviderChoice;
    effort?: string;
    /** Loads the signed-in walker's saved walks for the recall_walks tool. */
    loadWalks?: LoadWalks;
  },
  deps: TurnDeps = {},
): Promise<TurnResult> {
  const call = deps.call ?? callOpenAiTools;
  let state = input.state;
  let action: BuildAction | undefined;
  let askLimits = false;
  let unchecked: string[] = [];
  let choices: string[] | undefined;
  const remembered: string[] = [];
  let billedMicros = 0;

  const known = state.candidates.length
    ? `\nPlaces already found (ids): ${JSON.stringify(
        state.candidates.map((c) => ({ id: c.id, name: c.name, kind: c.category })),
      )}`
    : "";
  const facts = `\nStart point: ${state.origin ? `${state.origin.lat.toFixed(5)},${state.origin.lng.toFixed(5)}` : "not set"}. Limits settled: ${state.limitsSettled ? "yes" : "no"}. Limits so far: ${JSON.stringify(state.params)} (a missing field means no limit).`;
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        ASSISTANT_SYSTEM +
        facts +
        (input.tasteNote ?? "") +
        (input.memoryNote ?? "") +
        known +
        (input.summary ? `\n\nSummary of the earlier conversation:\n${input.summary}` : ""),
    },
    ...input.history.map((m) => ({ role: m.role, content: m.content, ...(m.images?.length ? { images: m.images } : {}) }) as ChatMessage),
  ];

  const signal = AbortSignal.timeout(TURN_TIMEOUT_MS);
  const budget = makeBudget(TURN_ROUTING_CALLS);
  for (let i = 0; i < MAX_MODEL_CALLS; i += 1) {
    const response = await call({
      model: input.choice.model,
      messages,
      tools: ASSISTANT_TOOLS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      signal,
      reasoningEffort: input.effort,
    });
    billedMicros += estimateCostMicros(input.choice.model, response.inTok, response.outTok);

    if (response.toolCalls.length === 0) {
      return { reply: (response.content ?? "").trim(), state, action, remembered, billedMicros };
    }
    messages.push({ role: "assistant", content: response.content, tool_calls: response.toolCalls });
    for (const tc of response.toolCalls) {
      const run = await runTool(tc.function.name, tc.function.arguments, state, budget, input.loadWalks);
      state = run.state;
      if (run.action) action = run.action;
      if (run.askLimits) askLimits = true;
      if (run.choices) choices = run.choices;
      if (run.remember) remembered.push(run.remember);
      messages.push({ role: "tool", tool_call_id: tc.id, content: run.output });
      if (tc.function.name === "build_walk" && run.action) {
        try {
          const open = (JSON.parse(run.output).not_checked ?? []) as Array<{ rule: string; status: string }>;
          unchecked = open.map((r) => `${r.rule} (${r.status})`);
        } catch {
          unchecked = [];
        }
      }
    }
    // A build ends the turn: the client now runs the planner.
    if (action || askLimits || choices) {
      const final = await call({
        model: input.choice.model,
        messages,
        tools: [],
        maxOutputTokens: 400,
        signal,
        reasoningEffort: input.effort,
      }).catch(() => null);
      if (final) billedMicros += estimateCostMicros(input.choice.model, final.inTok, final.outTok);
      // Said by the server, so a rule that was not fully checked is never left out of the reply.
      const reply = `${(final?.content ?? "").trim()}${unchecked.length ? `\n\n⚠ Not fully checked: ${unchecked.join(", ")}` : ""}`.trim();
      return { reply, state, action, askLimits, choices, remembered, billedMicros };
    }
  }
  // Out of tool rounds: have the model report what it found so far, in the walker's language, instead of a canned English line.
  const wrapUp = await call({
    model: input.choice.model,
    messages: [...messages, { role: "user", content: "Stop searching. In the walker's language, say briefly what you found so far and what you still need from them." }],
    tools: [],
    maxOutputTokens: 300,
    signal: AbortSignal.timeout(20_000),
    reasoningEffort: input.effort,
  }).catch(() => null);
  if (wrapUp) billedMicros += estimateCostMicros(input.choice.model, wrapUp.inTok, wrapUp.outTok);
  return {
    reply: wrapUp?.content?.trim() || "I got tangled up — could you say that another way?",
    state,
    action,
    remembered,
    billedMicros,
  };
}
