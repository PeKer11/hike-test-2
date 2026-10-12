import { beforeEach, describe, expect, it, vi } from "vitest";

import { LlmBudgetExceededError } from "@/lib/llm/types";

const mockExtractPlaceNames = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: (...args: unknown[]) => mockExtractPlaceNames(...args),
  resolveCanonicalName: async () => null,
}));
vi.mock("@/lib/attractions/overpass-client", () => ({ fetchAttractions: async () => [] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } }),
}));
vi.mock("@/lib/preferences/preference-store", () => ({
  learnPreferencesFromText: async () => null,
  getPreferredCategories: async () => [],
  getDislikedCategories: async () => [],
  getDownvotedCategories: async () => new Map(),
}));
vi.mock("@/lib/preferences/fact-store", () => ({
  learnFactsFromText: async () => null,
  getStandingFacts: async () => [],
}));
vi.mock("@/lib/api/nominatim-client", () => ({ searchPlaces: async () => [] }));

import { POST } from "@/app/api/extract-places/route";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/extract-places", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract-places budget guard wiring", () => {
  beforeEach(() => mockExtractPlaceNames.mockReset());

  it("passes the ip (anonymous) or the signed-in user to the LLM call context", async () => {
    mockExtractPlaceNames.mockResolvedValue({ places: [], contextLocation: null, durationMinutes: null, categoryNeeds: [] });

    await POST(post({ prompt: "a walk" }, { "x-forwarded-for": "7.7.7.7" }));
    expect(mockExtractPlaceNames.mock.calls[0][2]).toEqual({ userId: null, ip: "7.7.7.7" });

    await POST(post({ prompt: "a walk", learnPreferences: true }, { "x-forwarded-for": "7.7.7.8" }));
    expect(mockExtractPlaceNames.mock.calls[1][2]).toEqual({ userId: "user-1", ip: "7.7.7.8" });

    await POST(post({ prompt: "two hours", followUp: true }, { "x-forwarded-for": "7.7.7.9" }));
    expect(mockExtractPlaceNames.mock.calls[2][2]).toEqual({ userId: null, ip: "7.7.7.9" });
  });

  it("answers an exhausted budget exactly like an unavailable LLM", async () => {
    mockExtractPlaceNames.mockRejectedValueOnce(new Error("LLM unavailable"));
    const unavailable = await POST(post({ prompt: "a walk" }, { "x-forwarded-for": "6.6.6.1" }));

    mockExtractPlaceNames.mockRejectedValueOnce(new LlmBudgetExceededError("user"));
    const exhausted = await POST(post({ prompt: "a walk" }, { "x-forwarded-for": "6.6.6.2" }));

    expect(exhausted.status).toBe(unavailable.status);
    expect(Object.keys(await exhausted.json())).toEqual(Object.keys(await unavailable.json()));
  });
});
