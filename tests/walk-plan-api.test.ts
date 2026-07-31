import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates } from "@/lib/types";

const mockFetchAttractions = vi.fn();
const mockGetDirections = vi.fn();
const mockGetMatrix = vi.fn();
const mockGetUser = vi.fn();
const mockGetPreferredCategories = vi.fn();
const mockGetDownvotedCategories = vi.fn();
const mockRankAttractions = vi.fn();

vi.mock("@/lib/attractions/overpass-client", () => ({
  fetchAttractions: (...args: unknown[]) => mockFetchAttractions(...args),
}));

vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
  // The planner falls back to haversine ordering when the matrix is unavailable,
  // which is what these route-level tests measure against.
  getMatrix: (...args: unknown[]) => mockGetMatrix(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/preferences/preference-store", () => ({
  getPreferredCategories: (...args: unknown[]) =>
    mockGetPreferredCategories(...args),
  getDownvotedCategories: (...args: unknown[]) =>
    mockGetDownvotedCategories(...args),
}));

// Real ranking, observed: the route's own output never echoes the categories it
// ranked with, and that merge is the thing under test.
vi.mock("@/lib/attractions/attraction-ranker", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/attractions/attraction-ranker")
    >();
  return {
    ...actual,
    rankAttractions: (
      ...args: Parameters<typeof actual.rankAttractions>
    ) => {
      mockRankAttractions(...args);
      return actual.rankAttractions(...args);
    },
  };
});

import { POST } from "@/app/api/walk-plan/route";

const origin: Coordinates = { lat: 32.08, lng: 34.78 };

function makeAttraction(
  id: string,
  lat: number,
  lng: number,
  avgVisitMinutes: number,
): Attraction {
  return {
    id,
    name: id,
    coordinates: { lat, lng },
    category: "landmark",
    avgVisitMinutes,
    tags: {},
  };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/walk-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function baseBody(explicitAttractions: Attraction[], availableMinutes = 90) {
  return {
    lat: origin.lat,
    lng: origin.lng,
    availableMinutes,
    walkingPaceMinPerKm: 15,
    explicitAttractions,
  };
}

const SIGNED_IN = { data: { user: { id: "user-1" } } };

function resetMocks(): void {
  mockFetchAttractions.mockReset();
  mockGetDirections.mockReset();
  mockGetDirections.mockRejectedValue(new Error("no ORS in tests"));
  mockGetMatrix.mockReset();
  mockGetMatrix.mockRejectedValue(new Error("no ORS in tests"));
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue(SIGNED_IN);
  mockGetPreferredCategories.mockReset();
  mockGetPreferredCategories.mockResolvedValue([]);
  mockGetDownvotedCategories.mockReset();
  mockGetDownvotedCategories.mockResolvedValue([]);
  mockRankAttractions.mockReset();
}

describe("POST /api/walk-plan — explicit attractions + time filling", () => {
  beforeEach(resetMocks);

  it("fills leftover time with discovered attractions", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.082, 34.78, 20),
      makeAttraction("osm-2", 32.083, 34.78, 20),
    ]);

    const response = await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );
    const plan = await response.json();
    const ids = plan.orderedAttractions.map((a: Attraction) => a.id);

    expect(mockFetchAttractions).toHaveBeenCalledOnce();
    expect(ids).toContain("named");
    expect(ids.length).toBeGreaterThan(1);
    expect(plan.totalMinutes).toBeGreaterThan(48);
  });

  it("keeps every named stop when the combined set exceeds the budget", async () => {
    const north = makeAttraction("north", 32.09, 34.78, 20);
    const south = makeAttraction("south", 32.07, 34.78, 20);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.085, 34.78, 25),
      makeAttraction("osm-2", 32.086, 34.78, 25),
    ]);

    const response = await POST(
      postRequest({
        ...baseBody([north, south]),
        fillRemainingTime: true,
      }),
    );
    const plan = await response.json();
    const ids = plan.orderedAttractions.map((a: Attraction) => a.id);

    expect(ids).toContain("north");
    expect(ids).toContain("south");
    // Filler is droppable, the named stops are not — so the plan can come back
    // over budget rather than losing a place the user asked for by name.
    expect(plan.feasible).toBe(false);
    expect(ids).not.toContain("osm-2");
  });

  it("excludes a discovered POI that sits on top of a named stop", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    // ~33 m from `named` — the same place under a different OSM id.
    const duplicate = makeAttraction("osm-dup", 32.081, 34.780353, 20);
    mockFetchAttractions.mockResolvedValueOnce([
      duplicate,
      makeAttraction("osm-far", 32.083, 34.78, 20),
    ]);

    const response = await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );
    const plan = await response.json();
    const seenIds = [
      ...plan.orderedAttractions.map((a: Attraction) => a.id),
      ...plan.droppedAttractions.map((a: Attraction) => a.id),
    ];

    expect(seenIds).not.toContain("osm-dup");
    expect(seenIds).toContain("named");
  });

  it("does not discover for an auto-replan (no fillRemainingTime flag)", async () => {
    const kept = makeAttraction("kept", 32.081, 34.78, 30);

    const response = await POST(postRequest(baseBody([kept])));
    const plan = await response.json();

    expect(mockFetchAttractions).not.toHaveBeenCalled();
    expect(plan.orderedAttractions.map((a: Attraction) => a.id)).toEqual([
      "kept",
    ]);
  });

  it("skips Overpass when the named stops already use up the budget", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 85);

    const response = await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );
    const plan = await response.json();

    expect(mockFetchAttractions).not.toHaveBeenCalled();
    expect(plan.orderedAttractions.map((a: Attraction) => a.id)).toEqual([
      "named",
    ]);
  });

  it("merges caller pins with the named stops", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.082, 34.78, 20),
    ]);

    const response = await POST(
      postRequest({
        ...baseBody([named]),
        fillRemainingTime: true,
        pinnedAttractionIds: ["osm-1"],
      }),
    );
    const plan = await response.json();
    const ids = plan.orderedAttractions.map((a: Attraction) => a.id);

    expect(ids).toContain("named");
    expect(ids).toContain("osm-1");
  });
});

describe("POST /api/walk-plan — saved profile preferences", () => {
  beforeEach(resetMocks);

  function discoveryBody(preferredCategories?: string[]) {
    return {
      lat: origin.lat,
      lng: origin.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      ...(preferredCategories ? { preferredCategories } : {}),
    };
  }

  function rankedWith(): string[] | undefined {
    return mockRankAttractions.mock.calls[0]?.[1]?.preferredCategories;
  }

  it("ranks with the union of the request's interests and the saved profile", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockResolvedValueOnce(["nature", "museum"]);

    const response = await POST(
      postRequest(discoveryBody(["food", "museum"])),
    );

    expect(response.status).toBe(200);
    expect(mockGetPreferredCategories).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    // Union, de-duplicated — neither side replaces the other.
    expect(rankedWith()).toEqual(["food", "museum", "nature"]);
  });

  it("uses the saved profile alone when the request ticked no interests", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockResolvedValueOnce(["park"]);

    await POST(postRequest(discoveryBody()));

    expect(rankedWith()).toEqual(["park"]);
  });

  it("reads no profile and changes nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    const response = await POST(postRequest(discoveryBody(["food"])));

    expect(response.status).toBe(200);
    expect(mockGetPreferredCategories).not.toHaveBeenCalled();
    expect(rankedWith()).toEqual(["food"]);
  });

  it("falls back to the request's interests when the profile read fails", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockRejectedValueOnce(new Error("supabase down"));

    const response = await POST(postRequest(discoveryBody(["food"])));
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(rankedWith()).toEqual(["food"]);
    expect(plan.orderedAttractions).toHaveLength(1);
  });

  it("keeps every named and pinned stop even when exploration fires", async () => {
    // Force the exploration roll: the ranker's default random source is
    // Math.random, and the route deliberately does not expose it to callers.
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const named = makeAttraction("named", 32.081, 34.78, 30);
      mockGetPreferredCategories.mockResolvedValueOnce(["landmark"]);
      mockFetchAttractions.mockResolvedValueOnce([
        { ...makeAttraction("osm-food", 32.082, 34.78, 20), category: "food" },
      ]);

      const response = await POST(
        postRequest({
          ...baseBody([named]),
          fillRemainingTime: true,
          pinnedAttractionIds: ["osm-food"],
        }),
      );
      const plan = await response.json();
      const ids = plan.orderedAttractions.map((a: Attraction) => a.id);

      // The route has to actually opt in, or the rest of this test passes for
      // the wrong reason — nothing fired and nothing could have been displaced.
      expect(mockRankAttractions.mock.calls[0]?.[1]?.allowExploration).toBe(
        true,
      );
      expect(
        plan.orderedAttractions.find((a: Attraction) => a.id === "osm-food")
          ?.isExplorationPick,
      ).toBe(true);

      // The off-preference filler leads the discovered ranking, but the named
      // stop is prepended by the route and can never be pushed out by it.
      expect(ids).toContain("named");
      expect(ids).toContain("osm-food");
    } finally {
      random.mockRestore();
    }
  });

  // The session lookup is the first thing in the try block, and it is the part
  // that throws when Supabase is unconfigured. A narrower try that only covered
  // the profile read would 500 every walk plan in that environment.
  it("still plans the walk when the session lookup itself blows up", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("supabase not configured"));
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    const response = await POST(postRequest(discoveryBody(["food"])));
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetPreferredCategories).not.toHaveBeenCalled();
    expect(rankedWith()).toEqual(["food"]);
    expect(plan.orderedAttractions).toHaveLength(1);
  });

  it("makes no profile round trip when re-timing a walk already in progress", async () => {
    const kept = makeAttraction("kept", 32.081, 34.78, 30);

    await POST(postRequest(baseBody([kept])));

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetPreferredCategories).not.toHaveBeenCalled();
    expect(mockGetDownvotedCategories).not.toHaveBeenCalled();
  });
});

describe("POST /api/walk-plan — saved downvotes", () => {
  beforeEach(resetMocks);

  function discoveryBody() {
    return {
      lat: origin.lat,
      lng: origin.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    };
  }

  function downvotedWith(): string[] | undefined {
    return mockRankAttractions.mock.calls[0]?.[1]?.downvotedCategories;
  }

  it("passes the saved downvotes into the ranking", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetDownvotedCategories.mockResolvedValueOnce(["food"]);

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetDownvotedCategories).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    expect(downvotedWith()).toEqual(["food"]);
  });

  it("passes nothing for a walker with no standing downvotes", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    await POST(postRequest(discoveryBody()));

    expect(downvotedWith()).toBeUndefined();
  });

  it("reads no downvotes for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetDownvotedCategories).not.toHaveBeenCalled();
    expect(downvotedWith()).toBeUndefined();
  });

  // The two reads share a session lookup but not a fate: one failing must not
  // throw away what the other already found.
  it("still applies the preferences when the downvote read fails", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockResolvedValueOnce(["park"]);
    mockGetDownvotedCategories.mockRejectedValueOnce(new Error("supabase down"));

    const response = await POST(postRequest(discoveryBody()));
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(mockRankAttractions.mock.calls[0]?.[1]?.preferredCategories).toEqual([
      "park",
    ]);
    expect(downvotedWith()).toBeUndefined();
    expect(plan.orderedAttractions).toHaveLength(1);
  });

  it("still applies the downvotes when the preference read fails", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockRejectedValueOnce(new Error("supabase down"));
    mockGetDownvotedCategories.mockResolvedValueOnce(["food"]);

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(downvotedWith()).toEqual(["food"]);
  });

  it("applies the downvotes when topping up a named-stops walk too", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.082, 34.78, 20),
    ]);
    mockGetDownvotedCategories.mockResolvedValueOnce(["shopping"]);

    await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );

    expect(downvotedWith()).toEqual(["shopping"]);
  });
});
