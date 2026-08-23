import { describe, expect, it } from "vitest";

import {
  activeCategories,
  activeCategoryWeights,
  CATEGORY_BOOST_BASE,
  CATEGORY_DISLIKE_WEIGHT,
  CATEGORY_HALF_LIFE_SESSIONS,
  categoryPreferenceWeight,
  dislikedCategories,
  MIN_CATEGORY_WEIGHT,
  parseCategoryPreferences,
  PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
  type StoredCategoryPreference,
} from "@/lib/preferences/preference-extractor";
import {
  MAX_DOWNVOTE_PENALTY,
  PREFERRED_CATEGORY_BOOST,
} from "@/lib/attractions/attraction-ranker";
import type { AttractionCategory } from "@/lib/types";

const NOW = new Date("2026-08-23T09:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The session the reads below happen in. Deliberately not zero: a row stamped
 * at session 0 read at session 0 is undecayed either way, so a zero here would
 * let a formula that ignored `lastSeenSession` entirely pass every test in this
 * file.
 */
const CURRENT_SESSION = 20;

/**
 * A stored opinion last stated `sessionsAgo` of the walker's own sessions
 * before now. `daysAgo` still exists because `lastSeenAt` still breaks ties in
 * the ordered reads — it just no longer decays anything.
 */
function stored(
  overrides: Partial<StoredCategoryPreference> & {
    daysAgo?: number;
    sessionsAgo?: number;
  } = {},
): StoredCategoryPreference {
  const { daysAgo = 0, sessionsAgo = 0, ...rest } = overrides;
  return {
    category: "museum",
    sentiment: "like",
    occurrenceCount: 1,
    lastSeenAt: NOW.getTime() - daysAgo * MS_PER_DAY,
    lastSeenSession: CURRENT_SESSION - sessionsAgo,
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
  it("is worth the old flat boost for a taste stated once, this session", () => {
    expect(categoryPreferenceWeight(stored(), CURRENT_SESSION)).toBe(
      CATEGORY_BOOST_BASE,
    );
    expect(CATEGORY_BOOST_BASE).toBe(PREFERRED_CATEGORY_BOOST);
  });

  it("halves after one half-life of sessions and quarters after two", () => {
    expect(
      categoryPreferenceWeight(
        stored({ sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS }),
        CURRENT_SESSION,
      ),
    ).toBeCloseTo(CATEGORY_BOOST_BASE / 2, 10);
    expect(
      categoryPreferenceWeight(
        stored({ sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS * 2 }),
        CURRENT_SESSION,
      ),
    ).toBeCloseTo(CATEGORY_BOOST_BASE / 4, 10);
  });

  // Pinned in absolute sessions rather than in half-lives, because every
  // assertion written as `sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS` still passes
  // when the constant itself is wrong — and the constant is what decides the
  // real deadline the walker experiences. Six walks is the whole promise of the
  // design: a taste stated once and never repeated stops counting after the
  // walker has planned six more walks without mentioning it.
  it("puts a single statement exactly on the threshold after six sessions", () => {
    expect(
      categoryPreferenceWeight(stored({ sessionsAgo: 6 }), CURRENT_SESSION),
    ).toBeCloseTo(MIN_CATEGORY_WEIGHT, 10);
    expect(
      categoryPreferenceWeight(stored({ sessionsAgo: 5 }), CURRENT_SESSION),
    ).toBeGreaterThan(MIN_CATEGORY_WEIGHT);
    expect(
      categoryPreferenceWeight(stored({ sessionsAgo: 7 }), CURRENT_SESSION),
    ).toBeLessThan(MIN_CATEGORY_WEIGHT);
  });

  // And the durability repetition buys, also in absolute sessions: nine walks
  // rather than six.
  it("keeps a five-times-confirmed taste counting until nine sessions", () => {
    expect(
      categoryPreferenceWeight(
        stored({ occurrenceCount: 5, sessionsAgo: 9 }),
        CURRENT_SESSION,
      ),
    ).toBeCloseTo(MIN_CATEGORY_WEIGHT, 10);
    expect(
      categoryPreferenceWeight(
        stored({ occurrenceCount: 5, sessionsAgo: 10 }),
        CURRENT_SESSION,
      ),
    ).toBeLessThan(MIN_CATEGORY_WEIGHT);
  });

  // Ariel's second correction, and the reason the clock moved at all: a walker
  // who has been away for three months has not been changing their mind for
  // three months. Only their own use of the app ages anything.
  it("does not decay a taste for calendar time the walker spent away", () => {
    expect(
      categoryPreferenceWeight(
        stored({ daysAgo: 365 * 2, sessionsAgo: 0 }),
        CURRENT_SESSION,
      ),
    ).toBe(CATEGORY_BOOST_BASE);
  });

  it("climbs one point per repetition, up to the cap at five", () => {
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 2 }), CURRENT_SESSION),
    ).toBe(5);
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 5 }), CURRENT_SESSION),
    ).toBe(8);
    // Past the cap repetition buys nothing more, or a walker who says the same
    // thing on forty walks would out-score every other signal in the ranker.
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 40 }), CURRENT_SESSION),
    ).toBe(8);
  });

  // The difference from scoreFact, and the reason this change exists: a fact
  // keeps a floor it can never fall below, a taste does not. Without this the
  // monotonic array is back, just with more columns.
  it("decays all the way down, however often the taste was stated", () => {
    expect(
      categoryPreferenceWeight(
        stored({ occurrenceCount: 5, sessionsAgo: 60 }),
        CURRENT_SESSION,
      ),
    ).toBeLessThan(0.01);
  });

  it("treats a count below one as one occurrence", () => {
    expect(
      categoryPreferenceWeight(stored({ occurrenceCount: 0 }), CURRENT_SESSION),
    ).toBe(CATEGORY_BOOST_BASE);
  });

  // A stamp ahead of the counter is not a real reading — a profile row that
  // failed to come back and defaulted to zero, or a write racing a read. Read as
  // fresh rather than as a negative age that would pay a bonus for it.
  it("treats a stamp from a later session as this one", () => {
    expect(
      categoryPreferenceWeight(stored({ sessionsAgo: -30 }), CURRENT_SESSION),
    ).toBe(CATEGORY_BOOST_BASE);
  });

  // The safe direction on an unreadable stamp: a preference that outlives its
  // welcome, not one silently deleted. A `0` fallback would read as "stamped at
  // the walker's very first session" and wipe out a taste stated yesterday.
  it("treats a row with no session stamp as stated this session", () => {
    expect(
      categoryPreferenceWeight(
        stored({ lastSeenSession: null }),
        CURRENT_SESSION,
      ),
    ).toBe(CATEGORY_BOOST_BASE);
  });

  describe("a stated dislike", () => {
    // Ariel's first correction: "לא למחוק אלא להוריד הרבה מהניקוד" — a dislike
    // must take a lot OFF the score, not merely stop adding to it.
    it("is worth the full negative ceiling from the very first statement", () => {
      expect(
        categoryPreferenceWeight(
          stored({ sentiment: "dislike" }),
          CURRENT_SESSION,
        ),
      ).toBe(-CATEGORY_DISLIKE_WEIGHT);
    });

    // Not a new tier: 8 is already what this ranker treats as the strongest a
    // single category signal may be worth in either direction.
    it("lands at the same ceiling the tapped downvote is capped at", () => {
      expect(CATEGORY_DISLIKE_WEIGHT).toBe(MAX_DOWNVOTE_PENALTY);
    });

    // The asymmetry with a liking is the design, not an oversight: a liking
    // needs five statements to reach 8, a dislike arrives there.
    it("outweighs a liking stated the same number of times", () => {
      expect(
        Math.abs(
          categoryPreferenceWeight(
            stored({ sentiment: "dislike" }),
            CURRENT_SESSION,
          ),
        ),
      ).toBeGreaterThan(
        categoryPreferenceWeight(
          stored({ sentiment: "like", occurrenceCount: 4 }),
          CURRENT_SESSION,
        ),
      );
    });

    // Repetition cannot make it louder — it is already at the ceiling — so what
    // a second dislike buys is another three sessions of life, through the clock
    // reset the write path does.
    it("does not get louder for being repeated", () => {
      expect(
        categoryPreferenceWeight(
          stored({ sentiment: "dislike", occurrenceCount: 4 }),
          CURRENT_SESSION,
        ),
      ).toBe(-CATEGORY_DISLIKE_WEIGHT);
    });

    // It rides the same curve as everything else rather than standing as a
    // permanent flag, which is the other half of what Ariel asked for.
    it("fades back towards neutral on the same clock as a liking", () => {
      expect(
        categoryPreferenceWeight(
          stored({ sentiment: "dislike", sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS }),
          CURRENT_SESSION,
        ),
      ).toBeCloseTo(-CATEGORY_DISLIKE_WEIGHT / 2, 10);
    });

    it("stops counting after nine sessions, like any other 8-weight opinion", () => {
      expect(
        categoryPreferenceWeight(
          stored({ sentiment: "dislike", sessionsAgo: 9 }),
          CURRENT_SESSION,
        ),
      ).toBeCloseTo(-MIN_CATEGORY_WEIGHT, 10);
    });
  });
});

describe("activeCategoryWeights", () => {
  it("keeps a taste that is still above the threshold", () => {
    const weights = activeCategoryWeights(
      [stored({ category: "nature", sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS })],
      CURRENT_SESSION,
    );

    expect(weights.get("nature")).toBeCloseTo(2, 10);
  });

  // The exploration fix depends on absence, not on a small number: the ranker
  // reads "is this category a key" as "this question is already answered".
  it("drops a taste stated once and not repeated for two half-lives", () => {
    const justUnder = stored({
      category: "nature",
      sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS * 2 + 1,
    });

    expect(categoryPreferenceWeight(justUnder, CURRENT_SESSION)).toBeLessThan(
      MIN_CATEGORY_WEIGHT,
    );
    expect(
      activeCategoryWeights([justUnder], CURRENT_SESSION).has("nature"),
    ).toBe(false);
  });

  // Repetition buys durability as well as height: five occurrences start at 8,
  // so they survive a third half-life that a single statement does not.
  it("keeps a five-times-confirmed taste alive past where a single one dies", () => {
    const aged = { sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS * 2 + 1 };

    expect(
      activeCategoryWeights(
        [stored({ category: "park", ...aged })],
        CURRENT_SESSION,
      ).has("park"),
    ).toBe(false);
    expect(
      activeCategoryWeights(
        [stored({ category: "park", occurrenceCount: 5, ...aged })],
        CURRENT_SESSION,
      ).has("park"),
    ).toBe(true);
  });

  // The threshold is a magnitude test since dislikes exist. Compared with a bare
  // `weight < MIN_CATEGORY_WEIGHT`, which throws away every dislike the instant
  // it is stored — the exact bug the sentiment column was added to fix.
  it("keeps a live dislike, at its negative weight", () => {
    const weights = activeCategoryWeights(
      [stored({ category: "shopping", sentiment: "dislike" })],
      CURRENT_SESSION,
    );

    expect(weights.get("shopping")).toBe(-CATEGORY_DISLIKE_WEIGHT);
  });

  // Presence in the map is what closes the question for `withExplorationPick`,
  // so a disliked category must be a key even though its weight is negative.
  it("leaves a disliked category in the map the ranker reads as answered", () => {
    expect(
      activeCategoryWeights(
        [stored({ category: "shopping", sentiment: "dislike" })],
        CURRENT_SESSION,
      ).has("shopping"),
    ).toBe(true);
  });

  it("drops a dislike that has itself decayed out", () => {
    expect(
      activeCategoryWeights(
        [stored({ category: "shopping", sentiment: "dislike", sessionsAgo: 12 })],
        CURRENT_SESSION,
      ).has("shopping"),
    ).toBe(false);
  });

  it("drops a category the ranker no longer knows", () => {
    const weights = activeCategoryWeights(
      [stored({ category: "cafe" as AttractionCategory })],
      CURRENT_SESSION,
    );

    expect(weights.size).toBe(0);
  });

  // `other` is every unclassified POI, so a preference for it would tell the
  // planner to favour anything at all. The table refuses it too.
  it("drops `other` even though it is a real enum value", () => {
    expect(
      activeCategoryWeights([stored({ category: "other" })], CURRENT_SESSION)
        .size,
    ).toBe(0);
  });

  it("collapses a duplicated category to the stronger claim", () => {
    const weights = activeCategoryWeights(
      [
        stored({ category: "food", occurrenceCount: 1 }),
        stored({ category: "food", occurrenceCount: 4 }),
      ],
      CURRENT_SESSION,
    );

    expect(weights.get("food")).toBe(7);
  });

  // By magnitude, not by signed value: a live dislike must not be quietly
  // outranked by a faded liking for having the larger number.
  it("resolves a duplicate to the louder opinion whichever way it points", () => {
    const weights = activeCategoryWeights(
      [
        stored({ category: "food", sessionsAgo: 5 }),
        stored({ category: "food", sentiment: "dislike" }),
      ],
      CURRENT_SESSION,
    );

    expect(weights.get("food")).toBe(-CATEGORY_DISLIKE_WEIGHT);
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
        CURRENT_SESSION,
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
        CURRENT_SESSION,
      )[0],
    ).toBe("park");
  });

  it("leaves out everything that has decayed under the threshold", () => {
    expect(
      activeCategories(
        [
          stored({ category: "food", sessionsAgo: 1 }),
          stored({ category: "museum", sessionsAgo: 30 }),
        ],
        CURRENT_SESSION,
      ),
    ).toEqual(["food"]);
  });

  // This list pre-ticks a chip on the walk form and leads the clarification
  // question. A category the walker said they do NOT want belongs in neither,
  // however loud the opinion is.
  it("leaves out a disliked category, however strong the dislike", () => {
    expect(
      activeCategories(
        [
          stored({ category: "food" }),
          stored({ category: "shopping", sentiment: "dislike" }),
        ],
        CURRENT_SESSION,
      ),
    ).toEqual(["food"]);
  });
});

describe("dislikedCategories", () => {
  it("returns what the walker ruled out, strongest first", () => {
    expect(
      dislikedCategories(
        [
          stored({ category: "food" }),
          stored({
            category: "shopping",
            sentiment: "dislike",
            sessionsAgo: CATEGORY_HALF_LIFE_SESSIONS,
          }),
          stored({ category: "entertainment", sentiment: "dislike" }),
        ],
        CURRENT_SESSION,
      ),
    ).toEqual(["entertainment", "shopping"]);
  });

  it("leaves out a dislike that has faded back to neutral", () => {
    expect(
      dislikedCategories(
        [stored({ category: "shopping", sentiment: "dislike", sessionsAgo: 12 })],
        CURRENT_SESSION,
      ),
    ).toEqual([]);
  });

  it("never returns a category the walker likes", () => {
    expect(
      dislikedCategories(
        [stored({ category: "museum", occurrenceCount: 5 })],
        CURRENT_SESSION,
      ),
    ).toEqual([]);
  });
});
