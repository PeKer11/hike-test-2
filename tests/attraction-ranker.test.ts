import { describe, expect, it } from "vitest";

import {
  EXPLORATION_RATE,
  MAX_EXPLORATION_PICKS,
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
