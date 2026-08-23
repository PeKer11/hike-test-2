import { describe, expect, it } from "vitest";

import {
  activeCategories,
  activeCategoryWeights,
  CATEGORY_BOOST_BASE,
  CATEGORY_HALF_LIFE_DAYS,
  categoryPreferenceWeight,
  MIN_CATEGORY_WEIGHT,
  parseCategoryPreferences,
  PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
  type StoredCategoryPreference,
} from "@/lib/preferences/preference-extractor";
import { PREFERRED_CATEGORY_BOOST } from "@/lib/attractions/attraction-ranker";
import type { AttractionCategory } from "@/lib/types";

const NOW = new Date("2026-08-23T09:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A stored taste last stated `daysAgo` days before NOW. */
function stored(
  overrides: Partial<StoredCategoryPreference> & { daysAgo?: number } = {},
): StoredCategoryPreference {
  const { daysAgo = 0, ...rest } = overrides;
  return {
    category: "museum",
    occurrenceCount: 1,
    lastSeenAt: NOW.getTime() - daysAgo * MS_PER_DAY,
    ...rest,
  };
}

describe("parseCategoryPreferences", () => {
  it("reads a clear liking out of a JSON-mode reply", () => {
    const reply = JSON.stringify({
      preferences: [{ category: "nature", sentiment: "like" }],
    });

    expect(parseCategoryPreferences(reply)).toEqual([
      { category: "nature", sentiment: "like" },
    ]);
  });

  it("reads a like and a dislike from the same reply", () => {
    expect(
      parseCategoryPreferences({
        preferences: [
          { category: "museum", sentiment: "like" },
          { category: "shopping", sentiment: "dislike" },
        ],
      }),
    ).toEqual([
      { category: "museum", sentiment: "like" },
      { category: "shopping", sentiment: "dislike" },
    ]);
  });

  it("returns nothing for a prompt that states no preference", () => {
    expect(parseCategoryPreferences({ preferences: [] })).toEqual([]);
  });

  it("unwraps a markdown-fenced reply", () => {
    const reply =
      '```json\n{"preferences":[{"category":"food","sentiment":"like"}]}\n```';

    expect(parseCategoryPreferences(reply)).toEqual([
      { category: "food", sentiment: "like" },
    ]);
  });

  it("drops entries that are not a known category or sentiment", () => {
    expect(
      parseCategoryPreferences({
        preferences: [
          { category: "beaches", sentiment: "like" },
          { category: "park", sentiment: "maybe" },
          { category: "park" },
          "nature",
          null,
          { category: "park", sentiment: "like" },
        ],
      }),
    ).toEqual([{ category: "park", sentiment: "like" }]);
  });

  it("drops 'other' — it carries no signal", () => {
    expect(
      parseCategoryPreferences({
        preferences: [
          { category: "other", sentiment: "like" },
          { category: "viewpoint", sentiment: "like" },
        ],
      }),
    ).toEqual([{ category: "viewpoint", sentiment: "like" }]);
  });

  it("keeps only the first verdict when a reply contradicts itself", () => {
    expect(
      parseCategoryPreferences({
        preferences: [
          { category: "food", sentiment: "like" },
          { category: "food", sentiment: "dislike" },
        ],
      }),
    ).toEqual([{ category: "food", sentiment: "like" }]);
  });

  it("returns an empty list for an unusable reply instead of throwing", () => {
    expect(parseCategoryPreferences("not json at all")).toEqual([]);
    expect(parseCategoryPreferences(null)).toEqual([]);
    expect(parseCategoryPreferences({ preferences: "nature" })).toEqual([]);
    expect(parseCategoryPreferences("")).toEqual([]);
  });

  it("caps how many preferences one reply can carry", () => {
    const every: AttractionCategory[] = [
      "landmark",
      "museum",
      "park",
      "food",
      "viewpoint",
      "religious",
      "shopping",
      "entertainment",
      "nature",
    ];

    const parsed = parseCategoryPreferences({
      preferences: every.map((category) => ({ category, sentiment: "like" })),
    });

    expect(parsed).toHaveLength(6);
  });

  it("teaches the model that an unknown pace is not a preference", () => {
    expect(PREFERENCE_EXTRACTION_SYSTEM_PROMPT).toContain("Uncertainty is not a preference");
    expect(PREFERENCE_EXTRACTION_SYSTEM_PROMPT).toContain("לא יודע מה הקצב שלי");
  });
});


describe("categoryPreferenceWeight", () => {
  // The whole point of keeping CATEGORY_BOOST_BASE at 4: a walker who says "I
  // love museums" today must get exactly what the flat boost gave them before
  // any of this existed. If these two constants ever drift apart, every
  // migrated category silently changes value on migration day.
  it("is worth the old flat boost for a taste stated once, just now", () => {
    expect(categoryPreferenceWeight(stored(), NOW)).toBe(CATEGORY_BOOST_BASE);
    expect(CATEGORY_BOOST_BASE).toBe(PREFERRED_CATEGORY_BOOST);
  });

  it("halves after one half-life and quarters after two", () => {
    expect(
      categoryPreferenceWeight(stored({ daysAgo: CATEGORY_HALF_LIFE_DAYS }), NOW),
    ).toBeCloseTo(CATEGORY_BOOST_BASE / 2, 10);
    expect(
      categoryPreferenceWeight(
        stored({ daysAgo: CATEGORY_HALF_LIFE_DAYS * 2 }),
        NOW,
      ),
    ).toBeCloseTo(CATEGORY_BOOST_BASE / 4, 10);
  });

  // Pinned in absolute days rather than in half-lives, because every assertion
  // written as `daysAgo: CATEGORY_HALF_LIFE_DAYS` still passes when the constant
  // itself is wrong — and the constant is what decides the real deadline the
  // walker experiences. 120 days is the whole promise of the design: a taste
  // stated once and never repeated stops counting after four months.
  it("puts a single statement exactly on the threshold at 120 days", () => {
    expect(categoryPreferenceWeight(stored({ daysAgo: 120 }), NOW)).toBeCloseTo(
      MIN_CATEGORY_WEIGHT,
      10,
    );
    expect(
      categoryPreferenceWeight(stored({ daysAgo: 119 }), NOW),
    ).toBeGreaterThan(MIN_CATEGORY_WEIGHT);
    expect(categoryPreferenceWeight(stored({ daysAgo: 121 }), NOW)).toBeLessThan(
      MIN_CATEGORY_WEIGHT,
    );
  });

  // And the durability repetition buys, also in absolute days: six months
  // rather than four.
  it("keeps a five-times-confirmed taste counting until 180 days", () => {
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 5, daysAgo: 180 }), NOW),
    ).toBeCloseTo(MIN_CATEGORY_WEIGHT, 10);
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 5, daysAgo: 181 }), NOW),
    ).toBeLessThan(MIN_CATEGORY_WEIGHT);
  });

  it("climbs one point per repetition, up to the cap at five", () => {
    expect(categoryPreferenceWeight(stored({ occurrenceCount: 2 }), NOW)).toBe(5);
    expect(categoryPreferenceWeight(stored({ occurrenceCount: 5 }), NOW)).toBe(8);
    // Past the cap repetition buys nothing more, or a walker who says the same
    // thing on forty walks would out-score every other signal in the ranker.
    expect(categoryPreferenceWeight(stored({ occurrenceCount: 40 }), NOW)).toBe(8);
  });

  // The difference from scoreFact, and the reason this change exists: a fact
  // keeps a floor it can never fall below, a taste does not. Without this the
  // monotonic array is back, just with more columns.
  it("decays all the way down, however often the taste was stated", () => {
    expect(
      categoryPreferenceWeight(
        stored({ occurrenceCount: 5, daysAgo: 365 * 3 }),
        NOW,
      ),
    ).toBeLessThan(0.01);
  });

  it("treats a count below one as one occurrence", () => {
    expect(categoryPreferenceWeight(stored({ occurrenceCount: 0 }), NOW)).toBe(
      CATEGORY_BOOST_BASE,
    );
  });

  it("treats a future timestamp as now rather than paying a bonus for it", () => {
    expect(categoryPreferenceWeight(stored({ daysAgo: -30 }), NOW)).toBe(
      CATEGORY_BOOST_BASE,
    );
  });
});

describe("activeCategoryWeights", () => {
  it("keeps a taste that is still above the threshold", () => {
    const weights = activeCategoryWeights(
      [stored({ category: "nature", daysAgo: CATEGORY_HALF_LIFE_DAYS })],
      NOW,
    );

    expect(weights.get("nature")).toBeCloseTo(2, 10);
  });

  // The exploration fix depends on absence, not on a small number: the ranker
  // reads "is this category a key" as "this question is already answered".
  it("drops a taste stated once and not repeated for two half-lives", () => {
    const justUnder = stored({
      category: "nature",
      daysAgo: CATEGORY_HALF_LIFE_DAYS * 2 + 1,
    });

    expect(categoryPreferenceWeight(justUnder, NOW)).toBeLessThan(
      MIN_CATEGORY_WEIGHT,
    );
    expect(activeCategoryWeights([justUnder], NOW).has("nature")).toBe(false);
  });

  // Repetition buys durability as well as height: five occurrences start at 8,
  // so they survive a third half-life that a single statement does not.
  it("keeps a five-times-confirmed taste alive past where a single one dies", () => {
    const aged = { daysAgo: CATEGORY_HALF_LIFE_DAYS * 2 + 1 };

    expect(
      activeCategoryWeights([stored({ category: "park", ...aged })], NOW).has(
        "park",
      ),
    ).toBe(false);
    expect(
      activeCategoryWeights(
        [stored({ category: "park", occurrenceCount: 5, ...aged })],
        NOW,
      ).has("park"),
    ).toBe(true);
  });

  it("drops a category the ranker no longer knows", () => {
    const weights = activeCategoryWeights(
      [stored({ category: "cafe" as AttractionCategory })],
      NOW,
    );

    expect(weights.size).toBe(0);
  });

  // `other` is every unclassified POI, so a preference for it would tell the
  // planner to favour anything at all. The table refuses it too.
  it("drops `other` even though it is a real enum value", () => {
    expect(activeCategoryWeights([stored({ category: "other" })], NOW).size).toBe(
      0,
    );
  });

  it("collapses a duplicated category to the stronger claim", () => {
    const weights = activeCategoryWeights(
      [
        stored({ category: "food", occurrenceCount: 1 }),
        stored({ category: "food", occurrenceCount: 4 }),
      ],
      NOW,
    );

    expect(weights.get("food")).toBe(7);
  });
});

describe("activeCategories", () => {
  it("orders the surviving tastes strongest first", () => {
    expect(
      activeCategories(
        [
          stored({ category: "food", occurrenceCount: 1 }),
          stored({ category: "museum", occurrenceCount: 5 }),
          stored({ category: "park", occurrenceCount: 3 }),
        ],
        NOW,
      ),
    ).toEqual(["museum", "park", "food"]);
  });

  it("breaks a tie on the more recently stated taste", () => {
    expect(
      activeCategories(
        [
          stored({ category: "food", daysAgo: 10 }),
          stored({ category: "museum", daysAgo: 10 }),
          stored({ category: "park", daysAgo: 1 }),
        ],
        NOW,
      )[0],
    ).toBe("park");
  });

  it("leaves out everything that has decayed under the threshold", () => {
    expect(
      activeCategories(
        [
          stored({ category: "food", daysAgo: 1 }),
          stored({ category: "museum", daysAgo: 400 }),
        ],
        NOW,
      ),
    ).toEqual(["food"]);
  });
});
