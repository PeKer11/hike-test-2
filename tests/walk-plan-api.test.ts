import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates } from "@/lib/types";

const mockFetchAttractions = vi.fn();
const mockGetDirections = vi.fn();
const mockGetMatrix = vi.fn();
const mockGetUser = vi.fn();
const mockGetPreferredCategories = vi.fn();
const mockGetDownvotedCategories = vi.fn();
const mockGetUpvotedCategories = vi.fn();
const mockGetDownvotedPoiKeys = vi.fn();
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
  getUpvotedCategories: (...args: unknown[]) =>
    mockGetUpvotedCategories(...args),
  getDownvotedPoiKeys: (...args: unknown[]) => mockGetDownvotedPoiKeys(...args),
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
  mockGetDownvotedCategories.mockResolvedValue(new Map());
  mockGetUpvotedCategories.mockReset();
  mockGetUpvotedCategories.mockResolvedValue(new Map());
  mockGetDownvotedPoiKeys.mockReset();
  mockGetDownvotedPoiKeys.mockResolvedValue(new Set());
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
    // `osm-2` sits a long walk past `osm-1` rather than next door to it: the
    // budget pre-filter now costs each candidate from the stop before it, so a
    // second filler 100 m along the same street is genuinely affordable and no
    // longer proves anything about dropping.
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.085, 34.78, 25),
      makeAttraction("osm-2", 32.105, 34.78, 25),
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

  // The pre-filter re-sorts what is left after every acceptance on the ranker's
  // score, and a named stop has never been through the ranker — it scores 0 and
  // sinks below every discovered candidate. Charging the named stops to the
  // budget up front is what keeps the filler from spending all of it.
  it("only lets filler have the time the named stops leave over", async () => {
    // 70 of the 90 minutes, before any walking.
    const named = makeAttraction("named", 32.081, 34.78, 70);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.0815, 34.78, 15),
      makeAttraction("osm-2", 32.082, 34.78, 15),
      makeAttraction("osm-3", 32.0825, 34.78, 15),
    ]);

    const response = await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );
    const plan = await response.json();
    const filler = plan.orderedAttractions.filter(
      (a: Attraction) => a.id !== "named",
    );

    expect(plan.orderedAttractions.map((a: Attraction) => a.id)).toContain(
      "named",
    );
    // One 15-minute stop fits in what is left; three plainly do not.
    expect(filler).toHaveLength(1);
  });

  it("caps the whole walk at the stop limit, named stops included", async () => {
    const named = Array.from({ length: 6 }, (_, i) =>
      makeAttraction(`named-${i}`, 32.0801 + i * 0.0001, 34.78, 1),
    );
    mockFetchAttractions.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, i) =>
        makeAttraction(`osm-${i}`, 32.0811 + i * 0.0001, 34.78, 1),
      ),
    );

    const response = await POST(
      postRequest({ ...baseBody(named), fillRemainingTime: true }),
    );
    const plan = await response.json();

    // MAX_WALK_STOPS is 8, and six of them are already spoken for.
    expect(plan.orderedAttractions.length).toBeLessThanOrEqual(8);
    expect(
      plan.orderedAttractions.filter((a: Attraction) =>
        a.id.startsWith("named-"),
      ),
    ).toHaveLength(6);
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
    expect(mockGetUpvotedCategories).not.toHaveBeenCalled();
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

  function downvotedWith(): Map<string, number> | undefined {
    return mockRankAttractions.mock.calls[0]?.[1]?.downvotedCategories;
  }

  // The count rides along with the category — it is what the ranker scales its
  // penalty on, so dropping it here would put the flat penalty back.
  it("passes the saved downvotes and their counts into the ranking", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetDownvotedCategories.mockResolvedValueOnce(new Map([["food", 3]]));

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetDownvotedCategories).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    expect(downvotedWith()).toEqual(new Map([["food", 3]]));
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
    mockGetDownvotedCategories.mockResolvedValueOnce(new Map([["food", 1]]));

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(downvotedWith()).toEqual(new Map([["food", 1]]));
  });

  it("applies the downvotes when topping up a named-stops walk too", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.082, 34.78, 20),
    ]);
    mockGetDownvotedCategories.mockResolvedValueOnce(new Map([["shopping", 2]]));

    await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );

    expect(downvotedWith()).toEqual(new Map([["shopping", 2]]));
  });
});

// Mirrors the downvote block for the positive side. These rows existed and were
// written on every post-walk rating long before anything read them back — the
// route is the piece that finally does, so "was it actually threaded into the
// ranking?" is the thing worth asserting.
describe("POST /api/walk-plan — saved upvotes", () => {
  beforeEach(resetMocks);

  function discoveryBody() {
    return {
      lat: origin.lat,
      lng: origin.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    };
  }

  function upvotedWith(): Map<string, number> | undefined {
    return mockRankAttractions.mock.calls[0]?.[1]?.upvotedCategories;
  }

  function downvotedWith(): Map<string, number> | undefined {
    return mockRankAttractions.mock.calls[0]?.[1]?.downvotedCategories;
  }

  // The count rides along with the category for the same reason it does on the
  // downvote side: the boost scales on it, so dropping it here would flatten
  // "liked museums on four walks" back down to "liked museums once".
  it("passes the saved upvotes and their counts into the ranking", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetUpvotedCategories.mockResolvedValueOnce(new Map([["museum", 3]]));

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetUpvotedCategories).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    expect(upvotedWith()).toEqual(new Map([["museum", 3]]));
  });

  it("passes nothing for a walker with no standing upvotes", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    await POST(postRequest(discoveryBody()));

    expect(upvotedWith()).toBeUndefined();
  });

  it("reads no upvotes for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetUpvotedCategories).not.toHaveBeenCalled();
    expect(upvotedWith()).toBeUndefined();
  });

  // Three reads now share the one session lookup but not a fate. The per-read
  // catch is what holds that up, and a third read is exactly where a `Promise.all`
  // that had been rewritten to a single outer catch would start silently
  // blanking the other two.
  it("still applies the other two reads when the upvote read fails", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockResolvedValueOnce(["park"]);
    mockGetDownvotedCategories.mockResolvedValueOnce(new Map([["food", 2]]));
    mockGetUpvotedCategories.mockRejectedValueOnce(new Error("supabase down"));

    const response = await POST(postRequest(discoveryBody()));
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(mockRankAttractions.mock.calls[0]?.[1]?.preferredCategories).toEqual([
      "park",
    ]);
    expect(downvotedWith()).toEqual(new Map([["food", 2]]));
    expect(upvotedWith()).toBeUndefined();
    expect(plan.orderedAttractions).toHaveLength(1);
  });

  it("still applies the upvotes when both other reads fail", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockRejectedValueOnce(new Error("supabase down"));
    mockGetDownvotedCategories.mockRejectedValueOnce(new Error("supabase down"));
    mockGetUpvotedCategories.mockResolvedValueOnce(new Map([["museum", 1]]));

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(upvotedWith()).toEqual(new Map([["museum", 1]]));
    expect(downvotedWith()).toBeUndefined();
  });

  it("applies the upvotes when topping up a named-stops walk too", async () => {
    const named = makeAttraction("named", 32.081, 34.78, 30);
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.082, 34.78, 20),
    ]);
    mockGetUpvotedCategories.mockResolvedValueOnce(new Map([["nature", 2]]));

    await POST(
      postRequest({ ...baseBody([named]), fillRemainingTime: true }),
    );

    expect(upvotedWith()).toEqual(new Map([["nature", 2]]));
  });
});

describe("POST /api/walk-plan — saved POI-level downvotes", () => {
  beforeEach(resetMocks);

  function discoveryBody() {
    return {
      lat: origin.lat,
      lng: origin.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    };
  }

  it("keeps a downvoted place out of the plan when Overpass rediscovers it", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("node/42", 32.081, 34.78, 20),
      makeAttraction("node/43", 32.082, 34.78, 20),
    ]);
    mockGetDownvotedPoiKeys.mockResolvedValueOnce(new Set(["node/42"]));

    const response = await POST(postRequest(discoveryBody()));
    const plan = await response.json();
    const seenIds = [
      ...plan.orderedAttractions.map((a: Attraction) => a.id),
      ...plan.droppedAttractions.map((a: Attraction) => a.id),
    ];

    expect(response.status).toBe(200);
    // Not merely dropped by the planner — never a candidate in the first place.
    expect(seenIds).toEqual(["node/43"]);
  });

  it("passes nothing for a walker who has never downvoted a place", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    await POST(postRequest(discoveryBody()));

    expect(
      mockRankAttractions.mock.calls[0]?.[1]?.downvotedPoiKeys,
    ).toBeUndefined();
  });

  it("reads no POI downvotes for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);

    const response = await POST(postRequest(discoveryBody()));

    expect(response.status).toBe(200);
    expect(mockGetDownvotedPoiKeys).not.toHaveBeenCalled();
  });

  // Four reads on one session lookup, still not one fate — a failed POI read
  // must cost the suppression and nothing else.
  it("still applies the other three reads when the POI read fails", async () => {
    mockFetchAttractions.mockResolvedValueOnce([
      makeAttraction("osm-1", 32.081, 34.78, 20),
    ]);
    mockGetPreferredCategories.mockResolvedValueOnce(["park"]);
    mockGetDownvotedCategories.mockResolvedValueOnce(new Map([["food", 2]]));
    mockGetUpvotedCategories.mockResolvedValueOnce(new Map([["museum", 1]]));
    mockGetDownvotedPoiKeys.mockRejectedValueOnce(new Error("supabase down"));

    const response = await POST(postRequest(discoveryBody()));
    const plan = await response.json();
    const options = mockRankAttractions.mock.calls[0]?.[1];

    expect(response.status).toBe(200);
    expect(options?.preferredCategories).toEqual(["park"]);
    expect(options?.downvotedCategories).toEqual(new Map([["food", 2]]));
    expect(options?.upvotedCategories).toEqual(new Map([["museum", 1]]));
    expect(options?.downvotedPoiKeys).toBeUndefined();
    expect(plan.orderedAttractions).toHaveLength(1);
  });
});

describe("POST /api/walk-plan — max end distance from origin", () => {
  beforeEach(resetMocks);

  function endDistanceBody(maxEndDistanceFromOriginMeters?: unknown) {
    return {
      lat: origin.lat,
      lng: origin.lng,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      radiusMeters: 3000,
      maxEndDistanceFromOriginMeters,
    };
  }

  function discovered(): Attraction[] {
    return [
      makeAttraction("near", 32.081, 34.78, 20),
      makeAttraction("middle", 32.085, 34.78, 20),
      makeAttraction("far", 32.09, 34.78, 20),
    ];
  }

  it("makes the walk finish within the stated distance of the start", async () => {
    mockFetchAttractions.mockResolvedValueOnce(discovered());

    const response = await POST(postRequest(endDistanceBody(800)));
    const plan = await response.json();
    const last = plan.orderedAttractions.at(-1);

    expect(response.status).toBe(200);
    expect(last.id).not.toBe("far");
  });

  // The form's field is optional, and a blank one must not arrive as a zero —
  // a zero limit would empty every walk it touched.
  it.each([
    ["a blank field", undefined],
    ["a zero", 0],
    ["something that is not a number", "soon"],
  ])("treats %s as no constraint at all", async (_label, value) => {
    mockFetchAttractions.mockResolvedValueOnce(discovered());

    const response = await POST(postRequest(endDistanceBody(value)));
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(plan.orderedAttractions.at(-1).id).toBe("far");
  });

  // A mid-walk rebuild posts the walker's current position as `lat`/`lng` and
  // the walk's real start as `endAnchor`. Without the anchor, "finish near my
  // car" would quietly re-anchor to wherever they had got to.
  it("measures the constraint from `endAnchor` when the rebuild moved the origin", async () => {
    mockFetchAttractions.mockResolvedValueOnce(discovered());

    const response = await POST(
      postRequest({
        ...endDistanceBody(400),
        // Re-planning from ~1.1 km north; the anchor stays at the start.
        lat: 32.09,
        lng: 34.78,
        endAnchor: origin,
      }),
    );
    const plan = await response.json();

    expect(response.status).toBe(200);
    expect(plan.orderedAttractions.at(-1).id).toBe("near");
  });

  it.each([
    ["a missing anchor", undefined],
    ["a half-parsed anchor", { lat: 32.08, lng: "west" }],
  ])("falls back to the origin for %s", async (_label, endAnchor) => {
    mockFetchAttractions.mockResolvedValueOnce(discovered());

    const response = await POST(
      postRequest({
        ...endDistanceBody(400),
        lat: 32.09,
        lng: 34.78,
        endAnchor,
      }),
    );
    const plan = await response.json();

    expect(response.status).toBe(200);
    // Measured from 32.09 the far stop is the one already in range.
    expect(plan.orderedAttractions.at(-1).id).toBe("far");
  });
});
