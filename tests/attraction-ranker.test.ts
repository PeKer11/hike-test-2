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
  TRENDING_CATEGORY_BOOST,
  trendingCategoryBoost,
} from "@/lib/attractions/attraction-ranker";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

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

// The budget-fit pass used to cost every candidate off a frozen origin
// distance, so where the walk had actually reached never entered the decision.
// These build the two shapes that got wrong, in both directions.
describe("selectFeasibleAttractions — cost against the growing route", () => {
  const budgetOrigin: Coordinates = { lat: 32, lng: 34.78 };
  const pace = 15;

  // Shaped the way `rankAttractions` leaves a candidate: origin distance and
  // score already baked in.
  function scored(
    id: string,
    lat: number,
    score: number,
    avgVisitMinutes = 10,
  ): Attraction {
    const coordinates = { lat, lng: budgetOrigin.lng };
    return {
      id,
      name: id,
      coordinates,
      category: "landmark",
      avgVisitMinutes,
      tags: {},
      distanceFromOriginMeters: haversineDistance(budgetOrigin, coordinates),
      score,
    };
  }

  // What the old pass charged: every stop walked from the origin.
  function originOnlyCost(attractions: Attraction[]): number {
    return attractions.reduce(
      (sum, a) =>
        sum + ((a.distanceFromOriginMeters ?? 0) / 1000) * pace + a.avgVisitMinutes,
      0,
    );
  }

  it("keeps a candidate that is far from the origin but close to the last accepted stop", () => {
    // `far` is twice as far out as `near`, but on the same bearing — from
    // `near` it is the same short hop `near` was from the origin.
    const near = scored("near", 32.01, 10);
    const far = scored("far", 32.02, 9);
    const availableMinutes = 60;

    // The old pass could not have afforded both: it billed `far` for the whole
    // walk out from the origin a second time.
    expect(originOnlyCost([near, far])).toBeGreaterThan(availableMinutes);

    const { selected, dropped } = selectFeasibleAttractions(
      [near, far],
      availableMinutes,
      pace,
    );

    expect(selected.map((a) => a.id)).toEqual(["near", "far"]);
    expect(dropped).toEqual([]);
  });

  it("drops a candidate that looked cheap from the origin but sits far from where the walk reached", () => {
    // `cheap` outranks `detour` and is nearer the origin — but it lies on the
    // opposite side of it, so once `first` is accepted it is the long way back.
    const first = scored("first", 32.005, 12);
    const cheap = scored("cheap", 31.994, 11);
    const detour = scored("detour", 32.012, 10);

    const { selected, dropped } = selectFeasibleAttractions(
      [first, cheap, detour],
      60,
      pace,
    );

    // Re-sorted after `first`: `detour` is now the cheaper next step, and once
    // it is taken `cheap` no longer fits at all.
    expect(selected.map((a) => a.id)).toEqual(["first", "detour"]);
    expect(dropped.map((a) => a.id)).toEqual(["cheap"]);
  });

  it("still caps the walk at maxAttractions and reports the rest as dropped", () => {
    const candidates = [
      scored("a", 32.001, 10),
      scored("b", 32.002, 9),
      scored("c", 32.003, 8),
    ];

    const { selected, dropped } = selectFeasibleAttractions(
      candidates,
      600,
      pace,
      2,
    );

    expect(selected).toHaveLength(2);
    expect(dropped.map((a) => a.id)).toEqual(["c"]);
  });

  it("falls back to proximity ordering for stops carrying no ranker score", () => {
    // Explicitly named stops reach this function straight from the walk-plan
    // route with no score — proximity is the only signal left to sort on.
    const unscored = (id: string, lat: number): Attraction => ({
      id,
      name: id,
      coordinates: { lat, lng: budgetOrigin.lng },
      category: "landmark",
      avgVisitMinutes: 10,
      tags: {},
    });

    const { selected } = selectFeasibleAttractions(
      [unscored("start", 32.001), unscored("beyond", 32.02), unscored("next", 32.002)],
      600,
      pace,
    );

    expect(selected.map((a) => a.id)).toEqual(["start", "next", "beyond"]);
  });
});

// A category downvote is priced into the score; a downvote on one specific
// place cannot be, because a notable enough place would out-score its way back
// onto the walk. These prove the exclusion is a hard one.
describe("rankAttractions — POI-level downvote suppression", () => {
  const suppressed: Attraction = {
    id: "node/42",
    name: "Carmel Market",
    coordinates: { lat: 32.081, lng: 34.78 },
    category: "shopping",
    avgVisitMinutes: 20,
    // Notable enough to lead the ranking on score alone.
    tags: { wikidata: "Q1", wikipedia: "he:X", heritage: "2" },
  };

  function ranked(downvotedPoiKeys: Set<string>): string[] {
    return rankAttractions([suppressed, museum], {
      origin,
      downvotedPoiKeys,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    }).map((a) => a.id);
  }

  it("drops a rediscovered POI matched by its OSM id", () => {
    expect(ranked(new Set(["node/42"]))).toEqual(["museum"]);
  });

  // The walker downvoted it as a stop they named themselves, so it was stored
  // with no OSM id — Overpass hands the same place back with one.
  it("drops a rediscovered POI matched by name and coordinates", () => {
    expect(ranked(new Set(["carmel market@32.0810,34.7800"]))).toEqual(["museum"]);
  });

  it("keeps a POI whose coordinates have moved beyond the key's precision", () => {
    expect(ranked(new Set(["carmel market@32.0900,34.7800"]))).toEqual([
      "node/42",
      "museum",
    ]);
  });

  it("suppresses nothing when no POI has been voted down", () => {
    expect(ranked(new Set())).toEqual(["node/42", "museum"]);
  });

  // The whole point of the hard exclusion: score is not allowed to overrule it.
  it("drops it however well it scores", () => {
    const withoutSuppression = rankAttractions([suppressed, museum], {
      origin,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });

    expect(withoutSuppression[0].id).toBe("node/42");
    expect(ranked(new Set(["node/42"]))).not.toContain("node/42");
  });
});

describe("rankAttractions — notableOnly", () => {
  // A famous but low-scoring category against an anonymous high-scoring one.
  // Without the notability weighting the viewpoint wins on category base alone.
  const famousShop: Attraction = {
    ...makeAttraction("famous-shop", "shopping", 32.081),
    tags: { wikidata: "Q42", wikipedia: "en:Famous Shop" },
  };
  const anonymousViewpoint = makeAttraction("plain-view", "viewpoint", 32.081);

  function rankNotable(notableOnly: boolean): string[] {
    return rankAttractions([famousShop, anonymousViewpoint], {
      origin,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      notableOnly,
    }).map((a) => a.id);
  }

  it("leaves the ordering alone when the walker did not ask for famous places", () => {
    expect(rankNotable(false)).toEqual(["plain-view", "famous-shop"]);
  });

  it("puts the well-known place first when they did", () => {
    expect(rankNotable(true)).toEqual(["famous-shop", "plain-view"]);
  });

  it("still returns a walk in an area where nothing is notable", () => {
    const plain = [
      makeAttraction("a", "park", 32.081),
      makeAttraction("b", "food", 32.082),
    ];

    // Emphasis, not a filter — an untagged neighbourhood ranks as it always did.
    expect(
      rankAttractions(plain, {
        origin,
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        notableOnly: true,
      }).map((a) => a.id),
    ).toEqual(["a", "b"]);
  });
});

// The standing-taste half of the preference signal, decayed. `preferredCategories`
// above is now only "what this walk asked for"; everything here is "what the
// walker is on record as liking, and how much that is still worth".
describe("rankAttractions — decayed standing tastes", () => {
  function weights(
    ...entries: [AttractionCategory, number][]
  ): Map<AttractionCategory, number> {
    return new Map(entries);
  }

  function scoreOf(
    id: string,
    options: {
      preferred?: AttractionCategory[];
      weighted?: Map<AttractionCategory, number>;
    },
  ): number {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: options.preferred,
      preferredCategoryWeights: options.weighted,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });

    return ranked.find((a) => a.id === id)?.score ?? Number.NaN;
  }

  it("adds the weight the map carries, not a flat boost", () => {
    const neutral = scoreOf("museum", {});

    expect(scoreOf("museum", { weighted: weights(["museum", 8]) })).toBeCloseTo(
      neutral + 8,
    );
    expect(
      scoreOf("museum", { weighted: weights(["museum", 1.5]) }),
    ).toBeCloseTo(neutral + 1.5);
  });

  // "They ticked museums today" and "they like museums" are the same claim
  // arriving twice. Summing them would double-count a walker who ticks the chip
  // for the taste they already have on file, which is the common case.
  it("takes the larger of today's tick and the standing taste, never the sum", () => {
    const neutral = scoreOf("museum", {});

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        weighted: weights(["museum", 7]),
      }),
    ).toBeCloseTo(neutral + 7);

    expect(
      scoreOf("museum", {
        preferred: ["museum"],
        weighted: weights(["museum", 1]),
      }),
    ).toBeCloseTo(neutral + PREFERRED_CATEGORY_BOOST);
  });

  // The exploration starvation this whole change is about. Under the old flat
  // array a category was barred from exploration forever for having been
  // mentioned once; a decayed-out taste is simply absent from the map.
  it("explores into a taste that has decayed out of the map", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategoryWeights: weights(["museum", 4]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked[0].id).toBe("viewpoint");
    expect(ranked[0].isExplorationPick).toBe(true);

    // Once viewpoints are a standing taste too, there is nothing left to
    // explore into and the ranking is left alone.
    const bothKnown = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategoryWeights: weights(["museum", 4], ["viewpoint", 4]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(bothKnown.some((a) => a.isExplorationPick)).toBe(false);
  });

  it("leaves the ranking alone when every taste has decayed away", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategoryWeights: weights(),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.map((a) => a.id)).toEqual(["viewpoint", "museum"]);
    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  // Today's tick is not a decayed value and must still bar exploration on its
  // own, even for a walker with no standing tastes at all.
  it("still refuses to explore into a category this walk asked for", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: ["museum", "viewpoint"],
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  // A stated dislike arrives here as a NEGATIVE weight since 2026-08-23. Before
  // that the row was deleted and the category simply went missing, so all three
  // of these behaviours were unreachable.
  describe("a category the walker said they do not want", () => {
    it("subtracts from the score instead of merely failing to boost it", () => {
      const neutral = scoreOf("museum", {});

      expect(
        scoreOf("museum", { weighted: weights(["museum", -8]) }),
      ).toBeCloseTo(neutral - 8);
    });

    // The bug a bare `Math.max(askedFor, standing)` would reintroduce: max(0, -8)
    // is 0, so the dislike would silently become "no opinion".
    it("is not floored away when the walk asked for nothing", () => {
      expect(
        scoreOf("museum", { weighted: weights(["museum", -8]) }),
      ).toBeLessThan(scoreOf("museum", {}));
    });

    // Asking for a category today is the freshest evidence there is, and it
    // answers the standing opinion outright rather than being averaged with it.
    it("is overridden by the same category asked for on this walk", () => {
      const neutral = scoreOf("museum", {});

      expect(
        scoreOf("museum", {
          preferred: ["museum"],
          weighted: weights(["museum", -8]),
        }),
      ).toBeCloseTo(neutral + PREFERRED_CATEGORY_BOOST);
    });

    // The asymmetry this change closes: a tapped downvote was already barred
    // from the exploration slot, while a text dislike deleted the row and handed
    // the category straight back to it as a "discovery".
    it("is never spent the exploration slot on", () => {
      const ranked = rankAttractions([museum, viewpoint], {
        origin,
        preferredCategoryWeights: weights(["viewpoint", 4], ["museum", -8]),
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      });

      expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
    });

    // And the flip side, so the test above cannot pass just because nothing was
    // explorable: with the dislike gone, the museum is a question again.
    it("becomes explorable again once the dislike has faded out of the map", () => {
      const ranked = rankAttractions([museum, viewpoint], {
        origin,
        preferredCategoryWeights: weights(["viewpoint", 4]),
        availableMinutes: 90,
        walkingPaceMinPerKm: 15,
        allowExploration: true,
        random: () => 0,
      });

      expect(ranked[0].id).toBe("museum");
      expect(ranked[0].isExplorationPick).toBe(true);
    });
  });
});

// The cold-start signal: what other walkers have voted up, applied to a walker
// this app has learned nothing about. Everything here is about WHEN it applies
// at least as much as by how much — a boost that leaked into a walker with real
// preferences would be a stranger's opinion overriding theirs.
describe("rankAttractions — trending categories", () => {
  const park = makeAttraction("park", "park", 32.082);

  function trending(
    ...entries: [AttractionCategory, number][]
  ): Map<AttractionCategory, number> {
    return new Map(entries);
  }

  function scoreOf(
    id: string,
    options: Partial<Parameters<typeof rankAttractions>[1]> = {},
  ): number {
    const ranked = rankAttractions([museum, viewpoint, park], {
      origin,
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      ...options,
    });

    return ranked.find((a) => a.id === id)?.score ?? Number.NaN;
  }

  it("gives the most upvoted category the full boost", () => {
    const blind = scoreOf("museum");

    expect(
      scoreOf("museum", { trendingCategories: trending(["museum", 6]) }),
    ).toBeCloseTo(blind + TRENDING_CATEGORY_BOOST);
  });

  // Scaled against the leader, so the curve says only what the aggregate can
  // support: this kind of place is liked about half as often as the top one.
  it("scales a category against the most upvoted one", () => {
    const options = {
      trendingCategories: trending(["museum", 8], ["park", 4], ["viewpoint", 1]),
    };

    expect(scoreOf("museum", options) - scoreOf("museum")).toBeCloseTo(
      TRENDING_CATEGORY_BOOST,
    );
    expect(scoreOf("park", options) - scoreOf("park")).toBeCloseTo(
      TRENDING_CATEGORY_BOOST / 2,
    );
    expect(scoreOf("viewpoint", options) - scoreOf("viewpoint")).toBeCloseTo(
      TRENDING_CATEGORY_BOOST / 8,
    );
  });

  it("leaves a category nobody has voted up exactly where it was", () => {
    expect(
      scoreOf("viewpoint", { trendingCategories: trending(["museum", 6]) }),
    ).toBeCloseTo(scoreOf("viewpoint"));
  });

  // The magnitude argument, pinned as a relation rather than as the number 2 —
  // this is a guess about strangers and must stay worth less than the least the
  // walker has ever said about themselves.
  it("is worth less than a taste stated once", () => {
    expect(TRENDING_CATEGORY_BOOST).toBeLessThan(PREFERRED_CATEGORY_BOOST);
    expect(TRENDING_CATEGORY_BOOST).toBeLessThan(MAX_OCCURRENCE_PREFERENCE_BOOST);

    const blind = scoreOf("museum");
    const trendingOnly = scoreOf("museum", {
      trendingCategories: trending(["museum", 6]),
    });
    const statedOnce = scoreOf("museum", {
      preferredCategories: ["museum"],
    });

    expect(trendingOnly - blind).toBeLessThan(statedOnce - blind);
  });

  // The whole trigger condition, one source of personal signal per case. Any one
  // of them means we are no longer guessing, and the aggregate is dropped whole
  // rather than layered underneath.
  it.each<[string, Partial<Parameters<typeof rankAttractions>[1]>]>([
    ["a category ticked for this walk", { preferredCategories: ["park"] }],
    [
      "a standing taste still counting",
      { preferredCategoryWeights: new Map([["park", 4]] as const) },
    ],
    [
      "a stated dislike, which is a negative weight",
      { preferredCategoryWeights: new Map([["park", -8]] as const) },
    ],
    [
      "a category tapped up on a previous walk",
      { upvotedCategories: new Map([["park", 1]] as const) },
    ],
    [
      "a category tapped down on a previous walk",
      { downvotedCategories: new Map([["park", 1]] as const) },
    ],
  ])("ignores the aggregate for a walker with %s", (_label, signal) => {
    const withSignal = scoreOf("museum", signal);
    const withBoth = scoreOf("museum", {
      ...signal,
      trendingCategories: trending(["museum", 6]),
    });

    expect(withBoth).toBeCloseTo(withSignal);
  });

  // Every one of those signals is about `park`, not `museum` — so this is not
  // "the museum already had a number that won". The aggregate is switched off
  // for a walker we know something about, whatever that something is about, and
  // the museum falls back to the preference-blind score exactly.
  it("ignores the aggregate even when the signal is about another category", () => {
    expect(
      scoreOf("museum", {
        upvotedCategories: new Map([["park", 3]] as const),
        trendingCategories: trending(["museum", 6]),
      }),
    ).toBeCloseTo(scoreOf("museum"));
  });

  // A POI downvote names one place, not a kind of place. It closes no question
  // about categories, so it must not switch the cold-start signal off.
  it("still applies for a walker who only ever rejected one specific place", () => {
    const blind = scoreOf("museum");

    expect(
      scoreOf("museum", {
        downvotedPoiKeys: new Set(["osm-node-99"]),
        trendingCategories: trending(["museum", 6]),
      }),
    ).toBeCloseTo(blind + TRENDING_CATEGORY_BOOST);
  });

  // Membership of `exploited` means "the walker has answered this". A trending
  // category is the app's own guess, made because they answered nothing — so it
  // closes no question, and must not switch exploration on for the one group it
  // is currently off for.
  it("never counts as an answer the exploration slot should skip", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      trendingCategories: trending(["museum", 6]),
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
      allowExploration: true,
      random: () => 0,
    });

    expect(ranked.some((a) => a.isExplorationPick)).toBe(false);
  });

  it.each<[string, Map<AttractionCategory, number> | undefined]>([
    ["no aggregate at all", undefined],
    ["an empty aggregate", new Map()],
    ["an aggregate whose totals are all zero", new Map([["museum", 0]] as const)],
  ])("leaves every score untouched given %s", (_label, aggregate) => {
    expect(scoreOf("museum", { trendingCategories: aggregate })).toBeCloseTo(
      scoreOf("museum"),
    );
  });
});

describe("trendingCategoryBoost", () => {
  it("gives the leader the whole boost and scales the rest against it", () => {
    expect(trendingCategoryBoost(10, 10)).toBe(TRENDING_CATEGORY_BOOST);
    expect(trendingCategoryBoost(5, 10)).toBe(TRENDING_CATEGORY_BOOST / 2);
    expect(trendingCategoryBoost(1, 10)).toBeCloseTo(
      TRENDING_CATEGORY_BOOST / 10,
    );
  });

  // The scale needs no cutoff of its own: a category far behind the leader lands
  // under MIN_CATEGORY_WEIGHT (1), which this codebase already calls the
  // narrowest gap that can reorder anything.
  it("puts a category far behind the leader below the point of mattering", () => {
    expect(trendingCategoryBoost(1, 20)).toBeLessThan(1);
  });

  it.each([
    ["nothing on record", 0, 0],
    ["a peak that is not a number", 3, Number.NaN],
    ["a total that is not a number", Number.NaN, 10],
    ["a negative peak", 3, -1],
  ])("is worth nothing given %s", (_label, total, peak) => {
    expect(trendingCategoryBoost(total, peak)).toBe(0);
  });

  // Defensive: the peak is computed from the same map, so a total above it
  // cannot happen — but a boost above the ceiling should be impossible by
  // construction rather than by that argument.
  it("never exceeds the ceiling, whatever it is handed", () => {
    expect(trendingCategoryBoost(1000, 10)).toBe(TRENDING_CATEGORY_BOOST);
  });
});
