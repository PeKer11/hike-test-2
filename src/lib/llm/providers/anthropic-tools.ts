import { IMAGE_DATA_NOTE } from "../sanitize";
import type { LlmProviderName } from "../types";
import { postJson, requireEnv } from "./http";
import { callOpenAiTools, type ChatMessage, type ToolCall, type ToolChatRequest, type ToolChatResponse } from "./openai-tools";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
/** Thinking counts against max_tokens, so a small budget can end before any answer. */
const MIN_MAX_TOKENS = 1024;

type Block = Record<string, unknown>;
type AnthropicMessage = { role: "user" | "assistant"; content: Block[] };

interface RawResponse {
  content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
}

/**
 * The model's own content blocks (thinking included) for each tool round, keyed by the
 * `toolCalls` array the loop pushes back into its history. Replaying them verbatim is what
 * keeps a thinking model's tool loop valid; the callers need no change.
 */
const rawByToolCalls = new WeakMap<ToolCall[], Block[]>();

function imageBlock(dataUrl: string): Block | null {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : null;
}

function parseArgs(raw: string): unknown {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: AnthropicMessage[] } {
  const system: string[] = [];
  const out: AnthropicMessage[] = [];
  const push = (role: "user" | "assistant", blocks: Block[]) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system" && out.length === 0) {
      system.push(m.content);
    } else if (m.role === "tool") {
      let isError = false;
      try {
        const parsed = JSON.parse(m.content) as { error?: unknown; skipped?: unknown };
        isError = parsed?.error !== undefined || parsed?.skipped !== undefined;
      } catch {
        // Plain-text tool output is not an error.
      }
      push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content, ...(isError ? { is_error: true } : {}) }]);
    } else if (m.role === "assistant") {
      const raw = m.tool_calls ? rawByToolCalls.get(m.tool_calls) : undefined;
      if (raw) {
        push("assistant", raw);
        continue;
      }
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.tool_calls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) });
      push("assistant", blocks.length ? blocks : [{ type: "text", text: "…" }]);
    } else {
      // A later "system" message (the wrap-up nudge) is sent as user text; the Messages API has no mid-list system role.
      const images = (m.role === "user" ? m.images ?? [] : []).map(imageBlock).filter((b): b is Block => b !== null);
      push("user", [...images, ...(images.length ? [{ type: "text", text: IMAGE_DATA_NOTE }] : []), { type: "text", text: m.content || "…" }]);
    }
  }
  if (out.length === 0) out.push({ role: "user", content: [{ type: "text", text: "…" }] });
  return { system: system.join("\n\n"), messages: out };
}

function effortFor(raw: string | undefined): string {
  // Sonnet 5.5 defaults to high, which is slow for a chat turn: ask for low unless a caller wants more.
  if (!raw || raw === "none" || raw === "minimal") return "low";
  return raw;
}

/** One model turn with function tools, Messages API. Same contract as callOpenAiTools. */
export async function callAnthropicTools(req: ToolChatRequest): Promise<ToolChatResponse> {
  const { system, messages } = toAnthropicMessages(req.messages);
  let tools = req.tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
  let toolChoice: { type: "none" } | undefined;
  if (tools.length === 0) {
    // The loop's closing calls send no tools, but the history still holds tool_use blocks, which the API only accepts
    // next to tool definitions. Declare those tools by name and forbid calling them.
    const names = new Set<string>();
    for (const m of messages) for (const b of m.content) if (b.type === "tool_use" && typeof b.name === "string") names.add(b.name);
    if (names.size) {
      tools = [...names].map((name) => ({ name, description: "Not available in this reply.", input_schema: { type: "object", properties: {} } }));
      toolChoice = { type: "none" };
    }
  }
  const data = (await postJson(
    ANTHROPIC_URL,
    { "x-api-key": requireEnv("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" },
    {
      model: req.model,
      max_tokens: Math.max(req.maxOutputTokens, MIN_MAX_TOKENS),
      output_config: { effort: effortFor(req.reasoningEffort) },
      ...(system ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] } : {}),
      messages,
      ...(tools.length ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    },
    req.signal,
    "Anthropic",
  )) as RawResponse;

  const text: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const b of data.content ?? []) {
    if (b.type === "text" && b.text) text.push(b.text);
    else if (b.type === "tool_use" && b.id && b.name) {
      toolCalls.push({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } });
    }
  }
  // A reply cut off by max_tokens may hold a half-written tool call: never run it.
  const calls = data.stop_reason === "max_tokens" ? [] : toolCalls;
  if (calls.length && data.content) rawByToolCalls.set(calls, data.content as Block[]);
  const u = data.usage ?? {};
  return {
    content: text.length ? text.join("") : null,
    toolCalls: calls,
    // Cached input is billed too (writes at 1.25x): count it all as input so the budget guard never undercounts.
    inTok: Math.ceil((u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25),
    outTok: u.output_tokens ?? 0,
  };
}

/** The tool-calling function for a provider; anything but Anthropic keeps the OpenAI Responses path. */
export function toolCallFor(provider: LlmProviderName): typeof callOpenAiTools {
  return provider === "anthropic" ? callAnthropicTools : callOpenAiTools;
}
