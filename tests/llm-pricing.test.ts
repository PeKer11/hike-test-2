import { describe, expect, it } from "vitest";
import { estimateCostMicros } from "@/lib/llm/pricing";

describe("estimateCostMicros", () => {
  it("prices a known model at its list rate", () => {
    expect(estimateCostMicros("gpt-6-luna", 1_000_000, 1_000_000)).toBe(600_000);
  });

  it("prices unknown or dated ids at least as high as the dearest known model", () => {
    const dearest = estimateCostMicros("claude-sonnet-5-5", 1000, 1000);
    expect(estimateCostMicros("claude-sonnet-5-5-20261001", 1000, 1000)).toBeGreaterThanOrEqual(dearest);
    expect(estimateCostMicros("typo-model", 1000, 1000)).toBeGreaterThanOrEqual(dearest);
  });

  it("knows gpt-6.1-sol", () => {
    expect(estimateCostMicros("gpt-6.1-sol", 1_000_000, 0)).toBe(2_000_000);
  });
});
