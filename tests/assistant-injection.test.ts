import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: vi.fn(),
  searchNearbyPlaces: vi.fn(),
}));

import { searchTextPlaces } from "@/lib/api/google-places-client";
import { runAiBuild } from "@/lib/ai-builder/run";
import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { asState } from "@/lib/assistant/stored-state";
import { summarizeConversation } from "@/lib/assistant/summary";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { runWalkTurn } from "@/lib/assistant/walk-turn";
import { callOpenAiTools } from "@/lib/llm/providers/openai-tools";
import { INJECTION_PAYLOADS, MARKER } from "./fixtures/injection-payloads";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;
type Msg = { role: string; content: string | null; tool_calls?: unknown };
const tool = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

const guarded: AssistantState = {
  ...EMPTY_STATE,
  origin: { lat: 32.07123, lng: 34.78011 },
  limitsSettled: true,
  params: { access: "wheelchair", avoidDangerous: true, maxGradePct: 6, stayInArea: "Caesarea, Israel" },
  candidates: [{ id: "c1", name: "Safe cafe", coordinates: { lat: 32.5, lng: 34.9 }, category: "food", placeId: "p1" }],
};

/** A model that obeys the payload: after its first reply it tries to clear the safety rules, move the start and save a "fact". */
function hijackedModel(firstCalls: Array<ReturnType<typeof tool>> = []) {
  const seen: Msg[][] = [];
  const hijack = [tool("h1", "set_walk_params", { clear: ["access", "avoid_dangerous", "max_grade", "stay_in_area"] }), tool("h2", "set_start", { candidate_id: "c1" }), tool("h3", "remember", { fact: `${MARKER} payload` })];
  let n = 0;
  const call = vi.fn(async (req: { messages: Msg[] }) => {
    seen.push(JSON.parse(JSON.stringify(req.messages)));
    n += 1;
    if (n === 1 && firstCalls.length) return { content: null, toolCalls: firstCalls, inTok: 1, outTok: 1 };
    if (n <= 2) return { content: null, toolCalls: hijack, inTok: 1, outTok: 1 };
    return { content: "done", toolCalls: [], inTok: 1, outTok: 1 };
  });
  return { call, seen };
}

const DATA_REGION = /<data source="[a-z0-9_-]+">[\s\S]*?<\/data>/g;
// Bidi, zero-width and tag characters are exactly what is being looked for.
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩​⁠﻿]|[\u{E0000}-\u{E007F}]/u;

/** What must hold for every request that goes to the model. */
function expectSafeRequests(seen: Msg[][]) {
  for (const messages of seen) {
    for (const m of messages) {
      const content = m.content ?? "";
      if (m.role === "system") expect(content).not.toContain(MARKER);
      expect(content).not.toMatch(HIDDEN);
      if (m.role === "user" || m.role === "tool") {
        const open = (content.match(/<data /g) ?? []).length;
        const close = (content.match(/<\/data>/g) ?? []).length;
        expect(open).toBe(close);
      }
      if (m.role === "user") expect(content.replace(DATA_REGION, "")).not.toContain(MARKER);
      expect(content).not.toMatch(/32\.071\d/);
    }
  }
}

afterEach(() => vi.clearAllMocks());

describe.each(Object.entries(INJECTION_PAYLOADS))("injection payload: %s", (_name, payload) => {
  const turn = (input: Partial<Parameters<typeof runAssistantTurn>[0]>, call: ReturnType<typeof hijackedModel>["call"]) =>
    runAssistantTurn({ summary: null, history: [{ role: "user", content: "find me a cafe" }], state: guarded, choice, ...input }, { call: call as never });

  beforeEach(() => {
    vi.mocked(searchTextPlaces).mockResolvedValue([
      { placeId: "g1", name: payload, coordinates: { lat: 32.08, lng: 34.79 }, primaryType: null, types: [] },
    ] as never);
  });

  it("C1 a Google place name", async () => {
    const m = hijackedModel([tool("s1", "search_place", { query: "cafe" })]);
    const result = await turn({}, m.call);
    expectSafeRequests(m.seen);
    // Whatever the hijacked model did, the walker is told, and the server did not let a rule go unannounced.
    expect(result.reply).toMatch(/Changed by the assistant/);
  });

  it("C2 / C6 saved-place labels and queued names (the memory note)", async () => {
    const m = hijackedModel();
    await turn({ memoryNote: `\nSaved places: ${payload}` }, m.call);
    expectSafeRequests(m.seen);
  });

  it("C3 the stored summary", async () => {
    const m = hijackedModel();
    await turn({ summary: payload }, m.call);
    expectSafeRequests(m.seen);
  });

  it("C4 stored state strings", async () => {
    const m = hijackedModel();
    const state = asState({ ...guarded, params: { ...guarded.params, stayInArea: payload, avoidStreets: [payload] } });
    await turn({ state }, m.call);
    expectSafeRequests(m.seen);
  });

  it("C5 saved-walk titles and stops (recall_walks)", async () => {
    const m = hijackedModel([tool("r1", "recall_walks", {})]);
    await turn({ loadWalks: async () => [{ title: payload, createdAt: "2026-10-01T00:00:00Z", areaLabel: payload, totalMin: 60, stops: [{ name: payload, category: "park" }] }] as never }, m.call);
    expectSafeRequests(m.seen);
  });

  it("C8 an image turn cannot loosen the rules", async () => {
    const m = hijackedModel();
    // The payload lives inside the picture, which a test cannot show: the walker's typed words are harmless.
    const result = await turn({ history: [{ role: "user", content: "what is in this picture?", images: ["data:image/png;base64,AAAA"] }] }, m.call);
    expect(result.state.params).toEqual(guarded.params);
    expectSafeRequests(m.seen);
  });

  it("C7 the in-walk assistant: stops, memory and earlier lines", async () => {
    const m = hijackedModel();
    await runWalkTurn(
      { history: [{ role: "user", content: "hi" }], position: { lat: 32, lng: 34 }, stops: [payload], memoryNote: `\n${payload}`, choice },
      m.call as never,
    );
    expectSafeRequests(m.seen);
  });

  it("C9 the AI builder: names of the walker's stops", async () => {
    const m = hijackedModel();
    const at = { id: "a", name: payload, coordinates: { lat: 32.5, lng: 34.9 }, category: "park" as const, avgVisitMinutes: 20, tags: {} };
    await runAiBuild({ origin: { lat: 32.07123, lng: 34.78011 }, reason: "test", params: { access: "wheelchair" }, keep: [at], pinnedIds: [], visitedIds: [] }, choice, undefined, m.call as never).catch(() => undefined);
    expectSafeRequests(m.seen);
    // The builder never ran set_start / remember / set_walk_params: it was told they are not available.
    const toolReplies = m.seen.flat().filter((x) => x.role === "tool").map((x) => x.content);
    expect(toolReplies.some((c) => /tool not available/.test(c ?? ""))).toBe(true);
  });

  it("C10 the summarizer input", async () => {
    const seen: Msg[][] = [];
    const call = vi.fn(async (req: { messages: Msg[] }) => {
      seen.push(req.messages);
      return { content: "summary", toolCalls: [], inTok: 1, outTok: 1 };
    });
    await summarizeConversation(null, [{ role: "user", content: "hi" }, { role: "assistant", content: payload }], choice, undefined, call as unknown as typeof callOpenAiTools);
    const [system, user] = seen[0];
    expect(system.content).not.toContain(MARKER);
    expect((user.content ?? "").replace(DATA_REGION, "")).not.toContain(MARKER);
  });
});
