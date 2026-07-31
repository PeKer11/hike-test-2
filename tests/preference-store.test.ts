import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/gemini-client", () => ({
  extractCategoryPreferences: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  deriveCategorySignals,
  getDownvotedCategories,
  getPreferredCategories,
  getProfileDefaults,
  saveAttractionFeedback,
  type AttractionRating,
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

// What the walk form opens on. Every failure mode has to read as "nothing
// saved" rather than as an error: this read runs while the hub page renders.
describe("getProfileDefaults", () => {
  it("returns the saved pace and interests", async () => {
    expect(
      await getProfileDefaults(
        fakeSupabase({
          data: {
            walking_pace_min_per_km: 13.5,
            preferred_categories: ["museum", "park"],
          },
          error: null,
        }),
        "user-1",
      ),
    ).toEqual({
      walkingPaceMinPerKm: 13.5,
      preferredCategories: ["museum", "park"],
    });
  });

  // PostgREST can hand a numeric column back as a string.
  it("reads a pace that arrived as a string", async () => {
    const defaults = await getProfileDefaults(
      fakeSupabase({
        data: { walking_pace_min_per_km: "18.0", preferred_categories: [] },
        error: null,
      }),
      "user-1",
    );

    expect(defaults.walkingPaceMinPerKm).toBe(18);
  });

  it.each([
    ["never recorded", null],
    ["out of range", 120],
    ["not a number", "brisk"],
  ])("reads a pace that is %s as no saved pace", async (_label, pace) => {
    const defaults = await getProfileDefaults(
      fakeSupabase({
        data: { walking_pace_min_per_km: pace, preferred_categories: [] },
        error: null,
      }),
      "user-1",
    );

    expect(defaults.walkingPaceMinPerKm).toBeNull();
  });

  // Same guard as `getPreferredCategories` — a category from an older schema is
  // not one the form has a chip for.
  it("drops interests that are no longer known categories", async () => {
    const defaults = await getProfileDefaults(
      fakeSupabase({
        data: {
          walking_pace_min_per_km: null,
          preferred_categories: ["cafe", "nature"],
        },
        error: null,
      }),
      "user-1",
    );

    expect(defaults.preferredCategories).toEqual(["nature"]);
  });

  it.each([
    ["a failed read", { data: null, error: new Error("boom") }],
    ["no profile row", { data: null, error: null }],
  ])("reads %s as nothing saved", async (_label, result) => {
    expect(await getProfileDefaults(fakeSupabase(result), "user-1")).toEqual({
      walkingPaceMinPerKm: null,
      preferredCategories: [],
    });
  });

  // The page above renders around this call — a client that throws must cost the
  // pre-fill, not the page.
  it("reads a client that throws as nothing saved", async () => {
    const throwing = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as Parameters<typeof getProfileDefaults>[0];

    expect(await getProfileDefaults(throwing, "user-1")).toEqual({
      walkingPaceMinPerKm: null,
      preferredCategories: [],
    });
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

function rating(overrides: Partial<AttractionRating> = {}): AttractionRating {
  return {
    osmId: "osm-node-1234567",
    name: "Eretz Israel Museum",
    lat: 32.1,
    lng: 34.79,
    category: "museum",
    signal: "upvote",
    ...overrides,
  };
}

// Just enough of the builder for `.from().delete().eq().eq().eq()` and
// `.from().insert()`. `deletes` and `inserts` record what each write asked for.
function fakeWriteSupabase(
  results: { deleteError?: unknown; insertError?: unknown } = {},
) {
  const deletes: Record<string, unknown>[] = [];
  const inserts: unknown[] = [];

  const deleteBuilder = (filters: Record<string, unknown>) => {
    const builder = {
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      then: (resolve: (result: unknown) => unknown) =>
        resolve({ error: results.deleteError ?? null }),
    };
    return builder;
  };

  const client = {
    from: () => ({
      delete: () => {
        const filters: Record<string, unknown> = {};
        deletes.push(filters);
        return deleteBuilder(filters);
      },
      insert: async (row: unknown) => {
        inserts.push(row);
        return { error: results.insertError ?? null };
      },
    }),
  };

  return {
    deletes,
    inserts,
    client: client as unknown as Parameters<typeof saveAttractionFeedback>[0],
  };
}

describe("saveAttractionFeedback", () => {
  it("writes a POI-level row with the real place, id and coordinates", async () => {
    const { client, inserts } = fakeWriteSupabase();

    expect(await saveAttractionFeedback(client, "user-1", [rating()])).toBe(1);
    expect(inserts).toEqual([
      {
        user_id: "user-1",
        signal: "upvote",
        category: "museum",
        osm_id: "osm-node-1234567",
        poi_name: "Eretz Israel Museum",
        lat: 32.1,
        lng: 34.79,
      },
    ]);
  });

  // POI fields are all-or-none per the table's check constraint, and osm_id is
  // deliberately not part of that group.
  it("writes a row for a stop with no OSM identity", async () => {
    const { client, inserts } = fakeWriteSupabase();

    await saveAttractionFeedback(client, "user-1", [rating({ osmId: null })]);

    expect(inserts[0]).toMatchObject({ osm_id: null, poi_name: "Eretz Israel Museum" });
  });

  it("replaces an earlier opinion of the same stop", async () => {
    const { client, deletes } = fakeWriteSupabase();

    await saveAttractionFeedback(client, "user-1", [rating()]);

    expect(deletes).toEqual([
      {
        user_id: "user-1",
        category: "museum",
        poi_name: "Eretz Israel Museum",
      },
    ]);
  });

  it("lets one failed write cost only its own rating", async () => {
    const { client } = fakeWriteSupabase({ insertError: new Error("boom") });

    expect(
      await saveAttractionFeedback(client, "user-1", [rating(), rating()]),
    ).toBe(0);
  });

  it("skips the insert when the replacing delete fails", async () => {
    const { client, inserts } = fakeWriteSupabase({
      deleteError: new Error("boom"),
    });

    expect(await saveAttractionFeedback(client, "user-1", [rating()])).toBe(0);
    expect(inserts).toEqual([]);
  });

  it("writes nothing when nothing was rated", async () => {
    const { client, deletes } = fakeWriteSupabase();

    expect(await saveAttractionFeedback(client, "user-1", [])).toBe(0);
    expect(deletes).toEqual([]);
  });
});

describe("deriveCategorySignals", () => {
  it("puts each rated category on the side its rating asked for", () => {
    expect(
      deriveCategorySignals([
        rating(),
        rating({ name: "Shuk", category: "shopping", signal: "downvote" }),
      ]),
    ).toEqual({ upvoted: ["museum"], downvoted: ["shopping"] });
  });

  // One category can only hold one standing signal — the unique index is one
  // row per (user, category, target) — so the walker's last word wins.
  it("resolves two ratings of one category to the most recent", () => {
    expect(
      deriveCategorySignals([
        rating(),
        rating({ name: "Small Museum", signal: "downvote" }),
      ]),
    ).toEqual({ upvoted: [], downvoted: ["museum"] });
  });

  it("drops 'other', which every unclassified stop lands in", () => {
    expect(
      deriveCategorySignals([rating({ category: "other" })]),
    ).toEqual({ upvoted: [], downvoted: [] });
  });
});
