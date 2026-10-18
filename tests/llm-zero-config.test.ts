import { describe, expect, it } from "vitest";

import { resolveLlmConfig, resolveReasoningEffort } from "@/lib/llm/config";

describe("zero-config OpenAI routing", () => {
  it("routes tiers 1-2 to Luna and tier 3 to Sol with only OPENAI_API_KEY", () => {
    const env = { OPENAI_API_KEY: "k" };
    expect(resolveLlmConfig(1, env).primary).toEqual({ provider: "openai", model: "gpt-6-luna" });
    expect(resolveLlmConfig(2, env).primary.model).toBe("gpt-6-luna");
    expect(resolveLlmConfig(3, env).primary.model).toBe("gpt-6.1-sol");
    expect(resolveReasoningEffort(3, "gpt-6.1-sol", env)).toBe("low");
  });
  it("explicit LLM_* settings or no key keep the old defaults", () => {
    expect(resolveLlmConfig(1, { OPENAI_API_KEY: "k", LLM_PROVIDER: "gemini" }).primary.provider).toBe("gemini");
    expect(resolveLlmConfig(1, {}).primary.provider).toBe("gemini");
  });
});
