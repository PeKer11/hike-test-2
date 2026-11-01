import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/preferences/consent", () => ({ hasLearningConsent: vi.fn(async () => true) }));

const mockExtractPlaceNames = vi.fn();
const mockSearchPlaces = vi.fn();
const mockFetchAttractions = vi.fn();
const mockGetUser = vi.fn();
const mockSearchTextPlaces = vi.fn();
const mockSearchNearbyPlaces = vi.fn();
const mockCreatePlacesGate = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: async (...args: unknown[]) => ({
    durationMinutes: null,
    categoryNeeds: [],
    ...((await mockExtractPlaceNames(...args)) as object),
  }),
  resolveCanonicalName: async () => null,
}));
vi.mock("@/lib/attractions/overpass-client", () => ({ fetchAttractions: (...a: unknown[]) => mockFetchAttractions(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mockGetUser } }) }));
vi.mock("@/lib/preferences/preference-store", () => ({
  learnPreferencesFromText: async () => null,
  getPreferredCategories: async () => [],
  getDislikedCategories: async () => [],
  getDownvotedCategories: async () => new Map(),
}));
vi.mock("@/lib/preferences/fact-store", () => ({ learnFactsFromText: async () => null, getStandingFacts: async () => [] }));
vi.mock("@/lib/api/nominatim-client", () => ({ searchPlaces: (...a: unknown[]) => mockSearchPlaces(...a) }));
vi.mock("@/lib/api/google-places-client", () => ({
  googlePlacesAvailable: () => true,
  searchTextPlaces: (...a: unknown[]) => mockSearchTextPlaces(...a),
  searchNearbyPlaces: (...a: unknown[]) => mockSearchNearbyPlaces(...a),
}));
vi.mock("@/lib/api/places-quota", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/places-quota")>()),
  createPlacesGate: (...a: unknown[]) => mockCreatePlacesGate(...a),
}));

import { POST } from "@/app/api/extract-places/route";

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/extract-places", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const GOOGLE_PLACE = {
  placeId: "ChIJabcdefghij",
  name: "Cafe Google",
  coordinates: { lat: 32.07, lng: 34.78 },
  primaryType: "cafe",
  types: ["cafe"],
};

describe("extract-places Google Places quota", () => {
  const take = vi.fn();
  beforeEach(() => {
    for (const m of [mockExtractPlaceNames, mockSearchPlaces, mockFetchAttractions, mockGetUser, mockSearchTextPlaces, mockSearchNearbyPlaces, mockCreatePlacesGate, take]) m.mockReset();
    mockCreatePlacesGate.mockReturnValue({ take });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetchAttractions.mockResolvedValue([]);
    mockSearchPlaces.mockResolvedValue([{ lat: "32.0736", lon: "34.7811", display_name: "Habima, Tel Aviv" }]);
    mockSearchTextPlaces.mockResolvedValue([GOOGLE_PLACE]);
    mockSearchNearbyPlaces.mockResolvedValue([GOOGLE_PLACE]);
    mockExtractPlaceNames.mockResolvedValue({ places: ["Habima Square"], contextLocation: null, categoryNeeds: ["food"] });
    delete process.env.LLM_OWNER_USER_IDS;
  });

  it("falls back to Nominatim and OSM when the gate refuses", async () => {
    take.mockResolvedValue(false);
    const response = await POST(request({ prompt: "Habima and a bite", nearLocation: { lat: 32.07, lng: 34.78 } }));
    expect(response.status).toBe(200);
    expect(mockSearchTextPlaces).not.toHaveBeenCalled();
    expect(mockSearchNearbyPlaces).not.toHaveBeenCalled();
    expect(mockSearchPlaces).toHaveBeenCalled();
    expect(mockFetchAttractions).toHaveBeenCalled();
  });

  it("takes one unit per geocode and one per need kind when the gate allows", async () => {
    take.mockResolvedValue(true);
    await POST(request({ prompt: "Habima and a bite", nearLocation: { lat: 32.07, lng: 34.78 } }));
    expect(mockSearchTextPlaces).toHaveBeenCalled();
    expect(mockSearchNearbyPlaces).toHaveBeenCalled();
    const amounts = take.mock.calls.map((c) => c[0] ?? 1);
    expect(amounts).toEqual([1, 1]);
  });

  it("keys the gate to the ip bucket for anonymous callers and to the user when learning is on", async () => {
    take.mockResolvedValue(false);
    await POST(request({ prompt: "Habima" }, { "x-forwarded-for": "198.51.100.7" }));
    expect(mockCreatePlacesGate.mock.calls[0][0].key).toMatch(/^places:ip:[0-9a-f]{32}$/);

    mockCreatePlacesGate.mockClear();
    await POST(request({ prompt: "Habima", learnPreferences: true }));
    const opts = mockCreatePlacesGate.mock.calls[0][0];
    expect(opts.key).toBe("places:user:u1");
    expect(opts.dailyCap).toBe(80);
    expect(opts.perTurnCap).toBe(16);

    mockCreatePlacesGate.mockClear();
    process.env.LLM_OWNER_USER_IDS = "u1";
    await POST(request({ prompt: "Habima", learnPreferences: true }));
    expect(mockCreatePlacesGate.mock.calls[0][0].dailyCap).toBe(2000);
  });
});
