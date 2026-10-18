import type { ProviderCall } from "../types";
import { postJson, requireEnv } from "./http";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TOOL_NAME = "answer";

/**
 * Thinking-capable models can spend a small output budget on reasoning and
 * never reach the tool call, so the budget has a floor.
 */
export const ANTHROPIC_MIN_MAX_TOKENS = 1024;

/**
 * Output effort sent with every call: structured extraction needs none of the
 * deep reasoning. `ANTHROPIC_EFFORT=off` omits it, for a model that rejects the
 * parameter (not every Claude model supports `output_config.effort`).
 */
export function anthropicEffort(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.ANTHROPIC_EFFORT ?? "low").trim().toLowerCase();
  return raw === "" || raw === "off" ? null : raw;
}

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
      max_tokens: Math.max(req.maxOutputTokens, ANTHROPIC_MIN_MAX_TOKENS),
      ...(anthropicEffort() ? { output_config: { effort: anthropicEffort() } } : {}),
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
