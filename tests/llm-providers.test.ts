import { afterEach, describe, expect, it, vi } from "vitest";

import { callAnthropic } from "@/lib/llm/providers/anthropic";
import { callOpenAi, callOpenAiCompatible } from "@/lib/llm/providers/openai";
import type { ProviderRequest } from "@/lib/llm/types";

const req: ProviderRequest = {
  model: "m",
  system: "SYS",
  user: "USER",
  jsonSchema: { type: "object" },
  maxOutputTokens: 77,
  signal: new AbortController().signal,
  timeoutMs: 1000,
  taskName: "eval",
};

function stubFetch(body: unknown, status = 200) {
  const f = vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => "err body",
  }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("providers over mocked fetch", () => {
  it("anthropic: tool call (auto choice), key in header, tool input becomes the answer text", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "ak");
    const f = stubFetch({ content: [{ type: "tool_use", input: { a: 1 } }], usage: { input_tokens: 4, output_tokens: 2 } });
    const r = await callAnthropic(req);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("ak");
    const body = JSON.parse(init.body as string);
    expect(body.tool_choice).toEqual({ type: "auto" });
    expect(body.system).toContain("SYS");
    expect(body.system).toContain('"answer" tool');
    // A small budget is raised to the floor so thinking cannot eat the tool call.
    expect(body.max_tokens).toBe(1024);
    expect(body.output_config).toEqual({ effort: "low" });
    expect(JSON.parse(r.text)).toEqual({ a: 1 });
    expect(r.inTok).toBe(4);
  });

  it("anthropic: a larger budget is kept, and ANTHROPIC_EFFORT=off omits the effort parameter", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "ak");
    vi.stubEnv("ANTHROPIC_EFFORT", "off");
    const f = stubFetch({ content: [{ type: "tool_use", input: { a: 1 } }] });
    await callAnthropic({ ...req, maxOutputTokens: 4000 });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBe(4000);
    expect(body.output_config).toBeUndefined();
  });

  it("anthropic: a reply with only text (no tool_use) is empty text, never trusted as the answer", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "ak");
    stubFetch({ content: [{ type: "text", text: '{"a":1}' }] });
    const r = await callAnthropic(req);
    expect(r.text).toBe("");
  });

  it("openai: json_schema format and max_completion_tokens", async () => {
    vi.stubEnv("OPENAI_API_KEY", "ok");
    const f = stubFetch({ choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } });
    const r = await callOpenAi(req);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.max_completion_tokens).toBe(77);
    expect(r.text).toBe('{"a":1}');
  });

  it("openai-compatible: LLM_BASE_URL, json_object, schema carried in the prompt", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.example.test/v1/");
    vi.stubEnv("LLM_API_KEY", "k");
    const f = stubFetch({ choices: [{ message: { content: "{}" } }] });
    await callOpenAiCompatible(req);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain('"type":"object"');
    expect(body.max_tokens).toBe(77);
  });

  it("reasoning_effort goes to openai only, never to openai-compatible", async () => {
    vi.stubEnv("OPENAI_API_KEY", "ok");
    vi.stubEnv("LLM_BASE_URL", "https://api.example.test/v1");
    vi.stubEnv("LLM_API_KEY", "k");
    const f = stubFetch({ choices: [{ message: { content: "{}" } }] });
    const withEffort = { ...req, reasoningEffort: "low" as const };
    await callOpenAi(withEffort);
    await callOpenAiCompatible(withEffort);
    const bodies = f.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0].reasoning_effort).toBe("low");
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });

  it("carries the HTTP status on errors without leaking the key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "secret-key");
    stubFetch({}, 429);
    const err = await callOpenAi(req).catch((e: unknown) => e as Error & { status: number });
    expect((err as { status: number }).status).toBe(429);
    expect((err as Error).message).not.toContain("secret-key");
  });
});
