import type { ProviderCall } from "../types";
import { postJson, requireEnv } from "./http";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TOOL_NAME = "answer";

interface AnthropicResponse {
  content?: Array<{ type: string; input?: unknown; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Plain fetch (no SDK dependency). Structured output is a single tool call
 * whose `input_schema` is the task's JSON Schema; the tool input is the answer,
 * and nothing is ever executed from it. `tool_choice` is "auto" plus an
 * instruction, because the forced `{type:"tool"}` form is rejected (400) by the
 * newest models. A reply without a tool_use block yields empty text, which the
 * client's parse step turns into a schema failure.
 */
export const callAnthropic: ProviderCall = async (req) => {
  const data = (await postJson(
    ANTHROPIC_URL,
    {
      "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    {
      model: req.model,
      max_tokens: req.maxOutputTokens,
      system: `${req.system}\n\nYou must answer by calling the "${TOOL_NAME}" tool exactly once; do not reply with plain text.`,
      messages: [{ role: "user", content: req.user }],
      tools: [
        {
          name: TOOL_NAME,
          description: "Return the answer as structured JSON.",
          input_schema: req.jsonSchema,
        },
      ],
      tool_choice: { type: "auto" },
    },
    req.signal,
    "Anthropic",
  )) as AnthropicResponse;

  const tool = data.content?.find((block) => block.type === "tool_use");
  const text = tool?.input !== undefined ? JSON.stringify(tool.input) : "";
  return {
    text,
    inTok: data.usage?.input_tokens ?? 0,
    outTok: data.usage?.output_tokens ?? 0,
  };
};
