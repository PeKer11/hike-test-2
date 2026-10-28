import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/walk/town-boundary", () => ({
  fetchTownFootprint: vi.fn(async () => [[[34.92, 32.49], [35.02, 32.49], [35.02, 32.56], [34.92, 32.56], [34.92, 32.49]]]),
  fetchTownBoundary: vi.fn(async () => null),
}));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn() }));

import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { callOpenAiTools } from "@/lib/llm/providers/openai-tools";

// Opt-in, paid model check; map tools use fixtures and no application/production DB is involved.
// The shared test setup deliberately removes provider keys; reload only for this explicit opt-in.
if (process.env.RUN_LIVE_AREA_START_EVAL) process.loadEnvFile(".env.local");
const live = Boolean(process.env.RUN_LIVE_AREA_START_EVAL && process.env.OPENAI_API_KEY);
const townStart = { lat: 32.52, lng: 34.94 };
const town = { placeId: "town", name: "בנימינה גבעת עדה", coordinates: townStart, primaryType: "locality", types: ["locality"] };

describe.skipIf(!live)("live area-start behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchTextPlaces).mockResolvedValue([town]);
    vi.mocked(searchNearbyPlaces).mockImplementation(async (category) => [{
      placeId: `fixture-${category}`, name: category === "food" ? "בית קפה לדוגמה" : "פארק לדוגמה",
      coordinates: { lat: 32.521, lng: 34.94 }, primaryType: null, types: [],
    }]);
  });

  it.each([
    { label: "inside", origin: { lat: 32.54, lng: 34.94 } },
    { label: "outside", origin: { lat: 32.078, lng: 34.774 } },
  ])("resolves an $label start and searches immediately without a start-choice gate", { timeout: 120_000 }, async ({ label, origin }) => {
    const startCalls: Array<Record<string, unknown>> = [];
    const recording: typeof callOpenAiTools = async (req) => {
      const result = await callOpenAiTools(req);
      for (const t of result.toolCalls) {
        if (t.function.name === "set_start") startCalls.push(JSON.parse(t.function.arguments));
      }
      return result;
    };
    const result = await runAssistantTurn({
      summary: null,
      history: [{ role: "user", content: "תמצא לי שני מקומות לטיול בבנימינה, אוכל וטבע. תציע מקומות ואז אבחר. אל תצא מבנימינה." }],
      state: { ...EMPTY_STATE, origin, params: {}, limitsSettled: true },
      choice: { provider: "openai", model: "gpt-6.1-sol" },
    }, { call: recording });
    expect(startCalls.some((c) => typeof c.area === "string")).toBe(true);
    expect(result.state.origin).toEqual(label === "inside" ? origin : townStart);
    expect(searchNearbyPlaces).toHaveBeenCalled();
    expect(result.choices?.some((s) => /להתחיל|start|להגביל/.test(s))).not.toBe(true);
    expect(result.reply).not.toMatch(/מחוץ ל|outside|לבטל את הגבלת/);
    if (label === "outside") expect(result.reply).toContain("אמשיך לתכנן משם");
    console.info(`area-start ${label}: resolved, nearby searched, no blocking start choice`);
  });
});
