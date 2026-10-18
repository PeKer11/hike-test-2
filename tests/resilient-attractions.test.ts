import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAttractions, searchPlaces } = vi.hoisted(() => ({
  fetchAttractions: vi.fn(),
  searchPlaces: vi.fn(),
}));

vi.mock("@/lib/attractions/overpass-client", () => ({ fetchAttractions }));
vi.mock("@/lib/api/nominatim-client", () => ({ searchPlaces }));

import { fetchAttractionsResilient } from "@/lib/attractions/resilient-attractions";

const center = { lat: 32.0853, lng: 34.7818 };
const attraction = { id: "osm-1", name: "Live", coordinates: center, category: "landmark" };

beforeEach(() => {
  vi.useFakeTimers();
  fetchAttractions.mockReset();
  searchPlaces.mockReset();
});

describe("fetchAttractionsResilient", () => {
  it("returns the last good result for the area when Overpass is down", async () => {
    fetchAttractions.mockResolvedValueOnce([attraction]);
    await fetchAttractionsResilient(center, 1000);

    fetchAttractions.mockRejectedValueOnce(new Error("Overpass API unavailable."));
    await expect(fetchAttractionsResilient(center, 1000)).resolves.toEqual([attraction]);
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("falls back to Nominatim when Overpass is down and nothing is cached", async () => {
    fetchAttractions.mockRejectedValue(new Error("Overpass API unavailable."));
    searchPlaces.mockImplementation(async (query: string) =>
      query === "park"
        ? [{ place_id: 7, display_name: "Gan Meir, Tel Aviv", lat: "32.0860", lon: "34.7820" }]
        : [],
    );

    const near = fetchAttractionsResilient(center, 2000);
    await vi.runAllTimersAsync();
    const list = await near;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Gan Meir", category: "park" });
  });
});
