import { beforeEach, describe, expect, it, vi } from "vitest";

// The server checks the walker's stored learning consent; these tests are about what happens once it is granted.
vi.mock("@/lib/preferences/consent", () => ({ hasLearningConsent: vi.fn(async () => true) }));

const mockFetchAttractions = vi.fn();
const mockGetUser = vi.fn();
const mockLoadMemoryWire = vi.fn();

vi.mock("@/lib/attractions/overpass-client", () => ({
  fetchAttractions: (...a: unknown[]) => mockFetchAttractions(...a),
}));
vi.mock("@/lib/api/ors-client", () => ({
  getDirections: async () => {
    throw new Error("no ORS in tests");
  },
  getMatrix: async () => {
    throw new Error("no ORS in tests");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/preferences/preference-store", () => ({
  getPreferredCategoryWeights: async () => new Map(),
  getDownvotedCategories: async () => new Map(),
  getUpvotedCategories: async () => new Map(),
  getDownvotedPoiKeys: async () => new Set(),
  getTrendingCategoryCounts: async () => new Map(),
  recordWalkSession: async () => 1,
}));
vi.mock("@/lib/preferences/companion-memory-wire", () => ({
  loadMemoryWire: (...a: unknown[]) => mockLoadMemoryWire(...a),
}));

import { POST } from "@/app/api/walk-plan/route";

const attraction = {
  id: "osm-1",
  name: "A",
  coordinates: { lat: 32.081, lng: 34.78 },
  category: "landmark",
  avgVisitMinutes: 20,
  tags: {},
};

function post(extra: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/walk-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: 32.08,
        lng: 34.78,
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        ...extra,
      }),
    }),
  );
}

const WIRE = { sessionCount: 4, paceByEnv: {}, interactions: [], priors: {} };

beforeEach(() => {
  mockFetchAttractions.mockReset().mockResolvedValue([attraction]);
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  mockLoadMemoryWire.mockReset().mockResolvedValue(WIRE);
});

describe("POST /api/walk-plan companion memory", () => {
  it("attaches companionMemory only with the learning consent flag", async () => {
    const withConsent = await (await post({ learnPreferences: true })).json();
    expect(withConsent.companionMemory).toEqual(WIRE);
    expect(mockLoadMemoryWire).toHaveBeenCalledWith(expect.anything(), "u1", true);

    mockLoadMemoryWire.mockClear();
    const without = await (await post({})).json();
    expect(without.companionMemory).toBeUndefined();
    expect(mockLoadMemoryWire).not.toHaveBeenCalled();
  });

  it("sends nothing for a signed-out walker even with the flag", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const body = await (await post({ learnPreferences: true })).json();
    expect(body.companionMemory).toBeUndefined();
    expect(mockLoadMemoryWire).not.toHaveBeenCalled();
  });

  it("still answers the plan when the memory cannot be read", async () => {
    mockLoadMemoryWire.mockRejectedValue(new Error("rls"));
    const res = await post({ learnPreferences: true });
    expect(res.status).toBe(200);
    expect((await res.json()).companionMemory).toBeUndefined();
  });
});
