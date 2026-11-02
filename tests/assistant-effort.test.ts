import { describe, expect, it } from "vitest";

import { needsDeepThinking } from "@/lib/assistant/effort";

const located = { origin: { lat: 32.07, lng: 34.78 } };
const nowhere = { origin: null };

describe("needsDeepThinking", () => {
  it("keeps small talk and simple asks at medium", () => {
    expect(needsDeepThinking("thanks!", located)).toBe(false);
    expect(needsDeepThinking("find me a cafe nearby", located)).toBe(false);
  });

  it("escalates a long route request", () => {
    const msg = "I want a loop route of about two hours starting near the port, passing a bakery, a viewpoint and somewhere to sit, ending where I began";
    expect(needsDeepThinking(msg, located)).toBe(true);
  });

  it("escalates stacked constraints, in Hebrew too", () => {
    expect(needsDeepThinking("מסלול עם עגלה, בלי מדרגות, עם צל, ועם ילדים", located)).toBe(true);
  });

  it("escalates a vague plan request with no start", () => {
    expect(needsDeepThinking("plan something", nowhere)).toBe(true);
    expect(needsDeepThinking("plan something", located)).toBe(false);
  });
});
