import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSaveWalkFeedback = vi.fn();
const mockLearnPreferencesFromText = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/preferences/preference-store", () => ({
  saveWalkFeedback: (...args: unknown[]) => mockSaveWalkFeedback(...args),
  learnPreferencesFromText: (...args: unknown[]) =>
    mockLearnPreferencesFromText(...args),
}));

import { POST } from "@/app/api/walk-feedback/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/walk-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SIGNED_IN = { data: { user: { id: "user-1" } } };

describe("POST /api/walk-feedback", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue(SIGNED_IN);
    mockSaveWalkFeedback.mockReset();
    mockSaveWalkFeedback.mockImplementation(
      async (_client, _userId, _signal, categories: string[]) => categories,
    );
    mockLearnPreferencesFromText.mockReset();
    mockLearnPreferencesFromText.mockResolvedValue(null);
  });

  it("records one category-level row per category the walk contained", async () => {
    const response = await POST(
      postRequest({
        liked: true,
        categories: ["nature", "museum"],
        learnPreferences: true,
      }),
    );

    const body = await response.json();

    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      ["nature", "museum"],
    );
    expect(body).toMatchObject({
      saved: true,
      categoriesRecorded: ["nature", "museum"],
    });
  });

  it("records a thumbs-down as a downvote", async () => {
    await POST(
      postRequest({ liked: false, categories: ["food"], learnPreferences: true }),
    );

    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "downvote",
      ["food"],
    );
  });

  it("drops unknown categories, duplicates, and 'other'", async () => {
    await POST(
      postRequest({
        liked: true,
        categories: ["nature", "nature", "other", "beaches", 7],
        learnPreferences: true,
      }),
    );

    expect(mockSaveWalkFeedback).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "upvote",
      ["nature"],
    );
  });

  it("sends the free-text elaboration through the shared preference pass", async () => {
    mockLearnPreferencesFromText.mockResolvedValueOnce(["nature"]);

    const response = await POST(
      postRequest({
        liked: true,
        comment: "  I loved the nature stops  ",
        categories: ["nature"],
        learnPreferences: true,
      }),
    );

    const body = await response.json();

    expect(mockLearnPreferencesFromText).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "I loved the nature stops",
    );
    expect(body.preferredCategories).toEqual(["nature"]);
  });

  it("makes no preference call when there is no elaboration", async () => {
    await POST(
      postRequest({ liked: true, categories: ["nature"], learnPreferences: true }),
    );

    expect(mockLearnPreferencesFromText).not.toHaveBeenCalled();
  });

  it("writes nothing when preference learning is turned off", async () => {
    const response = await POST(
      postRequest({ liked: true, categories: ["nature"] }),
    );

    expect(await response.json()).toEqual({ saved: false });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSaveWalkFeedback).not.toHaveBeenCalled();
  });

  it("writes nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      postRequest({ liked: true, categories: ["nature"], learnPreferences: true }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: false });
    expect(mockSaveWalkFeedback).not.toHaveBeenCalled();
  });

  it("rejects a request with no rating", async () => {
    const response = await POST(postRequest({ categories: ["nature"] }));

    expect(response.status).toBe(400);
  });
});
