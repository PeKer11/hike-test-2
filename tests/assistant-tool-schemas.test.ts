import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: vi.fn(async () => []),
  searchNearbyPlaces: vi.fn(async () => []),
}));

import { searchNearbyPlaces } from "@/lib/api/google-places-client";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { asState } from "@/lib/assistant/stored-state";
import { ASSISTANT_TOOL_ARGS, parseToolArgs, WALK_TOOL_ARGS } from "@/lib/assistant/tool-schemas";
import { ASSISTANT_TOOLS, runTool } from "@/lib/assistant/tools";
import { WALK_SYSTEM } from "@/lib/assistant/walk-turn";

describe("tool schemas", () => {
  it("cover exactly the tools the model is offered", () => {
    expect(Object.keys(ASSISTANT_TOOL_ARGS).sort()).toEqual(ASSISTANT_TOOLS.map((t) => t.function.name).sort());
    expect(WALK_SYSTEM).toBeTruthy();
    expect(Object.keys(WALK_TOOL_ARGS).sort()).toEqual(["find_places", "propose_add_stop", "propose_head_back", "propose_skip_stop", "remember"]);
  });

  it("rejects an unknown key without calling Google", async () => {
    const run = await runTool("find_nearby", JSON.stringify({ category: "food", extra: 1 }), { ...EMPTY_STATE, origin: { lat: 1, lng: 1 } });
    expect(run.output).toMatch(/bad arguments/);
    expect(searchNearbyPlaces).not.toHaveBeenCalled();
  });

  it("rejects absurd sizes", () => {
    expect(parseToolArgs(ASSISTANT_TOOL_ARGS, "find_nearby", JSON.stringify({ category: "food", radius_m: 1e9 })).ok).toBe(false);
    expect(parseToolArgs(ASSISTANT_TOOL_ARGS, "estimate_walk", JSON.stringify({ stop_ids: Array.from({ length: 21 }, (_, i) => `c${i}`) })).ok).toBe(false);
    expect(parseToolArgs(ASSISTANT_TOOL_ARGS, "remember", JSON.stringify({ fact: "x".repeat(9_000) })).ok).toBe(false);
    expect(parseToolArgs(ASSISTANT_TOOL_ARGS, "nope", "{}")).toEqual({ ok: false, error: "unknown tool" });
  });

  it("accepts null for a field the model left out (strict-mode schemas)", () => {
    const parsed = parseToolArgs(ASSISTANT_TOOL_ARGS, "find_clean_walk", JSON.stringify({ count: 3, must_ids: null }));
    expect(parsed).toEqual({ ok: true, args: { count: 3 } });
  });

  it("still lets set_walk_params answer an unknown rule name as ignored", async () => {
    const run = await runTool("set_walk_params", JSON.stringify({ clear: ["nonsense"] }), EMPTY_STATE);
    expect(run.output).toMatch(/ignored/);
  });
});

describe("stored state", () => {
  it("drops an invalid origin, access and numbers", () => {
    const s = asState({ origin: { lat: "x" }, params: { access: "jetpack", radiusKm: -5, timeMinutes: 90, maxGradePct: 80 }, candidates: [{ id: "c1" }] });
    expect(s.origin).toBeNull();
    expect(s.params.access).toBeUndefined();
    expect(s.params.radiusKm).toBeUndefined();
    expect(s.params.maxGradePct).toBeUndefined();
    expect(s.params.timeMinutes).toBe(90);
    expect(s.candidates).toEqual([]);
  });

  it("keeps a valid state", () => {
    const s = asState({
      origin: { lat: 32, lng: 34 },
      params: { access: "wheelchair", maxGradePct: 6 },
      candidates: [{ id: "c1", name: "A", coordinates: { lat: 1, lng: 1 }, category: "food", placeId: "p" }],
      chosen: ["c1", 5],
    });
    expect(s.origin).toEqual({ lat: 32, lng: 34 });
    expect(s.params).toMatchObject({ access: "wheelchair", maxGradePct: 6 });
    expect(s.candidates).toHaveLength(1);
    expect(s.chosen).toEqual(["c1"]);
  });
});
