import { estimateCostMicros } from "@/lib/llm/pricing";
import type { ProviderChoice } from "@/lib/llm/config";
import { callOpenAiTools } from "@/lib/llm/providers/openai-tools";

import type { TurnMessage } from "./turn";

/** Messages kept verbatim after a summary; older ones are folded into it. */
export const KEEP_RECENT = 4;
/** Fold into the summary once this many messages are not yet summarised. */
export const SUMMARIZE_AFTER = 12;

const SYSTEM = `You compress a chat between a walker and a walking assistant into a short memory for later turns. Write at most 120 words, in the language of the chat. Keep only: where the walker is or starts, places discussed or chosen, what was rejected, stated limits (time, radius, pace), and open questions. No greetings, no tool output.`;

export async function summarizeConversation(
  prior: string | null,
  messages: TurnMessage[],
  choice: ProviderChoice,
  effort?: string,
  call: typeof callOpenAiTools = callOpenAiTools,
): Promise<{ summary: string; billedMicros: number }> {
  const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const response = await call({
    model: choice.model,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `${prior ? `Earlier summary:\n${prior}\n\n` : ""}New messages:\n${text}`,
      },
    ],
    tools: [],
    maxOutputTokens: 400,
    signal: AbortSignal.timeout(20_000),
    reasoningEffort: effort,
  });
  return {
    summary: (response.content ?? "").trim().slice(0, 1800),
    billedMicros: estimateCostMicros(choice.model, response.inTok, response.outTok),
  };
}
