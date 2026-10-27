import { beforeEach, describe, expect, it, vi } from "vitest";

// The server checks the walker's stored learning consent; these tests are about what happens once it is granted.
vi.mock("@/lib/preferences/consent", () => ({ hasLearningConsent: vi.fn(async () => true) }));

const runLlm = vi.fn();
vi.mock("@/lib/llm/llm-client", () => ({ runLlm: (...a: unknown[]) => runLlm(...a) }));
vi.mock("@/lib/api/rate-limit", () => ({ callerKey: () => "ip", learningRateLimiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) }, rateLimitedResponse: () => { throw new Error("unexpected 429"); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));

import { POST } from "@/app/api/session-summary/route";
import { parseSessionSummary, EMPTY_SESSION_SUMMARY } from "@/lib/llm/tasks/session-summary";
import { whitelistWalkEnd } from "@/lib/llm/walk-end-whitelist";

const post = (body: unknown) =>
  POST(new Request("http://x/api/session-summary", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  runLlm.mockReset();
  runLlm.mockResolvedValue({ data: EMPTY_SESSION_SUMMARY });
});

describe("session-summary privacy", () => {
  it("never lets name@coords keys, start time, area, habit answers or free fields reach runLlm", async () => {
    await post({
      learnPreferences: true,
      feedback: "FEEDBACKSECRET",
      poiKeys: ["cafe nola@32.0853,34.7818", "osm-node-123", "prompt-4"],
      walkEnd: {
        actualMin: 40,
        startedAtMs: 1_700_000_000_000,
        areaLabel: "Tel Aviv",
        note: "call me 0501234567",
        questions: [
          { kind: "habit-coffee", answer: "yes-8am" },
          { kind: "rest", answer: "bench" },
        ],
        interactions: [
          { poiKey: "cafe nola@32.0853,34.7818", kind: "visited", category: "cafe" },
          { poiKey: "osm-way-9", kind: "visited", category: "park" },
        ],
      },
    });
    expect(runLlm).toHaveBeenCalledTimes(1);
    const task = runLlm.mock.calls[0][0] as { untrusted: Array<{ text: string }>; parse: (t: string) => unknown };
    const sent = JSON.stringify(task.untrusted);
    for (const leak of ["nola", "32.0853", "prompt-4", "1700000000000", "Tel Aviv", "0501234567", "habit", "yes-8am", "bench", "FEEDBACKSECRET"]) {
      expect(sent).not.toContain(leak);
    }
    expect(sent).toContain("osm-way-9");
    // The model cannot smuggle a dropped key back in either.
    const bad = { ...EMPTY_SESSION_SUMMARY, places: [{ poiKey: "cafe nola@32.0853,34.7818", sentiment: "liked" }] };
    expect(() => task.parse(JSON.stringify(bad))).toThrow();
  });

  it("parseSessionSummary rejects a non-OSM place key even when it was in the input", () => {
    const key = "cafe@1.0000,2.0000";
    const s = { ...EMPTY_SESSION_SUMMARY, places: [{ poiKey: key, sentiment: "liked" }] };
    expect(() => parseSessionSummary(JSON.stringify(s), { learn: true, routine: false, poiKeys: [key] })).toThrow();
    const ok = { ...EMPTY_SESSION_SUMMARY, places: [{ poiKey: "osm-node-1", sentiment: "liked" }] };
    expect(parseSessionSummary(JSON.stringify(ok), { learn: true, routine: false, poiKeys: ["osm-node-1"] }).places).toHaveLength(1);
  });

  it("whitelist keeps only numbers and enums", () => {
    const out = whitelistWalkEnd({ actualMin: 12.4, envMinutes: { urban: 5, secret: 9 }, habits: { x: 1 } });
    expect(out).toEqual({ actualMin: 12, envMinutes: { urban: 5 } });
  });
});

describe("parseSessionSummary PII filters (R1)", () => {
  const ctx = { learn: true, routine: false, poiKeys: [] as string[] };
  const withNote = (note: string) =>
    JSON.stringify({ ...EMPTY_SESSION_SUMMARY, antiPatterns: [{ code: "other", note }] });
  const withItem = (item: string) =>
    JSON.stringify({
      ...EMPTY_SESSION_SUMMARY,
      preferences: [{ item, sentiment: "like", evidence: "explicit", confidence: 0.5 }],
    });

  it("rejects emails and house numbers in notes", () => {
    for (const bad of ["mail me a@b.co", "lives near Herzl 12", "גר ברחוב הרצל 12", "הרצל 12", "see 12 Allenby St"]) {
      expect(() => parseSessionSummary(withNote(bad), ctx), bad).toThrow();
    }
  });
  it("accepts ordinals, times, and quantities", () => {
    for (const ok of ["on the 1st walk", "3rd stop was long", "ate at 16:00", "wanted 2 stops", "walked 30 min", "too long by 15 minutes"]) {
      expect(() => parseSessionSummary(withNote(ok), ctx), ok).not.toThrow();
    }
  });
  it("preference item must be a short plain phrase", () => {
    for (const bad of ["call 0501234567", "joe@x.com", "Dana's cafe", "a b c d e", "cafe 12", "x".repeat(0)]) {
      expect(() => parseSessionSummary(withItem(bad), ctx), bad).toThrow();
    }
    for (const ok of ["food", "quiet parks", "קפה", "old-town alleys"]) {
      expect(() => parseSessionSummary(withItem(ok), ctx), ok).not.toThrow();
    }
  });
});
