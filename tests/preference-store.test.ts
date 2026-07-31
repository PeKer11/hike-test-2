import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/gemini-client", () => ({
  extractCategoryPreferences: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  getDownvotedCategories,
  getPreferredCategories,
} from "@/lib/preferences/preference-store";

// Just enough of the PostgREST builder for `.from().select().eq().maybeSingle()`.
type Result = { data: unknown; error: unknown };

function fakeSupabase(result: Result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  };
  return { from: () => builder } as unknown as Parameters<
    typeof getPreferredCategories
  >[0];
}

describe("getPreferredCategories", () => {
  it("returns the saved categories", async () => {
    const categories = await getPreferredCategories(
      fakeSupabase({
        data: { preferred_categories: ["museum", "nature"] },
        error: null,
      }),
      "user-1",
    );

    expect(categories).toEqual(["museum", "nature"]);
  });

  // `preferred_categories` is text[], so a value from an older schema survives
  // in the column. Keeping it would switch the ranker's exploration branch on
  // with nothing to explore away from.
  it("drops values that are no longer known categories", async () => {
    const categories = await getPreferredCategories(
      fakeSupabase({
        data: { preferred_categories: ["cafe", "museum", 7, null] },
        error: null,
      }),
      "user-1",
    );

    expect(categories).toEqual(["museum"]);
  });

  it("reads a profile of nothing but stale values as no preferences", async () => {
    const categories = await getPreferredCategories(
      fakeSupabase({ data: { preferred_categories: ["cafe"] }, error: null }),
      "user-1",
    );

    expect(categories).toEqual([]);
  });

  it.each([
    ["a failed read", { data: null, error: new Error("boom") }],
    ["no profile row", { data: null, error: null }],
    ["a null column", { data: { preferred_categories: null }, error: null }],
  ])("returns no preferences for %s", async (_label, result) => {
    expect(await getPreferredCategories(fakeSupabase(result), "user-1")).toEqual(
      [],
    );
  });
});

// Just enough of the builder for `.from().select().eq().eq().is()`, which
// resolves as a list rather than through `.maybeSingle()`. `filters` records
// the narrowing so the category-level scope can be asserted.
function fakeFeedbackSupabase(result: Result) {
  const filters: Record<string, unknown> = {};
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    is: (column: string, value: unknown) => {
      filters[column] = value;
      return Promise.resolve(result);
    },
  };
  return {
    filters,
    client: { from: () => builder } as unknown as Parameters<
      typeof getDownvotedCategories
    >[0],
  };
}

describe("getDownvotedCategories", () => {
  it("returns the categories the walker has voted down", async () => {
    const { client } = fakeFeedbackSupabase({
      data: [{ category: "food" }, { category: "shopping" }],
      error: null,
    });

    expect(await getDownvotedCategories(client, "user-1")).toEqual([
      "food",
      "shopping",
    ]);
  });

  // A downvote on one museum means "not that place", not "not museums" — the
  // category-level rows are the ones with no POI attached.
  it("asks only for this user's category-level downvotes", async () => {
    const { client, filters } = fakeFeedbackSupabase({ data: [], error: null });

    await getDownvotedCategories(client, "user-1");

    expect(filters).toEqual({
      user_id: "user-1",
      signal: "downvote",
      poi_name: null,
    });
  });

  it("de-duplicates and drops values that are no longer known categories", async () => {
    const { client } = fakeFeedbackSupabase({
      data: [
        { category: "food" },
        { category: "cafe" },
        { category: "food" },
        { category: null },
      ],
      error: null,
    });

    expect(await getDownvotedCategories(client, "user-1")).toEqual(["food"]);
  });

  it.each([
    ["a failed read", { data: null, error: new Error("boom") }],
    ["no feedback rows", { data: [], error: null }],
    ["a null payload", { data: null, error: null }],
  ])("returns no downvotes for %s", async (_label, result) => {
    const { client } = fakeFeedbackSupabase(result);

    expect(await getDownvotedCategories(client, "user-1")).toEqual([]);
  });
});
