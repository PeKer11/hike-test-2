import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  googlePlacesAvailable,
  searchNearbyPlaces,
  searchTextPlaces,
} from "@/lib/api/google-places-client";

const okResponse = (places: unknown[]) =>
  new Response(JSON.stringify({ places }), { status: 200 });

describe("google-places-client", () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    delete process.env.GOOGLE_PLACES_DAILY_CAP;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it("is unavailable without a key", () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    expect(googlePlacesAvailable()).toBe(false);
  });

  it("maps a text search result and asks only for Pro-tier fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse([
        {
          id: "abc",
          displayName: { text: "הבימה" },
          location: { latitude: 32.07, longitude: 34.77 },
          primaryType: "performing_arts_theater",
          types: ["performing_arts_theater"],
        },
        { id: "no-location", displayName: { text: "x" } },
      ]),
    );
    const result = await searchTextPlaces("הבימה תל אביב", { lat: 32.5, lng: 34.9 });
    expect(result).toEqual([
      {
        placeId: "abc",
        name: "הבימה",
        coordinates: { lat: 32.07, lng: 34.77 },
        primaryType: "performing_arts_theater",
        types: ["performing_arts_theater"],
      },
    ]);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).not.toMatch(/rating/);
    expect(JSON.parse(init.body as string).locationBias).toBeDefined();
  });

  it("throws on a non-OK response so callers can fall back", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 403 }));
    await expect(searchNearbyPlaces("food", { lat: 1, lng: 1 }, 1000)).rejects.toThrow(/403/);
  });

  it("stops calling Google once the daily cap is reached", async () => {
    process.env.GOOGLE_PLACES_DAILY_CAP = "1";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse([]));
    // The module-level counter may already hold calls from earlier tests, so
    // spend until the cap trips.
    let guard = 0;
    while (googlePlacesAvailable() && guard++ < 10) {
      await searchTextPlaces("x");
    }
    expect(googlePlacesAvailable()).toBe(false);
    await expect(searchTextPlaces("x")).rejects.toThrow(/unavailable/);
  });
});
