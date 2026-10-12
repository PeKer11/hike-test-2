import type { ProviderCall, ProviderRequest } from "../types";
import { postJson, requireEnv } from "./http";

const OPENAI_BASE = "https://api.openai.com/v1";

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function build(req: ProviderRequest, compatible: boolean) {
  const schemaText = JSON.stringify(req.jsonSchema);
  return {
    model: req.model,
    messages: [
      {
        role: "system",
        // Hosted open-weight endpoints often lack json_schema mode, so the
        // schema also rides in the prompt and the format is plain json_object.
        content: compatible
          ? `${req.system}\n\nAnswer with a single JSON object matching this JSON Schema:\n${schemaText}`
          : req.system,
      },
      { role: "user", content: req.user },
    ],
    response_format: compatible
      ? { type: "json_object" }
      : {
          type: "json_schema",
          json_schema: { name: req.taskName.replace(/[^a-z0-9_-]/gi, "_"), schema: req.jsonSchema },
        },
    // The GPT-5 family rejects max_tokens; generic OpenAI-style hosts still use it.
    ...(compatible
      ? { max_tokens: req.maxOutputTokens }
      : { max_completion_tokens: req.maxOutputTokens }),
    // Only the real OpenAI API takes it; compatible hosts may 400 on the field.
    ...(!compatible && process.env.LLM_REASONING_EFFORT
      ? { reasoning_effort: process.env.LLM_REASONING_EFFORT }
      : {}),
  };
}

async function chat(
  base: string,
  apiKey: string,
  req: ProviderRequest,
  compatible: boolean,
) {
  const data = (await postJson(
    `${base.replace(/\/+$/, "")}/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    build(req, compatible),
    req.signal,
    compatible ? "OpenAI-compatible" : "OpenAI",
  )) as ChatResponse;
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inTok: data.usage?.prompt_tokens ?? 0,
    outTok: data.usage?.completion_tokens ?? 0,
  };
}

export const callOpenAi: ProviderCall = (req) =>
  chat(OPENAI_BASE, requireEnv("OPENAI_API_KEY"), req, false);

/** Groq / Together / OpenRouter-style endpoint: `LLM_BASE_URL` + `LLM_API_KEY`. */
export const callOpenAiCompatible: ProviderCall = (req) =>
  chat(requireEnv("LLM_BASE_URL"), requireEnv("LLM_API_KEY"), req, true);
