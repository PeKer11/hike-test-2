import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ors-client", () => ({
  getMatrix: vi.fn(async () => ({
    distances: [
      [0, 1000, 3000],
      [1000, 0, 2500],
      [3000, 2500, 0],
    ],
  })),
}));

import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";

const base: AssistantState = {
  ...EMPTY_STATE,
  origin: { lat: 32, lng: 34 },
  candidates: [
    { id: "c1", name: "A", coordinates: { lat: 32.01, lng: 34 }, category: "park", placeId: "a" },
    { id: "c2", name: "B", coordinates: { lat: 32.02, lng: 34 }, category: "food", placeId: "b" },
  ],
};

describe("assistant limits", () => {
  it("refuses to build before the limits are settled", async () => {
    const run = await runTool("build_walk", JSON.stringify({ stop_ids: ["c1", "c2"] }), base);
    expect(run.action).toBeUndefined();
    expect(run.output).toContain("ask_limits");
  });

  it("ask_limits asks the client to show the boxes", async () => {
    expect((await runTool("ask_limits", "{}", base)).askLimits).toBe(true);
  });

  it("estimates real street distance and walking time at the default pace", async () => {
    const run = await runTool("estimate_walk", JSON.stringify({ stop_ids: ["c1", "c2"] }), base);
    const est = JSON.parse(run.output);
    expect(est.walkKm).toBe(3.5);
    expect(est.walkMin).toBe(53); // 3.5 km x 15 min/km
    expect(est.visitMin).toBe(70); // park 25 + food 45
  });

  it("blocks a build over the max walking distance", async () => {
    const settled = { ...base, limitsSettled: true, params: { maxWalkKm: 2 } };
    const run = await runTool("build_walk", JSON.stringify({ stop_ids: ["c1", "c2"] }), settled);
    expect(run.action).toBeUndefined();
    expect(run.output).toContain("does not fit");
  });

  it("builds when everything fits", async () => {
    const settled = { ...base, limitsSettled: true, params: { maxWalkKm: 5, timeMinutes: 200 } };
    const run = await runTool("build_walk", JSON.stringify({ stop_ids: ["c1", "c2"] }), settled);
    expect(run.action?.stops).toHaveLength(2);
  });
});

import { defaultParams, parseDefaults, tasteNote } from "@/lib/assistant/defaults";

describe("assistant defaults", () => {
  it("keeps only sane values and known kinds", () => {
    const d = parseDefaults({ timeMinutes: 90, radiusKm: -1, paceMinPerKm: 15, tastes: { park: "more", bogus: "more", food: "x" } });
    expect(defaultParams(d)).toEqual({ timeMinutes: 90, paceMinPerKm: 15 });
    expect(d.tastes).toEqual({ park: "more" });
  });

  it("tells the model when history is dominated by one kind", () => {
    const note = tasteNote({}, new Map([["museum", 9], ["park", 1]]));
    expect(note).toContain("dominated");
    expect(note).toContain("museum 90%");
  });

  it("offer_choices needs at least two options", async () => {
    expect((await runTool("offer_choices", JSON.stringify({ options: ["a"] }), base)).choices).toBeUndefined();
    expect((await runTool("offer_choices", JSON.stringify({ options: ["a", "b"] }), base)).choices).toEqual(["a", "b"]);
  });
});
