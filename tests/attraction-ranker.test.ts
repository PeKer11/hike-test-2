import { describe, expect, it } from "vitest";

import {
  downvotePenalty,
  EXPLORATION_RATE,
  MAX_DOWNVOTE_PENALTY,
  MAX_EXPLORATION_PICKS,
  MAX_OCCURRENCE_PREFERENCE_BOOST,
  occurrencePreferenceBoost,
  PER_OCCURRENCE_DOWNVOTE_PENALTY,
  PER_OCCURRENCE_PREFERENCE_BOOST,
  PREFERRED_CATEGORY_BOOST,
  rankAttractions,
  selectFeasibleAttractions,
} from "@/lib/attractions/attraction-ranker";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

const origin: Coordinates = { lat: 32.08, lng: 34.78 };

function makeAttraction(
  id: string,
  category: AttractionCategory,
  lat: number,
): Attraction {
  return {
    id,
    name: id,
    coordinates: { lat, lng: 34.78 },
    category,
    avgVisitMinutes: 20,
    tags: {},
  };
}

// One museum the walker's profile asks for, one viewpoint it does not.
const museum = makeAttraction("museum", "museum", 32.081);
const viewpoint = makeAttraction("viewpoint", "viewpoint", 32.084);

function rank(
  random: () => number,
  options: { allowExploration?: boolean; preferred?: AttractionCategory[] } = {},
): Attraction[] {
  return rankAttractions([museum, viewpoint], {
    origin,
    preferredCategories: options.preferred ?? ["museum"],
    availableMinutes: 90,
    walkingPaceMinPerKm: 15,
    allowExploration: options.allowExploration ?? true,
    random,
  });
}

describe("rankAttractions — exploration/exploitation", () => {
  it("ranks purely on preference when the roll lands above the exploration rate", () => {
    const ranked = rank(() => EXPLORATION_RATE);

    expect(ranked.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  it("leads with an off-preference stop when the roll lands under the rate", () => {
    const ranked = rank(() => EXPLORATION_RATE - 0.01);

    expect(ranked.map((a) => a.id)).toEqual(["viewpoint", "museum"]);
    expect(ranked[0].isExplorationPick).toBe(true);
    expect(
      ranked.filter((a) => a.isExplorationPick),
    ).toHaveLength(MAX_EXPLORATION_PICKS);
  });

  it("spends at most one stop on exploration", () => {
    const ranked = rankAttractions(
      [
        museum,
        viewpoint,
        makeAttraction("park", "park", 32.085),
        makeAttraction("food", "food", 32.086),
      ],
      {
        origin,
        preferredCategories: ["museum"],
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      },
    );

    expect(ranked.filter((a) => a.isExplorationPick)).toHaveLength(1);
  });

  // Exploration is meant to offer a real alternative, not just any stop that
  // happens to be off-preference. With several to choose from it must take the
  // best-scoring one — "pick the last off-preference candidate" is otherwise
  // indistinguishable from the correct implementation.
  it("explores with the best-scoring off-preference candidate, not just any", () => {
    const ranked = rankAttractions(
      [
        museum,
        // Deliberately out of score order: `shopping` scores lowest of the
        // three off-preference candidates, `viewpoint` highest.
        makeAttraction("shopping", "shopping", 32.0805),
        makeAttraction("other", "other", 32.0806),
        viewpoint,
      ],
      {
        origin,
        preferredCategories: ["museum"],
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      },
    );

    expect(ranked[0].id).toBe("viewpoint");
    expect(ranked[0].isExplorationPick).toBe(true);
  });

  it("reorders the ranking without dropping or duplicating a candidate", () => {
    const candidates = [
      museum,
      viewpoint,
      makeAttraction("park", "park", 32.085),
      makeAttraction("food", "food", 32.086),
    ];
    const ranked = rankAttractions(candidates, {
      origin,
      preferredCategories: ["museum"],
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.map((a) => a.id).sort()).toEqual(
      candidates.map((a) => a.id).sort(),
    );
  });

  it("never explores when the caller did not opt in", () => {
    const ranked = rank(() => 0, { allowExploration: false });

    expect(ranked.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  it("never explores when nothing is known about the walker", () => {
    const ranked = rank(() => 0, { preferred: [] });

    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  it("leaves the ranking alone when every candidate is already preferred", () => {
    const ranked = rankAttractions([museum], {
      origin,
      preferredCategories: ["museum"],
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.map((a) => a.id)).toEqual(["museum"]);
    expect(ranked[0].isExplorationPick).toBeUndefined();
  });

  it("is deterministic and preference-weighted by default (no random source)", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: ["museum"],
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });

    expect(ranked.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
  });

  it("gives the exploration pick a real slot in the selected walk", () => {
    const ranked = rank(() => 0);
    const { selected } = selectFeasibleAttractions(ranked, 90, 15);

    expect(selected[0].id).toBe("viewpoint");
    expect(selected[0].isExplorationPick).toBe(true);
  });
});

// How many times a category has been voted down, in the shape the ranker reads.
function downvotes(
  ...entries: [AttractionCategory, number][]
): Map<AttractionCategory, number> {
  return new Map(entries);
}

// The scaled penalty is the whole point of the occurrence count: a category
// disliked once is not the same evidence as one disliked on every walk.
describe("downvotePenalty", () => {
  it("charges one occurrence half of what a stated preference is worth", () => {
    expect(downvotePenalty(1)).toBe(PER_OCCURRENCE_DOWNVOTE_PENALTY);
    expect(downvotePenalty(1)).toBeLessThan(PREFERRED_CATEGORY_BOOST);
  });

  it("grows with each repeat of the same downvote", () => {
    expect(downvotePenalty(2)).toBe(4);
    expect(downvotePenalty(3)).toBe(6);
    expect(downvotePenalty(2)).toBeGreaterThan(downvotePenalty(1));
  });

  // Without the ceiling a walker who dislikes one category every walk would
  // eventually put it beyond any notability or distance the ranker can offer.
  it("caps however many times the category was voted down", () => {
    expect(downvotePenalty(4)).toBe(MAX_DOWNVOTE_PENALTY);
    expect(downvotePenalty(40)).toBe(MAX_DOWNVOTE_PENALTY);
  });

  // A row written before occurrence tracking existed still means one standing
  // downvote, never none.
  it.each([0, -3, Number.NaN, 1.7])(
    "reads an unusable count (%s) as a single occurrence",
    (count) => {
      expect(downvotePenalty(count)).toBe(PER_OCCURRENCE_DOWNVOTE_PENALTY);
    },
  );
});

describe("rankAttractions — downvoted categories", () => {
  function scoreOf(
    id: string,
    options: {
      preferred?: AttractionCategory[];
      downvoted?: Map<AttractionCategory, number>;
    },
  ): number {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: options.preferred,
      downvotedCategories: options.downvoted,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });

    return ranked.find((a) => a.id === id)?.score ?? NaN;
  }

  // A missing bonus is not enough: `viewpoint` outscores `museum` on base score
  // alone, so "no boost" would still hand the walker the kind of place they
  // just told us they dislike.
  it("ranks a downvoted category below a neutral one it would otherwise beat", () => {
    const neutral = rankAttractions([museum, viewpoint], {
      origin,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });
    expect(neutral.map((a) => a.id)).toEqual(["viewpoint", "museum"]);

    const withDownvote = rankAttractions([museum, viewpoint], {
      origin,
      downvotedCategories: downvotes(["viewpoint", 1]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });
    expect(withDownvote.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
  });

  it("subtracts the penalty rather than merely withholding the boost", () => {
    expect(scoreOf("viewpoint", {})).toBeCloseTo(
      scoreOf("viewpoint", { downvoted: downvotes(["viewpoint", 1]) }) +
        PER_OCCURRENCE_DOWNVOTE_PENALTY,
    );
  });

  // A category disliked on four walks has to cost more than one disliked once,
  // and the cap has to hold from the score's side too, not just the formula's.
  it("scales the penalty with how often the category was voted down", () => {
    const once = scoreOf("viewpoint", { downvoted: downvotes(["viewpoint", 1]) });
    const thrice = scoreOf("viewpoint", {
      downvoted: downvotes(["viewpoint", 3]),
    });
    const many = scoreOf("viewpoint", { downvoted: downvotes(["viewpoint", 9]) });

    expect(thrice).toBeLessThan(once);
    expect(many).toBeCloseTo(
      scoreOf("viewpoint", {}) - MAX_DOWNVOTE_PENALTY,
    );
  });

  it("leaves categories the walker never voted on alone", () => {
    expect(
      scoreOf("museum", { downvoted: downvotes(["viewpoint", 3]) }),
    ).toBeCloseTo(scoreOf("museum", {}));
  });

  // Liked in a prompt, then voted down after a walk that went badly. Neither
  // signal carries a timestamp the other can be compared against, so a stated
  // preference stands until the downvote has been repeated enough to match it —
  // one bad walk no longer cancels what the walker said they like, and two do.
  it("needs a repeated downvote to cancel a stated preference", () => {
    const neutral = scoreOf("museum", {});

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        downvoted: downvotes(["museum", 1]),
      }),
    ).toBeGreaterThan(neutral);

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        downvoted: downvotes(["museum", 2]),
      }),
    ).toBeCloseTo(neutral);

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        downvoted: downvotes(["museum", 4]),
      }),
    ).toBeLessThan(neutral);
  });

  // Exploration buys information about a category we know nothing about. A
  // downvote is not missing information, it is the answer.
  it("never spends the exploration slot on a downvoted category", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: ["museum"],
      downvotedCategories: downvotes(["viewpoint", 1]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  it("still explores into an off-preference category that was not voted down", () => {
    const ranked = rankAttractions(
      [museum, viewpoint, makeAttraction("food", "food", 32.0805)],
      {
        origin,
        preferredCategories: ["museum"],
        downvotedCategories: downvotes(["viewpoint", 1]),
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      },
    );

    expect(ranked[0].id).toBe("food");
    expect(ranked[0].isExplorationPick).toBe(true);
  });
});

// How many times a category has been voted up from post-walk feedback, in the
// shape the ranker reads.
function upvotes(
  ...entries: [AttractionCategory, number][]
): Map<AttractionCategory, number> {
  return new Map(entries);
}

// Mirrors `downvotePenalty` for the other direction — same curve, added
// instead of subtracted.
describe("occurrencePreferenceBoost", () => {
  it("charges the same per-occurrence rate as a downvote", () => {
    expect(occurrencePreferenceBoost(1)).toBe(PER_OCCURRENCE_PREFERENCE_BOOST);
    expect(occurrencePreferenceBoost(1)).toBe(downvotePenalty(1));
  });

  it("grows with each repeat of the same upvote", () => {
    expect(occurrencePreferenceBoost(2)).toBe(4);
    expect(occurrencePreferenceBoost(3)).toBe(6);
    expect(occurrencePreferenceBoost(2)).toBeGreaterThan(
      occurrencePreferenceBoost(1),
    );
  });

  it("caps however many times the category was voted up", () => {
    expect(occurrencePreferenceBoost(4)).toBe(MAX_OCCURRENCE_PREFERENCE_BOOST);
    expect(occurrencePreferenceBoost(40)).toBe(MAX_OCCURRENCE_PREFERENCE_BOOST);
  });

  it.each([0, -3, Number.NaN, 1.7])(
    "reads an unusable count (%s) as a single occurrence",
    (count) => {
      expect(occurrencePreferenceBoost(count)).toBe(
        PER_OCCURRENCE_PREFERENCE_BOOST,
      );
    },
  );
});

describe("rankAttractions — upvoted categories", () => {
  function scoreOf(
    id: string,
    options: {
      preferred?: AttractionCategory[];
      upvoted?: Map<AttractionCategory, number>;
      downvoted?: Map<AttractionCategory, number>;
    },
  ): number {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: options.preferred,
      upvotedCategories: options.upvoted,
      downvotedCategories: options.downvoted,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });

    return ranked.find((a) => a.id === id)?.score ?? NaN;
  }

  it("ranks a repeatedly upvoted category above a neutral one it would otherwise lose to", () => {
    const neutral = rankAttractions([museum, viewpoint], {
      origin,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });
    expect(neutral.map((a) => a.id)).toEqual(["viewpoint", "museum"]);

    const withUpvotes = rankAttractions([museum, viewpoint], {
      origin,
      upvotedCategories: upvotes(["museum", 4]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });
    expect(withUpvotes.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
  });

  it("adds on top of the flat preferred-category boost rather than replacing it", () => {
    const flatOnly = scoreOf("museum", { preferred: ["museum"] });
    const flatPlusUpvotes = scoreOf("museum", {
      preferred: ["museum"],
      upvoted: upvotes(["museum", 2]),
    });

    expect(flatPlusUpvotes).toBeCloseTo(flatOnly + occurrencePreferenceBoost(2));
  });

  it("scales the boost with how often the category was voted up", () => {
    const once = scoreOf("museum", { upvoted: upvotes(["museum", 1]) });
    const thrice = scoreOf("museum", { upvoted: upvotes(["museum", 3]) });
    const many = scoreOf("museum", { upvoted: upvotes(["museum", 9]) });

    expect(thrice).toBeGreaterThan(once);
    expect(many).toBeCloseTo(
      scoreOf("museum", {}) + MAX_OCCURRENCE_PREFERENCE_BOOST,
    );
  });

  it("leaves categories the walker never rated alone", () => {
    expect(
      scoreOf("viewpoint", { upvoted: upvotes(["museum", 3]) }),
    ).toBeCloseTo(scoreOf("viewpoint", {}));
  });

  // Repeated behavioural evidence is an answer, not a question worth spending
  // the one exploration slot on — same reasoning as a downvoted category.
  it("never spends the exploration slot on an upvoted category", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: ["museum"],
      upvotedCategories: upvotes(["viewpoint", 1]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  // The exclusion has to be narrow: barring upvoted categories must not bar
  // the untouched ones, which are the only thing exploration exists to find.
  it("still explores into a category carrying no standing signal", () => {
    const ranked = rankAttractions(
      [museum, viewpoint, makeAttraction("food", "food", 32.0805)],
      {
        origin,
        preferredCategories: ["museum"],
        upvotedCategories: upvotes(["viewpoint", 2]),
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      },
    );

    expect(ranked[0].id).toBe("food");
    expect(ranked[0].isExplorationPick).toBe(true);
  });

  // The three signals cannot all land on one category through the app — the
  // unique index is one `attraction_feedback` row per (user, category), so the
  // standing row is an upvote or a downvote and never both, and the ranker's
  // own API has no such guard. Pinning the arithmetic down anyway: the two
  // occurrence-scaled sides are a plain sum, so equal counts cancel exactly and
  // leave the flat stated preference standing rather than being counted twice
  // or dropped entirely.
  it("nets the two occurrence-scaled signals against each other, leaving the flat boost", () => {
    const neutral = scoreOf("museum", {});

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        upvoted: upvotes(["museum", 2]),
        downvoted: downvotes(["museum", 2]),
      }),
    ).toBeCloseTo(neutral + PREFERRED_CATEGORY_BOOST);

    // And the stronger side wins when the counts differ.
    expect(
      scoreOf("museum", {
        upvoted: upvotes(["museum", 4]),
        downvoted: downvotes(["museum", 1]),
      }),
    ).toBeCloseTo(
      neutral + MAX_OCCURRENCE_PREFERENCE_BOOST - PER_OCCURRENCE_DOWNVOTE_PENALTY,
    );
  });

  // Both exclusions are unions, not alternatives — a downvoted category stays
  // barred from exploration when an upvote map is also in play.
  it("keeps barring downvoted categories from exploration alongside upvoted ones", () => {
    const ranked = rankAttractions(
      [museum, viewpoint, makeAttraction("food", "food", 32.0805)],
      {
        origin,
        preferredCategories: ["museum"],
        upvotedCategories: upvotes(["food", 1]),
        downvotedCategories: downvotes(["viewpoint", 1]),
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      },
    );

    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });
});
