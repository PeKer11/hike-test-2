import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Attraction, Coordinates } from "@/lib/types";

const mockFetchAttractions = vi.fn();
const mockGetDirections = vi.fn();

vi.mock("@/lib/attractions/overpass-client", () => ({
  fetchAttractions: (...args: unknown[]) => mockFetchAttractions(...args),
}));

vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
}));

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

describe("POST /api/walk-plan — explicit attractions + time filling", () => {
  beforeEach(() => {
    mockFetchAttractions.mockReset();
    mockGetDirections.mockReset();
    mockGetDirections.mockRejectedValue(new Error("no ORS in tests"));
  });

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
