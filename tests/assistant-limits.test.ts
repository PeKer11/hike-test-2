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
    expect(est.walkMin).toBe(44); // 3.5 km x 12.5 min/km
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
