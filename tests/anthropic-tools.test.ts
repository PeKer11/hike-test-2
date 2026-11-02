import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callAnthropicTools, toAnthropicMessages, toolCallFor } from "@/lib/llm/providers/anthropic-tools";
import { callOpenAiTools, type ChatMessage } from "@/lib/llm/providers/openai-tools";
import { resolveLlmConfig } from "@/lib/llm/config";

const tool = { type: "function" as const, function: { name: "search", description: "d", parameters: { type: "object", properties: {} } } };

function mockFetch(body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const sent = (fn: ReturnType<typeof mockFetch>) => JSON.parse((fn.mock.calls[0] as unknown as [string, { body: string }])[1].body);

describe("anthropic tool calls", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps system, images, tool calls and grouped tool results", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "SYS" },
      { role: "user", content: "hi", images: ["data:image/png;base64,AAA"] },
      { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "search", arguments: '{"q":1}' } }, { id: "t2", type: "function", function: { name: "search", arguments: "bad" } }] },
      { role: "tool", tool_call_id: "t1", content: '{"ok":true}' },
      { role: "tool", tool_call_id: "t2", content: '{"error":"x"}' },
      { role: "system", content: "Stop searching." },
    ];
    const { system, messages: out } = toAnthropicMessages(messages);
    expect(system).toBe("SYS");
    expect(out[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png", data: "AAA" } });
    expect(out[1].content).toEqual([
      { type: "tool_use", id: "t1", name: "search", input: { q: 1 } },
      { type: "tool_use", id: "t2", name: "search", input: {} },
    ]);
    // Both results and the later nudge share one user message, results first.
    expect(out[2].role).toBe("user");
    expect(out[2].content.map((b) => b.type)).toEqual(["tool_result", "tool_result", "text"]);
    expect(out[2].content[1]).toMatchObject({ is_error: true });
  });

  it("sends low effort by default, passes high through, and never sends disabled thinking", async () => {
    const fn = mockFetch({ content: [{ type: "text", text: "hello" }], usage: { input_tokens: 10, output_tokens: 5 } });
    const base = { model: "claude-sonnet-5-5", messages: [{ role: "user", content: "x" } as ChatMessage], tools: [tool], maxOutputTokens: 100, signal: new AbortController().signal };
    const res = await callAnthropicTools(base);
    expect(res.content).toBe("hello");
    let body = sent(fn);
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.max_tokens).toBe(1024);
    expect(body.thinking).toBeUndefined();
    const fn2 = mockFetch({ content: [], usage: {} });
    await callAnthropicTools({ ...base, reasoningEffort: "high" });
    body = sent(fn2);
    expect(body.output_config).toEqual({ effort: "high" });
  });

  it("replays the model's own blocks and declares tools for a closing call with none", async () => {
    const first = mockFetch({
      content: [{ type: "thinking", thinking: "t", signature: "s" }, { type: "tool_use", id: "t1", name: "search", input: { q: 2 } }],
      stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const base = { model: "m", tools: [tool], maxOutputTokens: 2000, signal: new AbortController().signal };
    const user: ChatMessage = { role: "user", content: "go" };
    const r1 = await callAnthropicTools({ ...base, messages: [user] });
    expect(r1.toolCalls).toHaveLength(1);
    expect(first).toHaveBeenCalledTimes(1);

    const second = mockFetch({ content: [{ type: "text", text: "done" }], usage: {} });
    await callAnthropicTools({
      ...base,
      tools: [],
      messages: [user, { role: "assistant", content: null, tool_calls: r1.toolCalls }, { role: "tool", tool_call_id: "t1", content: "{}" }],
    });
    const body = sent(second);
    expect(body.messages[1].content[0].type).toBe("thinking");
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(["search"]);
    expect(body.tool_choice).toEqual({ type: "none" });
  });

  it("drops tool calls from a reply cut off by max_tokens and counts cache tokens as input", async () => {
    mockFetch({
      content: [{ type: "tool_use", id: "t1", name: "search", input: {} }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 7, cache_read_input_tokens: 50, cache_creation_input_tokens: 40 },
    });
    const res = await callAnthropicTools({ model: "m", messages: [{ role: "user", content: "x" }], tools: [tool], maxOutputTokens: 10, signal: new AbortController().signal });
    expect(res.toolCalls).toEqual([]);
    expect(res.inTok).toBe(100 + 50 + 50);
    expect(res.outTok).toBe(7);
  });

  it("selects the provider's function and zero-configs Sonnet 5.5 from ANTHROPIC_API_KEY", () => {
    expect(toolCallFor("anthropic")).toBe(callAnthropicTools);
    expect(toolCallFor("openai")).toBe(callOpenAiTools);
    const cfg = resolveLlmConfig(3, { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "o" });
    expect(cfg.primary).toEqual({ provider: "anthropic", model: "claude-sonnet-5-5" });
    expect(resolveLlmConfig(3, { ANTHROPIC_API_KEY: "k", LLM_PROVIDER: "openai", LLM_MODEL: "x" }).primary.provider).toBe("openai");
  });
});
