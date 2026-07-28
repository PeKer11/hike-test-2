import { afterEach, describe, expect, it, vi } from "vitest";

import { searchPlaces } from "@/lib/api/nominatim-client";

function mockFetchOnce(payload: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
    text: async () => "",
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestParams(fetchMock: ReturnType<typeof vi.fn>): URLSearchParams {
  const url = new URL(fetchMock.mock.calls[0][0] as string);
  return url.searchParams;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchPlaces", () => {
  const zichronYaakov = { lat: 32.585, lng: 34.952 };

  it("hard-bounds a biased search to a ~10 km box", async () => {
    const fetchMock = mockFetchOnce([]);

    await searchPlaces("מדרחוב", 1, zichronYaakov);

    const params = requestParams(fetchMock);
    expect(params.get("bounded")).toBe("1");
    expect(params.get("viewbox")).toBe("34.852,32.485,35.052,32.685");
  });

  it("returns no results rather than a distant match when the box is empty", async () => {
    mockFetchOnce([]);

    await expect(searchPlaces("גן טייל", 1, zichronYaakov)).resolves.toEqual([]);
  });

  it("leaves an unbiased search broad and unbounded", async () => {
    const fetchMock = mockFetchOnce([{ lat: "32.0736", lon: "34.7811" }]);

    await searchPlaces("Habima Square", 5);

    const params = requestParams(fetchMock);
    expect(params.has("bounded")).toBe(false);
    expect(params.has("viewbox")).toBe(false);
    expect(params.get("limit")).toBe("5");
  });

  it("ignores a bias with non-finite coordinates", async () => {
    const fetchMock = mockFetchOnce([]);

    await searchPlaces("מדרחוב", 1, { lat: Number.NaN, lng: 34.952 });

    const params = requestParams(fetchMock);
    expect(params.has("bounded")).toBe(false);
  });

  it("skips the request entirely for a blank query", async () => {
    const fetchMock = mockFetchOnce([]);

    await expect(searchPlaces("   ", 1, zichronYaakov)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
