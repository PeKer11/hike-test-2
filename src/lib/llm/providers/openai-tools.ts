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
  output?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
    call_id?: string;
    name?: string;
    arguments?: string;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

type InputItem = Record<string, unknown>;

function toInput(messages: ChatMessage[]): InputItem[] {
  const items: InputItem[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      items.push({ type: "function_call_output", call_id: m.tool_call_id, output: m.content });
    } else if (m.role === "assistant") {
      if (m.content) items.push({ role: "assistant", content: m.content });
      for (const c of m.tool_calls ?? []) {
        items.push({ type: "function_call", call_id: c.id, name: c.function.name, arguments: c.function.arguments });
      }
    } else {
      items.push({ role: m.role, content: m.content });
    }
  }
  return items;
}

/**
 * One model turn with function tools. Uses /v1/responses: gpt-6.1-sol's chat-completions
 * endpoint rejects function tools together with any supported reasoning_effort.
 */
export async function callOpenAiTools(req: ToolChatRequest): Promise<ToolChatResponse> {
  const data = (await postJson(
    `${OPENAI_BASE}/responses`,
    { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    {
      model: req.model,
      input: toInput(req.messages),
      store: false,
      ...(req.tools.length
        ? { tools: req.tools.map((t) => ({ type: "function", ...t.function })) }
        : {}),
      max_output_tokens: req.maxOutputTokens,
      ...(req.reasoningEffort ? { reasoning: { effort: req.reasoningEffort } } : {}),
    },
    req.signal,
    "OpenAI",
  )) as RawResponse;
  const text: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const item of data.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) if (part.type === "output_text" && part.text) text.push(part.text);
    } else if (item.type === "function_call" && item.call_id && item.name) {
      toolCalls.push({
        id: item.call_id,
        type: "function",
        function: { name: item.name, arguments: item.arguments ?? "{}" },
      });
    }
  }
  return {
    content: text.length ? text.join("") : null,
    toolCalls,
    inTok: data.usage?.input_tokens ?? 0,
    outTok: data.usage?.output_tokens ?? 0,
  };
}
