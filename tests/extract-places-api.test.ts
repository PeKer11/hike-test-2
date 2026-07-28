import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractPlaceNames = vi.fn();
const mockResolveCanonicalName = vi.fn();
const mockSearchPlaces = vi.fn();
const mockGetUser = vi.fn();
const mockLearnPreferencesFromText = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: (...args: unknown[]) => mockExtractPlaceNames(...args),
  resolveCanonicalName: (...args: unknown[]) =>
    mockResolveCanonicalName(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/preferences/preference-store", () => ({
  learnPreferencesFromText: (...args: unknown[]) =>
    mockLearnPreferencesFromText(...args),
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
});
