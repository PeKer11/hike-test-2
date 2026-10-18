import { beforeEach, describe, expect, it, vi } from "vitest";

const persist = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/preferences/companion-memory", async (orig) => ({
  ...(await orig<typeof import("@/lib/preferences/companion-memory")>()),
  persistWalkEnd: (...a: unknown[]) => persist(...a),
}));

import { buildWalkEndInput, persistWalkEndFromBrowser } from "@/lib/walk/companion/walk-end";
import { at, item } from "./helpers/discovery";

const facts = {
  learnPreferences: true,
  startedAtMs: Date.UTC(2026, 6, 15, 8, 30),
  plannedMin: 60,
  actualMin: 55,
  distanceM: 4200,
  environment: "park" as const,
  stopsPlanned: 4,
  stopsVisited: 3,
  records: [{ kind: "rain" as const, askedAt: 1, outcome: "answered" as const, answerId: "continue" }],
  collapseCount: 0,
  items: [item("osm-node-1", at(0, 0), { state: "visited" })],
  paceMinPerKm: 13,
};

beforeEach(() => {
  persist.mockReset().mockResolvedValue(true);
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("buildWalkEndInput", () => {
  it("carries numeric facts, question answers, interactions and one pace sample", () => {
    const input = buildWalkEndInput(facts);
    expect(input.envMinutes).toEqual({ park: 55 });
    expect(input.questions).toEqual([{ kind: "rain", answer: "continue" }]);
    expect(input.interactions).toEqual([{ poiKey: "osm-node-1", kind: "visited", category: "food" }]);
    expect(input.paceSamples).toEqual([{ env: "park", activeMinutes: 55, minPerKm: 13 }]);
    expect(input.areaLabel).toBeNull();
    expect(buildWalkEndInput({ ...facts, paceMinPerKm: null }).paceSamples).toEqual([]);
  });
});

describe("persistWalkEndFromBrowser", () => {
  it("writes with the session client and session count when consent is on", async () => {
    const input = buildWalkEndInput(facts);
    expect(await persistWalkEndFromBrowser(input, 7, { urban: { minPerKm: 12, n: 1 } })).toBe(true);
    expect(persist).toHaveBeenCalledWith(expect.anything(), "u1", input, 7, { urban: { minPerKm: 12, n: 1 } });
  });
  it("makes no call at all without consent", async () => {
    await persistWalkEndFromBrowser(buildWalkEndInput({ ...facts, learnPreferences: false }), 7, {});
    expect(getUser).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it("writes nothing when signed out, and swallows errors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await persistWalkEndFromBrowser(buildWalkEndInput(facts), 1, {})).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    getUser.mockRejectedValue(new Error("offline"));
    expect(await persistWalkEndFromBrowser(buildWalkEndInput(facts), 1, {})).toBe(false);
  });
});
