import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockExtract = vi.fn();
const mockRunLlm = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: (...a: unknown[]) => mockExtract(...a),
  resolveCanonicalName: async () => null,
}));
vi.mock("@/lib/llm/llm-client", () => ({ runLlm: (...a: unknown[]) => mockRunLlm(...a) }));
vi.mock("@/lib/attractions/overpass-client", () => ({ fetchAttractions: async () => [] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
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
vi.mock("@/lib/api/nominatim-client", () => ({
  searchPlaces: async (name: string) => [
    { lat: String(32 + name.length / 1000), lon: "34.78", display_name: name, addresstype: "attraction" },
  ],
}));

import { POST } from "@/app/api/extract-places/route";
import { MAX_SIMPLE_CONSTRAINTS } from "@/lib/llm/escalation";

let n = 0;
function post(prompt = "x") {
  return POST(
    new Request("http://localhost/api/extract-places", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `9.9.9.${++n}` },
      body: JSON.stringify({ prompt }),
    }),
  );
}
const extraction = (over: Record<string, unknown> = {}) => ({
  places: ["Alpha", "Beta"],
  contextLocation: null,
  durationMinutes: null,
  categoryNeeds: [],
  ...over,
});
const MANY = { durationMinutes: 120, stopCount: 3, notableOnly: true, maxEndDistanceKm: 1 };

const plan = (ids: string[]) => ({
  data: {
    decision: "plan",
    stops: ids.map((placeId) => ({ placeId, role: "optional", reason: "r" })),
    constraints: {},
    question: null,
    warnings: [],
    summary: "s",
    draftChanges: [],
    injectionDetected: false,
  },
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockExtract.mockReset();
  mockRunLlm.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function ids(res: Response) {
  return ((await res.json()).attractions as { id: string }[]).map((a) => a.id);
}

describe("POST /api/extract-places T3 plan call site", () => {
  it("flag off (default): never calls the T3 planner, response order untouched", async () => {
    mockExtract.mockResolvedValue(extraction(MANY));
    const res = await post();
    expect(mockRunLlm).not.toHaveBeenCalled();
    expect(await ids(res)).toHaveLength(2);
  });

  it("flag on, few constraints: still no T3 call", async () => {
    vi.stubEnv("LLM_T3_PLAN", "1");
    mockExtract.mockResolvedValue(extraction({ durationMinutes: 120, stopCount: 3 }));
    await post();
    expect(MAX_SIMPLE_CONSTRAINTS).toBe(3);
    expect(mockRunLlm).not.toHaveBeenCalled();
  });

  it("flag on, many constraints: one tier-3 plan call; its order is applied, ids stay the same set", async () => {
    mockExtract.mockResolvedValue(extraction(MANY));
    const off = await ids(await post("p"));
    vi.stubEnv("LLM_T3_PLAN", "1");
    mockRunLlm.mockImplementation(async (task: { parse: (t: string) => unknown }) => {
      const reversed = [...off].reverse();
      return { ...plan(reversed), parsed: task.parse(JSON.stringify(plan(reversed).data)) };
    });
    const out = await ids(await post("p2"));
    expect(mockRunLlm).toHaveBeenCalledTimes(1);
    const [task, ctx] = mockRunLlm.mock.calls[0];
    expect(task).toMatchObject({ name: "plan", tier: 3 });
    expect(ctx).toMatchObject({ userId: null });
    expect(out).toEqual([...off].reverse());
  });

  it("flag on: a T3 failure or an unknown placeId keeps the cheap order and still answers 200", async () => {
    mockExtract.mockResolvedValue(extraction(MANY));
    const base = await ids(await post("q0"));
    vi.stubEnv("LLM_T3_PLAN", "1");

    mockRunLlm.mockRejectedValueOnce(new Error("provider down"));
    const failed = await post("q1");
    expect(failed.status).toBe(200);
    expect(await ids(failed)).toEqual(base);

    // runLlm runs `parse`; an invented id makes it throw, as the real client would.
    mockRunLlm.mockImplementationOnce(async (task: { parse: (t: string) => unknown }) =>
      task.parse(JSON.stringify(plan(["invented"]).data)),
    );
    expect(await ids(await post("q2"))).toEqual(base);
    expect(mockRunLlm).toHaveBeenCalledTimes(2);
  }, 20_000);
});
