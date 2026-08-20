import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractPlaceNames = vi.fn();
const mockResolveCanonicalName = vi.fn();
const mockSearchPlaces = vi.fn();
const mockGetUser = vi.fn();
const mockLearnPreferencesFromText = vi.fn();
const mockFetchAttractions = vi.fn();
const mockGetPreferredCategories = vi.fn();
const mockGetDownvotedCategories = vi.fn();
const mockLearnFactsFromText = vi.fn();
const mockGetStandingFacts = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  // The real `extractPlaceNames` always returns all four fields, so the mock
  // fills in the two most tests do not care about rather than making every
  // case restate them.
  extractPlaceNames: async (...args: unknown[]) => ({
    durationMinutes: null,
    categoryNeeds: [],
    ...((await mockExtractPlaceNames(...args)) as object),
  }),
  resolveCanonicalName: (...args: unknown[]) =>
    mockResolveCanonicalName(...args),
}));

vi.mock("@/lib/attractions/overpass-client", () => ({
  fetchAttractions: (...args: unknown[]) => mockFetchAttractions(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/preferences/preference-store", () => ({
  learnPreferencesFromText: (...args: unknown[]) =>
    mockLearnPreferencesFromText(...args),
  getPreferredCategories: (...args: unknown[]) =>
    mockGetPreferredCategories(...args),
  getDownvotedCategories: (...args: unknown[]) =>
    mockGetDownvotedCategories(...args),
}));

vi.mock("@/lib/preferences/fact-store", () => ({
  learnFactsFromText: (...args: unknown[]) => mockLearnFactsFromText(...args),
  getStandingFacts: (...args: unknown[]) => mockGetStandingFacts(...args),
}));

vi.mock("@/lib/api/nominatim-client", () => ({
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

import { POST } from "@/app/api/extract-places/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/extract-places", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract-places", () => {
  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockResolveCanonicalName.mockReset();
    mockResolveCanonicalName.mockResolvedValue(null);
    mockSearchPlaces.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
    mockFetchAttractions.mockReset();
    mockFetchAttractions.mockResolvedValue([]);
    mockGetPreferredCategories.mockReset();
    mockGetPreferredCategories.mockResolvedValue([]);
    mockGetDownvotedCategories.mockReset();
    mockGetDownvotedCategories.mockResolvedValue(new Map());
  });

  it("surfaces both stated distances so the panel can pre-fill either field", async () => {
    // Ariel's live prompt states two different distances: how far out to search
    // and where the walk has to finish. Both ride through untouched.
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["גן טייל"],
      contextLocation: "זכרון יעקב",
      categoryNeeds: ["food"],
      searchRadiusKm: 10,
      maxEndDistanceKm: 1,
    });
    mockSearchPlaces.mockResolvedValue([{ lat: "32.5720", lon: "34.9520" }]);

    const response = await POST(
      postRequest({
        prompt:
          'אני רוצה טיול בזכרון יעקב בגן טייל ולאכול משהו, להתחיל מאיפה שאני נמצא עכשיו עד 10 ק"מ, לסיים עד 1 ק"מ מאיפה שאני נמצא עכשיו',
      }),
    );
    const body = await response.json();

    expect(body.searchRadiusKm).toBe(10);
    expect(body.maxEndDistanceKm).toBe(1);
  });

  it("reports a search radius the prompt never stated as null", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([
      { lat: "32.0736", lon: "34.7811" },
    ]);

    const response = await POST(
      postRequest({ prompt: "I want to go to Habima Square" }),
    );
    const body = await response.json();

    expect(body.searchRadiusKm).toBeNull();
  });

  // The two fields added for "bring me 3 famous places in Tel Aviv". The
  // extraction schema and its parsers are covered in `place-extractor.test.ts`;
  // what is measured here is the half that was never asserted anywhere — that
  // this endpoint carries both to the client rather than reading and dropping
  // them, which is exactly how "3" and "famous" used to be lost.
  it("carries a stated stop count and a famous-places ask through to the response", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Tel Aviv"],
      contextLocation: null,
      stopCount: 3,
      notableOnly: true,
    });
    mockSearchPlaces.mockResolvedValue([
      { lat: "32.0853", lon: "34.7818", addresstype: "city" },
    ]);

    const response = await POST(
      postRequest({ prompt: "bring me 3 famous places in Tel Aviv" }),
    );
    const body = await response.json();

    expect(body.stopCount).toBe(3);
    expect(body.notableOnly).toBe(true);
    // Still the one destination it always was — the count is a fact about the
    // walk to be built, not an instruction to invent three names here.
    expect(body.extractedNames).toEqual(["Tel Aviv"]);
  });

  it("reports a stop count and a famous ask the prompt never made as null", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([
      { lat: "32.0736", lon: "34.7811" },
    ]);

    const response = await POST(
      postRequest({ prompt: "I want to go to Habima Square" }),
    );
    const body = await response.json();

    expect(body.stopCount).toBeNull();
    expect(body.notableOnly).toBeNull();
  });

  it("reports a name with no in-box match as unresolved", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([]);

    const response = await POST(
      postRequest({
        prompt: "אני רוצה ללכת למדרחוב בזכרון יעקב",
        nearLocation: { lat: 32.585, lng: 34.952 },
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSearchPlaces).toHaveBeenCalledWith("מדרחוב", 1, {
      lat: 32.585,
      lng: 34.952,
    });
    expect(body.attractions).toEqual([]);
    expect(body.unresolvedNames).toEqual(["מדרחוב"]);
  });

  it("geocodes without a bias when no location is given", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.0736", lon: "34.7811" }]);

    const response = await POST(
      postRequest({ prompt: "I want to go to Habima Square" }),
    );

    const body = await response.json();

    expect(mockSearchPlaces).toHaveBeenCalledWith("Habima Square", 1, undefined);
    expect(body.unresolvedNames).toEqual([]);
    expect(body.attractions[0].coordinates).toEqual({
      lat: 32.0736,
      lng: 34.7811,
    });
  });

  it("geocodes the context area first and biases the stops with it", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב", "גן טייל"],
      contextLocation: "זכרון יעקב",
    });
    // Zichron Yaakov itself, then the two stops found around it.
    mockSearchPlaces
      .mockResolvedValueOnce([{ lat: "32.5736", lon: "34.9522" }])
      .mockResolvedValueOnce([{ lat: "32.5741", lon: "34.9527" }])
      .mockResolvedValueOnce([{ lat: "32.5752", lon: "34.9539" }]);

    const response = await POST(
      postRequest({
        prompt: "מדרחוב וגן טייל בזכרון יעקב",
        // The walker is standing in Rishon LeZion — irrelevant to what they typed.
        nearLocation: { lat: 31.9635, lng: 34.8044 },
      }),
    );

    const body = await response.json();
    const contextBias = { lat: 32.5736, lng: 34.9522 };

    expect(mockSearchPlaces).toHaveBeenNthCalledWith(1, "זכרון יעקב", 1, undefined);
    expect(mockSearchPlaces).toHaveBeenNthCalledWith(2, "מדרחוב", 1, contextBias);
    expect(mockSearchPlaces).toHaveBeenNthCalledWith(3, "גן טייל", 1, contextBias);
    expect(body.contextLocation).toBe("זכרון יעקב");
    expect(body.extractedNames).toEqual(["מדרחוב", "גן טייל"]);
    expect(body.attractions).toHaveLength(2);
  }, 10000);

  it("falls back to the request location when the context area can't be geocoded", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב"],
      contextLocation: "זכרון יעקב",
    });
    mockSearchPlaces
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ lat: "31.9700", lon: "34.8000" }]);

    const response = await POST(
      postRequest({
        prompt: "מדרחוב בזכרון יעקב",
        nearLocation: { lat: 31.9635, lng: 34.8044 },
      }),
    );

    await response.json();

    expect(mockSearchPlaces).toHaveBeenNthCalledWith(2, "מדרחוב", 1, {
      lat: 31.9635,
      lng: 34.8044,
    });
  });

  it("retries a failed name under its mapped name, keeping the user's wording", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב"],
      contextLocation: "זכרון יעקב",
    });
    mockResolveCanonicalName.mockResolvedValueOnce("המייסדים");
    mockSearchPlaces
      // The context area, then nothing for "מדרחוב", then the mapped street.
      .mockResolvedValueOnce([{ lat: "32.5736", lon: "34.9522" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ lat: "32.5732", lon: "34.9540" }]);

    const response = await POST(
      postRequest({ prompt: "אני רוצה ללכת למדרחוב בזכרון יעקב" }),
    );

    const body = await response.json();
    const contextBias = { lat: 32.5736, lng: 34.9522 };

    expect(mockResolveCanonicalName).toHaveBeenCalledWith("מדרחוב", "זכרון יעקב");
    // The retry reuses the same bias as the attempt it replaces.
    expect(mockSearchPlaces).toHaveBeenNthCalledWith(3, "המייסדים", 1, contextBias);
    expect(body.unresolvedNames).toEqual([]);
    expect(body.attractions).toHaveLength(1);
    // The walker asked for "מדרחוב" — that stays the label, only the lookup changed.
    expect(body.attractions[0].name).toBe("מדרחוב");
    expect(body.attractions[0].coordinates).toEqual({
      lat: 32.5732,
      lng: 34.954,
    });
  }, 10000);

  it("reports the name unresolved when no mapped name is known", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב"],
      contextLocation: null,
    });
    mockResolveCanonicalName.mockResolvedValueOnce(null);
    mockSearchPlaces.mockResolvedValueOnce([]);

    const response = await POST(postRequest({ prompt: "מדרחוב" }));

    const body = await response.json();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(body.unresolvedNames).toEqual(["מדרחוב"]);
  });

  it("gives up after one retry when the mapped name doesn't geocode either", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["מדרחוב"],
      contextLocation: null,
    });
    mockResolveCanonicalName.mockResolvedValueOnce("המייסדים");
    mockSearchPlaces.mockResolvedValue([]);

    const response = await POST(postRequest({ prompt: "מדרחוב" }));

    const body = await response.json();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(2);
    expect(mockResolveCanonicalName).toHaveBeenCalledTimes(1);
    expect(body.attractions).toEqual([]);
    expect(body.unresolvedNames).toEqual(["מדרחוב"]);
  }, 10000);

  it("makes no separate context lookup for a bare city name", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["עכו"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.9281", lon: "35.0817" }]);

    const response = await POST(postRequest({ prompt: "תן לי טיול בעכו" }));

    const body = await response.json();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(mockSearchPlaces).toHaveBeenCalledWith("עכו", 1, undefined);
    expect(body.contextLocation).toBeNull();
    expect(body.attractions.map((a: { name: string }) => a.name)).toEqual(["עכו"]);
  });

  it("reads the same text for preferences when learning is on", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
    });

    const prompt = "אני מאד אוהב מקומות טבע, 90 דקות, לא יודע מה הקצב שלי";
    await POST(postRequest({ prompt, learnPreferences: true }));

    expect(mockLearnPreferencesFromText).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      prompt,
    );
  });

  it("learns nothing when the walker turned preference learning off", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.0736", lon: "34.7811" }]);

    const response = await POST(
      postRequest({ prompt: "I want to go to Habima Square" }),
    );

    // Place extraction is unaffected — only the learning side is skipped.
    expect((await response.json()).attractions).toHaveLength(1);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockLearnPreferencesFromText).not.toHaveBeenCalled();
  });

  it("learns nothing for a walker who is not signed in", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
    });
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      postRequest({ prompt: "I love nature spots", learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect(mockLearnPreferencesFromText).not.toHaveBeenCalled();
  });

  it("still answers with the places when the preference write blows up", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.0736", lon: "34.7811" }]);
    mockLearnPreferencesFromText.mockRejectedValueOnce(new Error("db down"));

    const response = await POST(
      postRequest({ prompt: "I love nature", learnPreferences: true }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attractions).toHaveLength(1);
  });

  it("returns a stated walk length so the time field can start from it", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
      durationMinutes: 180,
    });

    const response = await POST(postRequest({ prompt: "יש לי שלוש שעות" }));

    expect((await response.json()).durationMinutes).toBe(180);
  });

  it("reports a null duration when the text states none", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
    });

    const response = await POST(postRequest({ prompt: "a nice walk" }));

    expect((await response.json()).durationMinutes).toBeNull();
  });

  it("returns the context area's coordinates so the origin field can start from them", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "זכרון יעקב",
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.5736", lon: "34.9522" }]);

    const response = await POST(postRequest({ prompt: "טיול בזכרון יעקב" }));

    expect((await response.json()).contextCoordinates).toEqual({
      lat: 32.5736,
      lng: 34.9522,
    });
  });

  it("does not flag an area whose geocode result is named after it", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "זכרון יעקב",
    });
    mockSearchPlaces.mockResolvedValueOnce([
      {
        lat: "32.5736",
        lon: "34.9522",
        display_name: "זכרון יעקב, מחוז חיפה, ישראל",
      },
    ]);

    const body = await (await POST(postRequest({ prompt: "טיול בזכרון יעקב" })))
      .json();

    expect(body.contextLocationSuspect).toBe(false);
    expect(body.contextCoordinates).toEqual({ lat: 32.5736, lng: 34.9522 });
  });

  it("flags — without failing — an area the geocoder resolved to somewhere else", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "Zichron Yaakov",
    });
    mockSearchPlaces.mockResolvedValueOnce([
      { lat: "48.8566", lon: "2.3522", display_name: "Paris, France" },
    ]);

    const response = await POST(postRequest({ prompt: "a walk in Zichron Yaakov" }));
    const body = await response.json();

    // Flagged, not thrown: the walk is still built, the coordinate is still
    // reported, it just no longer passes as a verified origin.
    expect(response.status).toBe(200);
    expect(body.contextLocationSuspect).toBe(true);
    expect(body.contextCoordinates).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  it("does not flag an area when Nominatim returned no name to compare", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "זכרון יעקב",
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.5736", lon: "34.9522" }]);

    const body = await (await POST(postRequest({ prompt: "טיול בזכרון יעקב" })))
      .json();

    expect(body.contextLocationSuspect).toBe(false);
  });

  it("reports null context coordinates when the text names no area", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
    });

    const response = await POST(postRequest({ prompt: "a nice walk" }));

    expect((await response.json()).contextCoordinates).toBeNull();
  });

  it("reports null context coordinates when the named area can't be geocoded", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "Nowheresville",
    });
    mockSearchPlaces.mockResolvedValueOnce([]);

    const response = await POST(postRequest({ prompt: "a walk in Nowheresville" }));

    expect((await response.json()).contextCoordinates).toBeNull();
  });

  it("finds a real stop for a stated need, around the context area", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: "זכרון יעקב",
      categoryNeeds: ["food"],
    });
    // The context area geocode.
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.573", lon: "34.953" }]);
    mockFetchAttractions.mockResolvedValueOnce([
      {
        id: "osm-node-1",
        name: "עירית",
        coordinates: { lat: 32.5731, lng: 34.9531 },
        category: "park",
        avgVisitMinutes: 30,
        tags: {},
      },
      {
        id: "osm-node-2",
        name: "מסעדת הבית",
        coordinates: { lat: 32.5732, lng: 34.9532 },
        category: "food",
        avgVisitMinutes: 45,
        tags: { amenity: "restaurant" },
      },
    ]);

    const response = await POST(
      postRequest({ prompt: "אני גם רוצה לאכול משהו בזכרון יעקב" }),
    );
    const body = await response.json();

    expect(mockFetchAttractions).toHaveBeenCalledWith(
      { lat: 32.573, lng: 34.953 },
      2000,
    );
    // The best-ranked food place, not the higher-scoring park.
    expect(body.attractions).toHaveLength(1);
    expect(body.attractions[0].name).toBe("מסעדת הבית");
    expect(body.attractions[0].tags.source).toBe("prompt-need");
    expect(body.attractions[0].tags.needCategory).toBe("food");
  });

  it("searches around the request's own location when no context area was named", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
      categoryNeeds: ["food"],
    });

    await POST(
      postRequest({
        prompt: "I also want to eat something",
        nearLocation: { lat: 32.0736, lng: 34.7811 },
      }),
    );

    expect(mockFetchAttractions).toHaveBeenCalledWith(
      { lat: 32.0736, lng: 34.7811 },
      2000,
    );
  });

  it("does not search for POIs when the text states no need", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.0736", lon: "34.7811" }]);

    await POST(
      postRequest({
        prompt: "I want to go to Habima Square",
        nearLocation: { lat: 32.0736, lng: 34.7811 },
      }),
    );

    expect(mockFetchAttractions).not.toHaveBeenCalled();
  });

  it("skips the need search when there is nowhere to search around", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
      categoryNeeds: ["food"],
    });

    const response = await POST(
      postRequest({ prompt: "I also want to eat something" }),
    );

    expect(response.status).toBe(200);
    expect(mockFetchAttractions).not.toHaveBeenCalled();
    expect((await response.json()).attractions).toEqual([]);
  });

  it("omits the need silently when the POI search fails", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
      categoryNeeds: ["food"],
    });
    mockFetchAttractions.mockRejectedValueOnce(new Error("Overpass down"));

    const response = await POST(
      postRequest({
        prompt: "I also want to eat something",
        nearLocation: { lat: 32.0736, lng: 34.7811 },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attractions).toEqual([]);
    // Still reported, so a need that found nothing is visible when debugging.
    expect(body.categoryNeeds).toEqual(["food"]);
  });

  it("searches for a need for a walker who is not signed in", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce({
      places: [],
      contextLocation: null,
      categoryNeeds: ["religious"],
    });
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    await POST(
      postRequest({
        prompt: "show me a synagogue in the area",
        nearLocation: { lat: 32.0736, lng: 34.7811 },
      }),
    );

    // Unlike preference learning, an immediate need needs no login.
    expect(mockFetchAttractions).toHaveBeenCalled();
  });
});

// "bring me a walk in Zichron Yaakov" — a place and no intent at all. The old
// answer was a silently guessed generic walk.
describe("POST /api/extract-places — under-specified prompts", () => {
  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockResolveCanonicalName.mockReset();
    mockResolveCanonicalName.mockResolvedValue(null);
    mockSearchPlaces.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
    mockFetchAttractions.mockReset();
    mockFetchAttractions.mockResolvedValue([]);
    mockGetPreferredCategories.mockReset();
    mockGetPreferredCategories.mockResolvedValue([]);
    mockGetDownvotedCategories.mockReset();
    mockGetDownvotedCategories.mockResolvedValue(new Map());
  });

  function geocodesTo(kind: string) {
    mockSearchPlaces.mockResolvedValue([
      { lat: "32.5736", lon: "34.9522", addresstype: kind },
    ]);
  }

  it("asks what kind of walk when the prompt names only an area", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    geocodesTo("town");

    const response = await POST(
      postRequest({ prompt: "תביא לי טיול בזכרון יעקב" }),
    );
    const data = await response.json();

    expect(data.needsClarification).toBe(true);
    expect(data.clarificationCategories.length).toBeGreaterThan(0);
    // The guessed walk is still there — the question does not block it.
    expect(data.attractions).toHaveLength(1);
  });

  it("does not ask when the one place is a real destination", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["Habima Square"],
      contextLocation: null,
    });
    geocodesTo("square");

    const response = await POST(postRequest({ prompt: "Habima Square" }));
    const data = await response.json();

    expect(data.needsClarification).toBe(false);
    expect(data.clarificationCategories).toEqual([]);
  });

  it("does not ask when the prompt already stated a need", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
      categoryNeeds: ["food"],
    });
    geocodesTo("town");

    const response = await POST(
      postRequest({ prompt: "טיול בזכרון יעקב, ומשהו לאכול" }),
    );
    const data = await response.json();

    expect(data.needsClarification).toBe(false);
  });

  it("does not ask when the area could not be located at all", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["Nowheresville"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValue([]);

    const response = await POST(postRequest({ prompt: "Nowheresville" }));
    const data = await response.json();

    expect(data.needsClarification).toBe(false);
  });

  it("leads with a category the walker is known to like", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    geocodesTo("town");
    mockGetPreferredCategories.mockResolvedValue(["shopping"]);
    mockGetDownvotedCategories.mockResolvedValue(new Map([["museum", 2]]));

    const response = await POST(postRequest({ prompt: "טיול בזכרון יעקב" }));
    const data = await response.json();

    expect(data.clarificationCategories[0]).toBe("shopping");
    expect(data.clarificationCategories).not.toContain("museum");
  });

  it("still asks a generic question when the profile read fails", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    geocodesTo("town");
    mockGetPreferredCategories.mockRejectedValue(new Error("supabase down"));
    mockGetDownvotedCategories.mockRejectedValue(new Error("supabase down"));

    const response = await POST(postRequest({ prompt: "טיול בזכרון יעקב" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.needsClarification).toBe(true);
    expect(data.clarificationCategories[0]).toBe("landmark");
  });

  // The chip the walker tapped comes back as `categoryNeeds`, which is what
  // makes the second run find a real stop of that kind.
  it("plans for a tapped chip and stops asking", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    geocodesTo("town");
    mockFetchAttractions.mockResolvedValue([
      {
        id: "osm-node-1",
        name: "Winery",
        coordinates: { lat: 32.574, lng: 34.952 },
        category: "food",
        avgVisitMinutes: 45,
        tags: {},
      },
    ]);

    const response = await POST(
      postRequest({ prompt: "טיול בזכרון יעקב", categoryNeeds: ["food"] }),
    );
    const data = await response.json();

    expect(data.needsClarification).toBe(false);
    expect(data.categoryNeeds).toEqual(["food"]);
    expect(
      data.attractions.map((a: { name: string }) => a.name),
    ).toContain("Winery");
  });

  it("ignores a chip value that is not a known category", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    geocodesTo("town");

    const response = await POST(
      postRequest({ prompt: "טיול בזכרון יעקב", categoryNeeds: ["sushi"] }),
    );
    const data = await response.json();

    expect(data.categoryNeeds).toEqual([]);
    expect(data.needsClarification).toBe(true);
  });
});

describe("POST /api/extract-places — area-only prompts", () => {
  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockResolveCanonicalName.mockReset();
    mockResolveCanonicalName.mockResolvedValue(null);
    mockSearchPlaces.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
    mockFetchAttractions.mockReset();
    mockFetchAttractions.mockResolvedValue([]);
    mockGetPreferredCategories.mockReset();
    mockGetPreferredCategories.mockResolvedValue([]);
    mockGetDownvotedCategories.mockReset();
    mockGetDownvotedCategories.mockResolvedValue(new Map());
  });

  // Survives the answer: a kind of walk is not a stop, so the panel should
  // still top the walk up rather than hand over a two-stop afternoon.
  it("still reports an area-only prompt once a chip has been tapped", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["זכרון יעקב"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValue([
      { lat: "32.5736", lon: "34.9522", addresstype: "town" },
    ]);

    const response = await POST(
      postRequest({ prompt: "טיול בזכרון יעקב", categoryNeeds: ["food"] }),
    );
    const data = await response.json();

    expect(data.needsClarification).toBe(false);
    expect(data.areaOnlyPrompt).toBe(true);
  });

  it("does not report a named list as area-only", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["Habima Square"],
      contextLocation: null,
    });
    mockSearchPlaces.mockResolvedValue([
      { lat: "32.0736", lon: "34.7752", addresstype: "square" },
    ]);

    const response = await POST(postRequest({ prompt: "Habima Square" }));
    const data = await response.json();

    expect(data.areaOnlyPrompt).toBe(false);
  });
});

// Turn two of the clarifying conversation: the walker has picked a kind of
// walk, and now answers "how much time do you have, and how far do you want to
// end up?" in plain words. The stops were already found — this turn must add to
// what is known without taking anything away.
describe("POST /api/extract-places — the follow-up turn", () => {
  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockSearchPlaces.mockReset();
    mockFetchAttractions.mockReset();
    mockFetchAttractions.mockResolvedValue([]);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
  });

  it("reads the time and the finish distance out of the follow-up text", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: [],
      contextLocation: null,
      durationMinutes: 180,
      maxEndDistanceKm: 1,
    });

    const response = await POST(
      postRequest({
        prompt: "3 hours, up to 1km",
        followUp: true,
        categoryNeeds: ["nature", "food"],
      }),
    );
    const data = await response.json();

    expect(data.durationMinutes).toBe(180);
    expect(data.maxEndDistanceKm).toBe(1);
  });

  // The walker answered half the question. The other half came from their
  // original prompt and is not up for re-negotiation.
  it("keeps a known value the follow-up text did not restate", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: [],
      contextLocation: null,
      durationMinutes: null,
      maxEndDistanceKm: 1,
    });

    const response = await POST(
      postRequest({
        prompt: "up to 1km",
        followUp: true,
        knownDurationMinutes: 120,
        knownMaxEndDistanceKm: null,
      }),
    );
    const data = await response.json();

    expect(data.durationMinutes).toBe(120);
    expect(data.maxEndDistanceKm).toBe(1);
  });

  it("lets the follow-up text correct a value that was already known", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: [],
      contextLocation: null,
      durationMinutes: 180,
      maxEndDistanceKm: null,
    });

    const response = await POST(
      postRequest({
        prompt: "make it 3 hours",
        followUp: true,
        knownDurationMinutes: 120,
      }),
    );
    const data = await response.json();

    expect(data.durationMinutes).toBe(180);
  });

  // "Three hours, up to 1km" says nothing about food, and must not be read as
  // a request to drop the food stop the walker asked for one turn ago.
  it("keeps the categories picked on the chip turn", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: [],
      contextLocation: null,
      durationMinutes: 180,
      maxEndDistanceKm: null,
      categoryNeeds: [],
    });

    const response = await POST(
      postRequest({
        prompt: "3 hours",
        followUp: true,
        categoryNeeds: ["nature", "food"],
      }),
    );
    const data = await response.json();

    expect(data.categoryNeeds).toEqual(["nature", "food"]);
  });

  // The stops are the first turn's business. Re-geocoding them here would cost
  // a second round of one-per-second Nominatim calls to rebuild the same list.
  it("does not geocode anything on a follow-up", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: ["Habima Square"],
      contextLocation: "Tel Aviv",
      durationMinutes: 180,
      maxEndDistanceKm: null,
    });

    const response = await POST(
      postRequest({ prompt: "3 hours", followUp: true }),
    );
    const data = await response.json();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
    expect(mockFetchAttractions).not.toHaveBeenCalled();
    expect(data.attractions).toBeUndefined();
  });

  it("ignores a known value that is not a usable number", async () => {
    mockExtractPlaceNames.mockResolvedValue({
      places: [],
      contextLocation: null,
      durationMinutes: null,
      maxEndDistanceKm: null,
    });

    const response = await POST(
      postRequest({
        prompt: "not sure",
        followUp: true,
        knownDurationMinutes: "two hours",
        knownMaxEndDistanceKm: Number.NaN,
      }),
    );
    const data = await response.json();

    expect(data.durationMinutes).toBeNull();
    expect(data.maxEndDistanceKm).toBeNull();
  });

  it("still refuses an empty follow-up", async () => {
    const response = await POST(postRequest({ prompt: "   ", followUp: true }));

    expect(response.status).toBe(400);
    expect(mockExtractPlaceNames).not.toHaveBeenCalled();
  });
});

// The standing-fact pass rides alongside the preference pass under the same
// gate. Both are side effects of a request the walker made for places.
describe("POST /api/extract-places — standing facts", () => {
  const SIGNED_IN = { data: { user: { id: "user-1" } } };

  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockExtractPlaceNames.mockResolvedValue({ places: [], contextLocation: null });
    mockSearchPlaces.mockReset();
    mockSearchPlaces.mockResolvedValue([]);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue(SIGNED_IN);
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
    mockGetPreferredCategories.mockReset();
    mockGetPreferredCategories.mockResolvedValue([]);
    mockGetDownvotedCategories.mockReset();
    mockGetDownvotedCategories.mockResolvedValue(new Map());
    mockLearnFactsFromText.mockReset();
    mockLearnFactsFromText.mockResolvedValue({ facts: [], contradictions: [] });
  });

  it("reads the prompt for facts as well as preferences", async () => {
    await POST(
      postRequest({ prompt: "I don't eat meat", learnPreferences: true }),
    );

    expect(mockLearnFactsFromText).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "I don't eat meat",
    );
    expect(mockLearnPreferencesFromText).toHaveBeenCalled();
  });

  it("reads no facts when the walker has turned learning off", async () => {
    await POST(
      postRequest({ prompt: "I don't eat meat", learnPreferences: false }),
    );

    expect(mockLearnFactsFromText).not.toHaveBeenCalled();
  });

  it("reads no facts for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await POST(
      postRequest({ prompt: "I don't eat meat", learnPreferences: true }),
    );

    expect(mockLearnFactsFromText).not.toHaveBeenCalled();
  });

  it("reports a contradiction so the panel can offer the undo", async () => {
    const contradiction = {
      supersededFactId: "fact-1",
      supersededText: "does not eat meat",
      newFactId: "fact-2",
      newText: "eats meat",
    };
    mockLearnFactsFromText.mockResolvedValue({
      facts: [],
      contradictions: [contradiction],
    });

    const response = await POST(
      postRequest({ prompt: "I eat meat again", learnPreferences: true }),
    );

    expect((await response.json()).factContradictions).toEqual([contradiction]);
  });

  it("reports no contradictions for an ordinary prompt", async () => {
    const response = await POST(
      postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }),
    );

    expect((await response.json()).factContradictions).toEqual([]);
  });

  // The walker asked for places. Getting them must not depend on a profile
  // write, and a failed fact pass must not cost the preference pass either.
  it("still answers the prompt when the fact pass fails", async () => {
    mockLearnFactsFromText.mockRejectedValue(new Error("gemini 429"));

    const response = await POST(
      postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).factContradictions).toEqual([]);
    expect(mockLearnPreferencesFromText).toHaveBeenCalled();
  });
});

// Step 9: what the walker stands for reaches the model that reads their
// request. Facts are context for interpreting the words, never an addition to
// them — the system prompt carries that rule, this covers the plumbing.
describe("POST /api/extract-places — standing facts in the prompt", () => {
  const SIGNED_IN = { data: { user: { id: "user-1" } } };

  function fact(overrides: Record<string, unknown> = {}) {
    return {
      id: "fact-meat",
      text: "does not eat meat",
      key: "does not eat meat",
      importance: 3,
      occurrenceCount: 1,
      lastSeenAt: Date.now(),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockExtractPlaceNames.mockReset();
    mockExtractPlaceNames.mockResolvedValue({ places: [], contextLocation: null });
    mockSearchPlaces.mockReset();
    mockSearchPlaces.mockResolvedValue([]);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue(SIGNED_IN);
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
    mockGetPreferredCategories.mockReset();
    mockGetPreferredCategories.mockResolvedValue([]);
    mockGetDownvotedCategories.mockReset();
    mockGetDownvotedCategories.mockResolvedValue(new Map());
    mockLearnFactsFromText.mockReset();
    mockLearnFactsFromText.mockResolvedValue({ facts: [], contradictions: [] });
    mockGetStandingFacts.mockReset();
    mockGetStandingFacts.mockResolvedValue([]);
  });

  const factsPassed = () => mockExtractPlaceNames.mock.calls[0][1];

  it("hands the extraction what the walker stands for", async () => {
    mockGetStandingFacts.mockResolvedValue([fact()]);

    await POST(postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }));

    expect(factsPassed()).toEqual([
      expect.objectContaining({ text: "does not eat meat" }),
    ]);
  });

  // The one thing that makes the change safe to ship: a walker with nothing on
  // record sends the request this endpoint sent before facts existed.
  it("passes no facts for a walker with none on record", async () => {
    await POST(postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }));

    expect(factsPassed()).toEqual([]);
  });

  it("passes no facts when the walker has turned learning off", async () => {
    mockGetStandingFacts.mockResolvedValue([fact()]);

    await POST(postRequest({ prompt: "a walk in Jaffa", learnPreferences: false }));

    expect(mockGetStandingFacts).not.toHaveBeenCalled();
    expect(factsPassed()).toEqual([]);
  });

  it("passes no facts for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockGetStandingFacts.mockResolvedValue([fact()]);

    await POST(postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }));

    expect(mockGetStandingFacts).not.toHaveBeenCalled();
    expect(factsPassed()).toEqual([]);
  });

  // A profile read is not worth a failed prompt.
  it("falls through to a plain extraction when the fact read fails", async () => {
    mockGetStandingFacts.mockRejectedValue(new Error("boom"));

    const response = await POST(
      postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect(factsPassed()).toEqual([]);
  });

  // Reading them after the learning pass would let a fact this very sentence
  // teaches us change how the same sentence is read.
  it("uses the facts as they stood before this prompt was learned from", async () => {
    mockGetStandingFacts.mockResolvedValue([fact()]);

    await POST(
      postRequest({ prompt: "I eat meat again", learnPreferences: true }),
    );

    expect(mockGetStandingFacts).toHaveBeenCalledBefore(mockLearnFactsFromText);
  });

  it("leaves out a fact too faded to be worth prompt tokens", async () => {
    const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    mockGetStandingFacts.mockResolvedValue([
      fact({ id: "fresh", text: "does not eat meat", importance: 3 }),
      fact({
        id: "faded",
        text: "prefers quiet streets",
        key: "prefers quiet streets",
        importance: 1,
        lastSeenAt: Date.now() - YEAR_MS,
      }),
    ]);

    await POST(postRequest({ prompt: "a walk in Jaffa", learnPreferences: true }));

    expect(factsPassed()).toEqual([
      expect.objectContaining({ text: "does not eat meat" }),
    ]);
  });
});
