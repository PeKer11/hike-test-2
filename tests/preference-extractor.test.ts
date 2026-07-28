import { describe, expect, it } from "vitest";

import {
  mergePreferredCategories,
  parseCategoryPreferences,
  PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/preferences/preference-extractor";
import type { AttractionCategory } from "@/lib/types";

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

describe("mergePreferredCategories", () => {
  it("appends a newly liked category without touching the existing ones", () => {
    expect(
      mergePreferredCategories(
        ["museum"],
        [{ category: "nature", sentiment: "like" }],
      ),
    ).toEqual(["museum", "nature"]);
  });

  it("returns null when the liked category is already stored", () => {
    expect(
      mergePreferredCategories(
        ["museum", "nature"],
        [{ category: "nature", sentiment: "like" }],
      ),
    ).toBeNull();
  });

  it("removes a category the walker just said they dislike", () => {
    expect(
      mergePreferredCategories(
        ["museum", "shopping", "nature"],
        [{ category: "shopping", sentiment: "dislike" }],
      ),
    ).toEqual(["museum", "nature"]);
  });

  it("returns null when a disliked category was never stored", () => {
    expect(
      mergePreferredCategories(
        ["museum"],
        [{ category: "shopping", sentiment: "dislike" }],
      ),
    ).toBeNull();
  });

  it("returns null when nothing was detected", () => {
    expect(mergePreferredCategories(["museum"], [])).toBeNull();
  });

  it("applies several preferences in one pass", () => {
    expect(
      mergePreferredCategories(
        ["shopping"],
        [
          { category: "nature", sentiment: "like" },
          { category: "shopping", sentiment: "dislike" },
          { category: "food", sentiment: "like" },
        ],
      ),
    ).toEqual(["nature", "food"]);
  });

  it("starts from an empty profile", () => {
    expect(
      mergePreferredCategories([], [{ category: "nature", sentiment: "like" }]),
    ).toEqual(["nature"]);
  });

  it("drops duplicates and junk already sitting in the stored list", () => {
    expect(
      mergePreferredCategories(
        ["museum", "museum", "not-a-category" as AttractionCategory],
        [{ category: "nature", sentiment: "like" }],
      ),
    ).toEqual(["museum", "nature"]);
  });
});
