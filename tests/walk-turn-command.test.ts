import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runWalkTurn } from "@/lib/assistant/walk-turn";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;

async function systemPromptFor(autoApply?: "add" | "drop") {
  const seen: string[] = [];
  const call = vi.fn(async (req: { messages: Array<{ content: string | null }> }) => {
    seen.push(String(req.messages[0].content));
    return { content: "ok", toolCalls: [], inTok: 1, outTok: 1 };
  });
  await runWalkTurn(
    { history: [{ role: "user", content: "x" }], position: { lat: 32, lng: 34 }, stops: ["A"], choice, autoApply },
    call as never,
  );
  return seen[0];
}

describe("the command line in the system prompt", () => {
  it("is there only when the walker gave a command", async () => {
    expect(await systemPromptFor()).not.toMatch(/The walker gave a command/);
    const p = await systemPromptFor("add");
    expect(p).toMatch(/The walker gave a command: the app carries out your propose_ calls at once and offers Undo/);
    expect(p).toMatch(/never tell them to tap, never ask if it fits/);
  });
  it("asks for as many places as they asked for", async () => {
    expect(await systemPromptFor()).toMatch(/as many places as they asked for \(one if they did not say\)/);
  });
});
