import { describe, expect, it } from "vitest";

import {
  DOWNVOTED_CATEGORY_PENALTY,
  EXPLORATION_RATE,
  MAX_EXPLORATION_PICKS,
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

describe("rankAttractions — downvoted categories", () => {
  function scoreOf(
    id: string,
    options: {
      preferred?: AttractionCategory[];
      downvoted?: AttractionCategory[];
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
      downvotedCategories: ["viewpoint"],
      availableMinutes: 90,
      walkingPaceMinPerKm: 15,
    });
    expect(withDownvote.map((a) => a.id)).toEqual(["museum", "viewpoint"]);
  });

  it("subtracts the penalty rather than merely withholding the boost", () => {
    expect(scoreOf("viewpoint", {})).toBeCloseTo(
      scoreOf("viewpoint", { downvoted: ["viewpoint"] }) +
        DOWNVOTED_CATEGORY_PENALTY,
    );
  });

  it("leaves categories the walker never voted on alone", () => {
    expect(scoreOf("museum", { downvoted: ["viewpoint"] })).toBeCloseTo(
      scoreOf("museum", {}),
    );
  });

  // Liked in a prompt, then voted down after a walk that went badly. Neither
  // signal carries a timestamp the other can be compared against, so
  // contradictory evidence ranks as no evidence.
  it("cancels to neutral when a category is both preferred and downvoted", () => {
    expect(PREFERRED_CATEGORY_BOOST).toBe(DOWNVOTED_CATEGORY_PENALTY);
    expect(
      scoreOf("museum", { preferred: ["museum"], downvoted: ["museum"] }),
    ).toBeCloseTo(scoreOf("museum", {}));
  });

  // Exploration buys information about a category we know nothing about. A
  // downvote is not missing information, it is the answer.
  it("never spends the exploration slot on a downvoted category", () => {
    const ranked = rankAttractions([museum, viewpoint], {
      origin,
      preferredCategories: ["museum"],
      downvotedCategories: ["viewpoint"],
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
        downvotedCategories: ["viewpoint"],
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
