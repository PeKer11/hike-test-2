import { describe, expect, it } from "vitest";

import {
  buildExtractionResult,
  CANONICAL_NAME_SYSTEM_PROMPT,
  parseCanonicalName,
  parseContextLocation,
  parsePlaceExtraction,
  parsePlaceNames,
  PLACE_EXTRACTION_SYSTEM_PROMPT,
  toExplicitAttraction,
} from "@/lib/places/place-extractor";

describe("PLACE_EXTRACTION_SYSTEM_PROMPT", () => {
  it("tells the model that an area named only as location context is not a stop", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("context, not a destination");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'in <name>'");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'near <name>'");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'around <name>'");
  });

  it("keeps the area name when no more specific place is mentioned", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "only when the text names no smaller or more specific place at all",
    );
  });

  it("shows both sides of the distinction as examples", () => {
    // (a) smaller places named -> the city moves to contextLocation.
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      '"I want to go to Habima Square and the Carmel Market in Tel Aviv" -> places ["Habima Square", "Carmel Market"], contextLocation "Tel Aviv"',
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      '"אני רוצה ללכת למדרחוב ולגן טייל בזכרון יעקב" -> places ["מדרחוב", "גן טייל"], contextLocation "זכרון יעקב"',
    );
    // (b) nothing smaller named -> the city is the one destination, no context.
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      '"I want to visit Jerusalem" -> places ["Jerusalem"], contextLocation null',
    );
  });

  it("asks for the context area by name instead of only dropping it", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("`contextLocation`");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Never repeat a name in both fields.",
    );
  });
});

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

describe("parseContextLocation", () => {
  it("reads the context area off the JSON-mode response shape", () => {
    expect(
      parseContextLocation({ places: ["מדרחוב"], contextLocation: "זכרון יעקב" }),
    ).toBe("זכרון יעקב");
  });

  it("parses a raw JSON string and trims the value", () => {
    expect(
      parseContextLocation('{"places": [], "contextLocation": " Tel Aviv "}'),
    ).toBe("Tel Aviv");
  });

  it("returns null when there is no usable context area", () => {
    expect(parseContextLocation({ places: ["Jerusalem"] })).toBeNull();
    expect(
      parseContextLocation({ places: [], contextLocation: null }),
    ).toBeNull();
    expect(parseContextLocation({ contextLocation: 42 })).toBeNull();
    expect(parseContextLocation({ contextLocation: "   " })).toBeNull();
    expect(parseContextLocation("not json at all")).toBeNull();
    expect(parseContextLocation(undefined)).toBeNull();
    expect(parseContextLocation(["Jaffa Port"])).toBeNull();
  });
});

describe("CANONICAL_NAME_SYSTEM_PROMPT", () => {
  it("tells the model to prefer null over a plausible-sounding guess", () => {
    expect(CANONICAL_NAME_SYSTEM_PROMPT).toContain(
      "Prefer null over a plausible-sounding guess",
    );
    expect(CANONICAL_NAME_SYSTEM_PROMPT).toContain("Never invent a name");
  });
});

describe("parseCanonicalName", () => {
  it("reads the mapped name off the JSON-mode response shape", () => {
    expect(parseCanonicalName({ canonicalName: "המייסדים" })).toBe("המייסדים");
    expect(parseCanonicalName('{"canonicalName": " HaMeyasdim "}')).toBe(
      "HaMeyasdim",
    );
  });

  it("returns null when the model offers no better name", () => {
    expect(parseCanonicalName({ canonicalName: null })).toBeNull();
    expect(parseCanonicalName({})).toBeNull();
    expect(parseCanonicalName({ canonicalName: "   " })).toBeNull();
    expect(parseCanonicalName("I'm not sure what you mean")).toBeNull();
    expect(parseCanonicalName(undefined)).toBeNull();
  });
});

describe("parsePlaceExtraction", () => {
  it("returns the stops and the area they sit in", () => {
    expect(
      parsePlaceExtraction(
        '{"places": ["מדרחוב", "גן טייל"], "contextLocation": "זכרון יעקב"}',
      ),
    ).toEqual({
      places: ["מדרחוב", "גן טייל"],
      contextLocation: "זכרון יעקב",
    });
  });

  it("leaves a bare city name as the only stop, with no context to bias by", () => {
    expect(
      parsePlaceExtraction({ places: ["עכו"], contextLocation: null }),
    ).toEqual({ places: ["עכו"], contextLocation: null });
  });

  it("drops a context area the model also listed as a stop", () => {
    expect(
      parsePlaceExtraction({
        places: ["Jerusalem"],
        contextLocation: "jerusalem",
      }),
    ).toEqual({ places: ["Jerusalem"], contextLocation: null });
  });

  it("survives a blocked or unparseable response", () => {
    expect(parsePlaceExtraction("")).toEqual({
      places: [],
      contextLocation: null,
    });
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
