import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: vi.fn(async () => []),
  searchNearbyPlaces: vi.fn(async () => []),
}));

import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import { createPlacesGate, placesDailyCap, type QuotaStore } from "@/lib/api/places-quota";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";

const store = (answer = true): QuotaStore & { take: ReturnType<typeof vi.fn> } => ({ take: vi.fn(async () => answer) });

describe("places gate", () => {
  it("refuses past the per-turn cap without asking the store", async () => {
    const s = store();
    const gate = createPlacesGate({ key: "k", dailyCap: 100, perTurnCap: 2, store: s });
    expect(await gate.take()).toBe(true);
    expect(await gate.take()).toBe(true);
    expect(await gate.take()).toBe(false);
    expect(s.take).toHaveBeenCalledTimes(2);
  });

  it("refuses when the daily quota is spent", async () => {
    const gate = createPlacesGate({ key: "k", dailyCap: 1, perTurnCap: 5, store: store(false) });
    expect(await gate.take()).toBe(false);
  });

  it("fails closed with no store (production) and open otherwise", async () => {
    expect(await createPlacesGate({ key: "k", dailyCap: 1, perTurnCap: 5, store: null, failClosed: true }).take()).toBe(false);
    expect(await createPlacesGate({ key: "k", dailyCap: 1, perTurnCap: 5, store: null, failClosed: false }).take()).toBe(true);
  });

  it("fails closed when the store throws", async () => {
    const broken: QuotaStore = { take: async () => { throw new Error("down"); } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await createPlacesGate({ key: "k", dailyCap: 1, perTurnCap: 5, store: broken, failClosed: true }).take()).toBe(false);
    warn.mockRestore();
  });

  it("reads the daily cap from the env, owners get more", () => {
    expect(placesDailyCap("free", false, {})).toBe(80);
    expect(placesDailyCap("paid", false, {})).toBe(300);
    expect(placesDailyCap("free", false, { PLACES_DAILY_CAP_FREE: "10" })).toBe(10);
    expect(placesDailyCap("free", true, {})).toBe(2000);
  });
});

describe("tools respect the gate", () => {
  const withOrigin = { ...EMPTY_STATE, origin: { lat: 32, lng: 34 } };
  const denied = { take: async () => false };

  it("search_place and find_nearby return the limit error and never call Google", async () => {
    const a = await runTool("search_place", JSON.stringify({ query: "cafe" }), withOrigin, undefined, undefined, denied);
    expect(a.output).toMatch(/limit reached/);
    const b = await runTool("find_nearby", JSON.stringify({ category: "food" }), withOrigin, undefined, undefined, denied);
    expect(b.output).toMatch(/limit reached/);
    expect(searchTextPlaces).not.toHaveBeenCalled();
    expect(searchNearbyPlaces).not.toHaveBeenCalled();
  });

  it("caps the find_nearby radius at 10 km, even from a stored radius", async () => {
    await runTool("find_nearby", JSON.stringify({ category: "food" }), { ...withOrigin, params: { radiusKm: 200 } });
    expect(vi.mocked(searchNearbyPlaces).mock.calls.at(-1)?.[2]).toBe(10_000);
  });
});
