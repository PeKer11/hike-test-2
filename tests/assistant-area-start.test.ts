import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(), searchNearbyPlaces: vi.fn(async () => []) }));
vi.mock("@/lib/walk/town-boundary", () => ({ fetchTownBoundary: vi.fn(), fetchTownFootprint: vi.fn() }));

import { searchNearbyPlaces } from "@/lib/api/google-places-client";
import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { fetchTownFootprint } from "@/lib/walk/town-boundary";

const area = "בנימינה גבעת עדה, ישראל";
const townStart = { lat: 32.518, lng: 34.95 };
// Inside the municipality, over 1.5 km from the map's town centre.
const localStart = { lat: 32.54, lng: 34.94 };
const farStart = { lat: 32.078, lng: 34.774 };
const footprint = [[[34.92, 32.49], [35.02, 32.49], [35.02, 32.56], [34.92, 32.56], [34.92, 32.49]]];
const state = (origin: AssistantState["origin"]): AssistantState => ({
  ...EMPTY_STATE,
  origin,
  params: { access: "stroller", avoidDangerous: true, stayInArea: area },
  candidates: [{ id: "c1", name: "בנימינה גבעת עדה", coordinates: townStart, placeId: "town", category: "other" }],
});
const choose = (st: AssistantState) => runTool("set_start", JSON.stringify({ candidate_id: "c1", area }), st);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTownFootprint).mockResolvedValue(footprint);
});

describe("town-aware start", () => {
  it("keeps the current position inside the town instead of moving to its map centre", async () => {
    const st = state(localStart);
    const result = await choose(st);
    expect(JSON.parse(result.output)).toMatchObject({ ok: true, start_source: "current_location", inside_area: true });
    expect(result.state.origin).toEqual(localStart);
    expect(result.state.params).toEqual(st.params);
    expect(fetchTownFootprint).toHaveBeenCalledWith(area);
  });

  it("defaults an outside start to the town without asking the walker to remove the area rule", async () => {
    const st = state(farStart);
    const result = await choose(st);
    expect(JSON.parse(result.output)).toMatchObject({ ok: true, start_source: "named_area", inside_area: false });
    expect(result.state.origin).toEqual(townStart);
    expect(st.origin).toEqual(farStart);
    expect(result.state.params).toEqual(st.params);
    expect(result.askLimits).toBeUndefined();
    expect(result.choices).toBeUndefined();
  });

  it("uses the named town when there is no current start", async () => {
    const result = await choose(state(null));
    expect(result.state.origin).toEqual(townStart);
    expect(JSON.parse(result.output).start_source).toBe("named_area");
  });

  it("does not call an unknown membership 'outside' or silently move the current start", async () => {
    vi.mocked(fetchTownFootprint).mockResolvedValue(null);
    const result = await choose(state(localStart));
    expect(result.state.origin).toEqual(localStart);
    expect(JSON.parse(result.output)).toMatchObject({ inside_area: null, start_source: "current_location" });
  });

  it("does not replace an outside start with a candidate outside the requested area", async () => {
    const st = state(farStart);
    st.candidates[0] = { ...st.candidates[0], coordinates: { lat: 31.78, lng: 35.22 } };
    const result = await choose(st);
    expect(result.state.origin).toEqual(farStart);
    expect(JSON.parse(result.output).error).toBeTruthy();
  });

  it("still moves to an explicitly chosen address without a town-membership lookup", async () => {
    const result = await runTool("set_start", JSON.stringify({ candidate_id: "c1" }), state(localStart));
    expect(result.state.origin).toEqual(townStart);
    expect(fetchTownFootprint).not.toHaveBeenCalled();
  });
});

describe("town start in the assistant turn", () => {
  it("continues searching from the default town in the same turn and announces the non-blocking choice", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "t1", type: "function", function: { name: "set_start", arguments: JSON.stringify({ candidate_id: "c1", area }) } }], inTok: 1, outTok: 1 })
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "t2", type: "function", function: { name: "find_nearby", arguments: '{"category":"food"}' } }], inTok: 1, outTok: 1 })
      .mockResolvedValueOnce({ content: "מחפש אוכל וטבע בשבילך.", toolCalls: [], inTok: 1, outTok: 1 });
    const result = await runAssistantTurn({
      summary: null, state: state(farStart), history: [{ role: "user", content: "תביא טיול בבנימינה מלא אוכל וטבע" }],
      choice: { provider: "openai", model: "gpt-6.1-sol" },
    }, { call });
    expect(searchNearbyPlaces).toHaveBeenCalledWith("food", townStart, expect.any(Number), 20, true);
    expect(result.state.origin).toEqual(townStart);
    expect(result.reply).toContain("בנימינה גבעת עדה");
    expect(result.reply).toContain("בסדר?");
    expect(result.reply).toContain("אמשיך לתכנן משם");
    expect(result.reply).toContain("מחפש אוכל וטבע בשבילך");
    expect(result.action).toBeUndefined(); // Planning never automatically starts a walk.
  });
});
