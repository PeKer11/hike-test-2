import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractPlaceNames = vi.fn();
const mockResolveCanonicalName = vi.fn();
const mockSearchPlaces = vi.fn();
const mockGetUser = vi.fn();
const mockLearnPreferencesFromText = vi.fn();
const mockFetchAttractions = vi.fn();
const mockGetPreferredCategories = vi.fn();
const mockGetDownvotedCategories = vi.fn();

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
