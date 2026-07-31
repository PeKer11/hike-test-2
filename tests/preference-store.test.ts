import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/gemini-client", () => ({
  extractCategoryPreferences: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getPreferredCategories } from "@/lib/preferences/preference-store";

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
