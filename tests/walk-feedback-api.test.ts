import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSaveAttractionFeedback = vi.fn();
const mockSaveWalkFeedback = vi.fn();
const mockLearnPreferencesFromText = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/api/gemini-client", () => ({
  extractCategoryPreferences: vi.fn(),
}));

vi.mock("@/lib/preferences/preference-store", async () => {
  // The category derivation is pure and tested on its own — the route is tested
  // against the real one so a change in its rules shows up here too.
  const actual = await vi.importActual<
    typeof import("@/lib/preferences/preference-store")
  >("@/lib/preferences/preference-store");

  return {
    deriveCategorySignals: actual.deriveCategorySignals,
    saveAttractionFeedback: (...args: unknown[]) =>
      mockSaveAttractionFeedback(...args),
    saveWalkFeedback: (...args: unknown[]) => mockSaveWalkFeedback(...args),
    learnPreferencesFromText: (...args: unknown[]) =>
      mockLearnPreferencesFromText(...args),
  };
});

import { POST } from "@/app/api/walk-feedback/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/walk-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rating(overrides: Record<string, unknown> = {}) {
  return {
    id: "osm-node-1234567",
    name: "Eretz Israel Museum",
    lat: 32.1,
    lng: 34.79,
    category: "museum",
    liked: true,
    ...overrides,
  };
}

const SIGNED_IN = { data: { user: { id: "user-1" } } };

describe("POST /api/walk-feedback", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue(SIGNED_IN);
    mockSaveAttractionFeedback.mockReset();
    mockSaveAttractionFeedback.mockImplementation(
      async (_client, _userId, ratings: unknown[]) => ratings.length,
    );
    mockSaveWalkFeedback.mockReset();
    mockSaveWalkFeedback.mockImplementation(
      async (_client, _userId, _signal, categories: string[]) => categories,
    );
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
  });

  it("writes a POI-level row carrying the real place, id and coordinates", async () => {
    const response = await POST(
      postRequest({ ratings: [rating()], learnPreferences: true }),
    );

    expect(mockSaveAttractionFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      [
        {
          osmId: "osm-node-1234567",
          name: "Eretz Israel Museum",
          lat: 32.1,
          lng: 34.79,
          category: "museum",
          signal: "upvote",
        },
      ],
    );
    expect(await response.json()).toMatchObject({ saved: true, poisRecorded: 1 });
  });

  // A stop the walker named in the prompt box was geocoded, not discovered on
  // OSM, so there is no id to recognise it by later.
  it("leaves osm_id null for a stop with no Overpass identity", async () => {
    await POST(
      postRequest({
        ratings: [rating({ id: "prompt-0-old-jaffa" })],
        learnPreferences: true,
      }),
    );

    expect(mockSaveAttractionFeedback.mock.calls[0][2][0].osmId).toBeNull();
  });

  it("raises the rated stop's category as a standing signal", async () => {
    const response = await POST(
      postRequest({
        ratings: [rating(), rating({ name: "Yarkon Park", category: "park" })],
        learnPreferences: true,
      }),
    );

    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      ["museum", "park"],
    );
    expect(await response.json()).toMatchObject({
      categoriesRecorded: ["museum", "park"],
    });
  });

  it("lowers the category of a stop the walker voted down", async () => {
    await POST(
      postRequest({
        ratings: [rating({ liked: false })],
        learnPreferences: true,
      }),
    );

    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "downvote",
      ["museum"],
    );
    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      [],
    );
  });

  // One liked museum and one disliked museum in the same walk: the POI rows
  // keep both, the category can only hold one and the last tap wins.
  it("resolves two ratings of one category to the most recent", async () => {
    await POST(
      postRequest({
        ratings: [
          rating(),
          rating({ name: "Small Museum", liked: false }),
          rating({ name: "Yarkon Park", category: "park" }),
        ],
        learnPreferences: true,
      }),
    );

    expect(mockSaveAttractionFeedback.mock.calls[0][2]).toHaveLength(3);
    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      ["park"],
    );
    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "downvote",
      ["museum"],
    );
  });

  // 'other' is where every unclassified POI lands, so a standing signal on it
  // would tell the planner to favour anything at all. The POI row still stands.
  it("keeps an unclassified stop's row but not its category signal", async () => {
    await POST(
      postRequest({
        ratings: [rating({ category: "other" })],
        learnPreferences: true,
      }),
    );

    expect(mockSaveAttractionFeedback.mock.calls[0][2]).toHaveLength(1);
    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      [],
    );
  });

  it("drops ratings that could not become a POI-level row", async () => {
    await POST(
      postRequest({
        ratings: [
          rating({ name: "  " }),
          rating({ lat: null }),
          rating({ category: "beaches" }),
          rating({ liked: "yes" }),
          rating({ name: "Yarkon Park", category: "park" }),
        ],
        learnPreferences: true,
      }),
    );

    expect(mockSaveAttractionFeedback.mock.calls[0][2]).toEqual([
      expect.objectContaining({ name: "Yarkon Park" }),
    ]);
  });

  it("sends the free-text elaboration through the shared preference pass", async () => {
    mockLearnPreferencesFromText.mockResolvedValueOnce(["nature"]);

    const response = await POST(
      postRequest({
        ratings: [rating()],
        comment: "  I loved the nature stops  ",
        learnPreferences: true,
      }),
    );

    expect(mockLearnPreferencesFromText).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "I loved the nature stops",
    );
    expect((await response.json()).preferredCategories).toEqual(["nature"]);
  });

  it("makes no preference call when there is no elaboration", async () => {
    await POST(postRequest({ ratings: [rating()], learnPreferences: true }));

    expect(mockLearnPreferencesFromText).not.toHaveBeenCalled();
  });

  it("accepts a comment on its own, with nothing rated", async () => {
    const response = await POST(
      postRequest({ comment: "lovely evening", learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect(mockSaveAttractionFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      [],
    );
  });

  it("writes nothing when preference learning is turned off", async () => {
    const response = await POST(postRequest({ ratings: [rating()] }));

    expect(await response.json()).toEqual({ saved: false });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSaveAttractionFeedback).not.toHaveBeenCalled();
    expect(mockSaveWalkFeedback).not.toHaveBeenCalled();
  });

  it("writes nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      postRequest({ ratings: [rating()], learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: false });
    expect(mockSaveAttractionFeedback).not.toHaveBeenCalled();
    expect(mockSaveWalkFeedback).not.toHaveBeenCalled();
  });

  it("rejects a request with nothing to record", async () => {
    const response = await POST(postRequest({ ratings: [], learnPreferences: true }));

    expect(response.status).toBe(400);
  });
});
