import type { ProviderChoice } from "@/lib/llm/config";
import { estimateCostMicros } from "@/lib/llm/pricing";
import {
  callOpenAiTools,
  type ChatMessage,
} from "@/lib/llm/providers/openai-tools";

import { ASSISTANT_SYSTEM } from "./prompt";
import type { AssistantState, BuildAction } from "./state";
import { ASSISTANT_TOOLS, runTool } from "./tools";

/** A user turn is at most this many model calls (each tool round is one). */
const MAX_MODEL_CALLS = 6;
const MAX_OUTPUT_TOKENS = 700;
const TURN_TIMEOUT_MS = 45_000;

export interface TurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TurnResult {
  reply: string;
  state: AssistantState;
  action?: BuildAction;
  askLimits?: boolean;
  choices?: string[];
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
    history: TurnMessage[];
    state: AssistantState;
    choice: ProviderChoice;
    effort?: string;
  },
  deps: TurnDeps = {},
): Promise<TurnResult> {
  const call = deps.call ?? callOpenAiTools;
  let state = input.state;
  let action: BuildAction | undefined;
  let askLimits = false;
  let choices: string[] | undefined;
  let billedMicros = 0;

  const known = state.candidates.length
    ? `\nPlaces already found (ids): ${JSON.stringify(
        state.candidates.map((c) => ({ id: c.id, name: c.name, kind: c.category })),
      )}`
    : "";
  const facts = `\nStart point set: ${state.origin ? "yes" : "no"}. Limits settled: ${state.limitsSettled ? "yes" : "no"}. Limits so far: ${JSON.stringify(state.params)} (a missing field means no limit).`;
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        ASSISTANT_SYSTEM +
        facts +
        (input.tasteNote ?? "") +
        known +
        (input.summary ? `\n\nSummary of the earlier conversation:\n${input.summary}` : ""),
    },
    ...input.history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];

  const signal = AbortSignal.timeout(TURN_TIMEOUT_MS);
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
      return { reply: (response.content ?? "").trim(), state, action, billedMicros };
    }
    messages.push({ role: "assistant", content: response.content, tool_calls: response.toolCalls });
    for (const tc of response.toolCalls) {
      const run = await runTool(tc.function.name, tc.function.arguments, state);
      state = run.state;
      if (run.action) action = run.action;
      if (run.askLimits) askLimits = true;
      if (run.choices) choices = run.choices;
      messages.push({ role: "tool", tool_call_id: tc.id, content: run.output });
    }
    // A build ends the turn: the client now runs the planner.
    if (action || askLimits || choices) {
      const final = await call({
        model: input.choice.model,
        messages,
        tools: [],
        maxOutputTokens: 200,
        signal,
        reasoningEffort: input.effort,
      }).catch(() => null);
      if (final) billedMicros += estimateCostMicros(input.choice.model, final.inTok, final.outTok);
      return { reply: (final?.content ?? "").trim(), state, action, askLimits, choices, billedMicros };
    }
  }
  return {
    reply: "I got tangled up — could you say that another way?",
    state,
    action,
    billedMicros,
  };
}
