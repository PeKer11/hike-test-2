import { postJson, requireEnv } from "./http";

const OPENAI_BASE = "https://api.openai.com/v1";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ToolChatRequest {
  model: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  maxOutputTokens: number;
  signal: AbortSignal;
  reasoningEffort?: string;
}

export interface ToolChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  inTok: number;
  outTok: number;
}

interface RawResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** One chat-completions turn with function tools (no JSON-schema mode). */
export async function callOpenAiTools(req: ToolChatRequest): Promise<ToolChatResponse> {
  const data = (await postJson(
    `${OPENAI_BASE}/chat/completions`,
    { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    {
      model: req.model,
      messages: req.messages,
      ...(req.tools.length ? { tools: req.tools } : {}),
      max_completion_tokens: req.maxOutputTokens,
      ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    },
    req.signal,
    "OpenAI",
  )) as RawResponse;
  const message = data.choices?.[0]?.message;
  return {
    content: message?.content ?? null,
    toolCalls: message?.tool_calls ?? [],
    inTok: data.usage?.prompt_tokens ?? 0,
    outTok: data.usage?.completion_tokens ?? 0,
  };
}
