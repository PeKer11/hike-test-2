import { describe, expect, it } from "vitest";

import {
  buildExtractionResult,
  parsePlaceNames,
  toExplicitAttraction,
} from "@/lib/places/place-extractor";

describe("parsePlaceNames", () => {
  it("reads the JSON-mode response shape", () => {
    expect(parsePlaceNames({ places: ["Habima Square", "Jaffa Port"] })).toEqual([
      "Habima Square",
      "Jaffa Port",
    ]);
  });

  it("accepts a bare array", () => {
    expect(parsePlaceNames(["Habima Square"])).toEqual(["Habima Square"]);
  });

  it("accepts a `names` key", () => {
    expect(parsePlaceNames({ names: ["Carmel Market"] })).toEqual([
      "Carmel Market",
    ]);
  });

  it("parses a raw JSON string", () => {
    expect(parsePlaceNames('{"places": ["Jaffa Port"]}')).toEqual(["Jaffa Port"]);
  });

  it("returns an empty array for a missing or blocked response", () => {
    expect(parsePlaceNames("")).toEqual([]);
    expect(parsePlaceNames(undefined)).toEqual([]);
  });

  it("strips a markdown code fence", () => {
    expect(parsePlaceNames('```json\n["Jaffa Port"]\n```')).toEqual([
      "Jaffa Port",
    ]);
  });

  it("returns an empty array for unparseable text", () => {
    expect(parsePlaceNames("Sure! Here are the places you mentioned:")).toEqual(
      [],
    );
  });

  it("returns an empty array for null, numbers, and unrelated objects", () => {
    expect(parsePlaceNames(null)).toEqual([]);
    expect(parsePlaceNames(42)).toEqual([]);
    expect(parsePlaceNames({ result: "ok" })).toEqual([]);
  });

  it("drops non-string entries, blanks, and trims whitespace", () => {
    expect(
      parsePlaceNames({ places: ["  Habima Square  ", "", 7, null, "Jaffa"] }),
    ).toEqual(["Habima Square", "Jaffa"]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(parsePlaceNames({ places: ["Jaffa Port", "jaffa port"] })).toEqual([
      "Jaffa Port",
    ]);
  });

  it("caps the number of names", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Place ${i}`);
    expect(parsePlaceNames({ places: many })).toHaveLength(8);
  });
});

describe("toExplicitAttraction", () => {
  it("shapes a geocoded name into an Attraction", () => {
    const attraction = toExplicitAttraction(
      "Habima Square",
      { lat: 32.0736, lng: 34.7811 },
      0,
    );

    expect(attraction).toEqual({
      id: "prompt-0-habima-square",
      name: "Habima Square",
      coordinates: { lat: 32.0736, lng: 34.7811 },
      category: "other",
      avgVisitMinutes: 30,
      tags: { source: "prompt" },
    });
  });

  it("produces a usable id for a name with no latin characters", () => {
    const attraction = toExplicitAttraction("כיכר הבימה", { lat: 1, lng: 2 }, 3);
    expect(attraction.id).toBe("prompt-3-place");
    expect(attraction.name).toBe("כיכר הבימה");
  });
});

describe("buildExtractionResult", () => {
  it("splits resolved and unresolved names without dropping any", () => {
    const result = buildExtractionResult([
      { name: "Habima Square", coordinates: { lat: 32.0736, lng: 34.7811 } },
      { name: "a good market", coordinates: null },
      { name: "Jaffa Port", coordinates: { lat: 32.0533, lng: 34.7519 } },
    ]);

    expect(result.attractions.map((a) => a.name)).toEqual([
      "Habima Square",
      "Jaffa Port",
    ]);
    expect(result.unresolvedNames).toEqual(["a good market"]);
  });

  it("indexes attraction ids by position among resolved places only", () => {
    const result = buildExtractionResult([
      { name: "Nowhere", coordinates: null },
      { name: "Jaffa Port", coordinates: { lat: 32.0533, lng: 34.7519 } },
    ]);

    expect(result.attractions[0].id).toBe("prompt-0-jaffa-port");
  });

  it("handles an empty input", () => {
    expect(buildExtractionResult([])).toEqual({
      attractions: [],
      unresolvedNames: [],
    });
  });
});
