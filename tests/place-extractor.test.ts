import { describe, expect, it } from "vitest";

import {
  buildExtractionResult,
  CANONICAL_NAME_SYSTEM_PROMPT,
  CLARIFICATION_CATEGORIES,
  isAreaOnlyPrompt,
  isUnderSpecifiedPrompt,
  MAX_CLARIFICATION_CATEGORIES,
  suggestClarificationCategories,
  parseCanonicalName,
  parseCategoryNeeds,
  parseContextLocation,
  parseDurationMinutes,
  parseMaxEndDistanceKm,
  parseNotableOnly,
  parsePlaceExtraction,
  parsePlaceNames,
  parseSearchRadiusKm,
  parseStopCount,
  pickNeedAttractions,
  PLACE_EXTRACTION_SYSTEM_PROMPT,
  toExplicitAttraction,
} from "@/lib/places/place-extractor";
import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";
import type { Attraction, AttractionCategory } from "@/lib/types";

describe("PLACE_EXTRACTION_SYSTEM_PROMPT", () => {
  it("tells the model that an area named only as location context is not a stop", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("context, not a destination");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'in <name>'");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'near <name>'");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'around <name>'");
  });

  it("asks for a duration only when the text states one unambiguously", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain("'three hours' -> 180");
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Never guess a duration that was not stated",
    );
  });

  it("separates a need for a stop on this walk from a standing taste", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      '"אני גם רוצה לאכול משהו" -> categoryNeeds ["food"]',
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      '"אני אוהב דברים טבעיים" -> categoryNeeds [] — a taste',
    );
  });

  it("lists every category the parser will accept", () => {
    // The list is spelled out in the prompt rather than interpolated (circular
    // import); this catches the two drifting apart.
    for (const category of ATTRACTION_CATEGORIES) {
      if (category === "other") continue;
      expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(category);
    }
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
      durationMinutes: null,
      categoryNeeds: [],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: null,
      searchRadiusKm: null,
    });
  });

  it("leaves a bare city name as the only stop, with no context to bias by", () => {
    expect(
      parsePlaceExtraction({ places: ["עכו"], contextLocation: null }),
    ).toEqual({
      places: ["עכו"],
      contextLocation: null,
      durationMinutes: null,
      categoryNeeds: [],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: null,
      searchRadiusKm: null,
    });
  });

  it("drops a context area the model also listed as a stop", () => {
    expect(
      parsePlaceExtraction({
        places: ["Jerusalem"],
        contextLocation: "jerusalem",
      }),
    ).toEqual({
      places: ["Jerusalem"],
      contextLocation: null,
      durationMinutes: null,
      categoryNeeds: [],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: null,
      searchRadiusKm: null,
    });
  });

  it("survives a blocked or unparseable response", () => {
    expect(parsePlaceExtraction("")).toEqual({
      places: [],
      contextLocation: null,
      durationMinutes: null,
      categoryNeeds: [],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: null,
      searchRadiusKm: null,
    });
  });
});

describe("stop count and notability extraction", () => {
  it("asks for a stop count only when the text states one", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "'bring me 3 famous places' -> 3",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Never guess a count that was not stated",
    );
  });

  it("tells the model that famous is a quality, not a category", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "never belongs in `categoryNeeds`",
    );
  });

  it("reads a stated stop count", () => {
    expect(parseStopCount('{"stopCount": 3}')).toBe(3);
    expect(parseStopCount({ stopCount: 3.4 })).toBe(3);
  });

  it("returns null when no count was stated", () => {
    expect(parseStopCount({ stopCount: null })).toBeNull();
    expect(parseStopCount({ places: [] })).toBeNull();
    expect(parseStopCount({ stopCount: "three" })).toBeNull();
    expect(parseStopCount({ stopCount: 0 })).toBeNull();
  });

  it("clamps a count bigger than a walk can hold instead of dropping it", () => {
    expect(parseStopCount({ stopCount: 20 })).toBe(8);
  });

  it("reads the famous-places signal only from a literal true", () => {
    expect(parseNotableOnly({ notableOnly: true })).toBe(true);
    expect(parseNotableOnly({ notableOnly: false })).toBeNull();
    expect(parseNotableOnly({ notableOnly: "true" })).toBeNull();
    expect(parseNotableOnly({ places: [] })).toBeNull();
  });

  it("carries both fields through a full extraction", () => {
    expect(
      parsePlaceExtraction(
        '{"places": ["Tel Aviv"], "stopCount": 3, "notableOnly": true}',
      ),
    ).toEqual({
      places: ["Tel Aviv"],
      contextLocation: null,
      durationMinutes: null,
      categoryNeeds: [],
      stopCount: 3,
      notableOnly: true,
      maxEndDistanceKm: null,
      searchRadiusKm: null,
    });
  });

  it("ignores a count when the walker named the places themselves", () => {
    // The list of names is the count; capping it would drop a named stop.
    expect(
      parsePlaceExtraction({
        places: ["Habima Square", "Carmel Market", "Jaffa Port"],
        stopCount: 2,
      }).stopCount,
    ).toBeNull();
  });
});

describe("finish-distance extraction", () => {
  it("asks for a finish distance only when the text states one", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "'keep it within 500m of my start' -> 0.5",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      'עד 1 ק"מ ממה שאני נמצא',
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      'תחזיר אותי עד חצי ק"מ ממה שהתחלתי',
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Never guess a finish distance that was not stated",
    );
  });

  it("tells the model a finish distance is neither a search radius nor a walk length", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "not how far to look for attractions",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "not where it ends",
    );
  });

  it("reads a stated finish distance in kilometres", () => {
    expect(parseMaxEndDistanceKm('{"maxEndDistanceKm": 1}')).toBe(1);
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: 0.5 })).toBe(0.5);
  });

  it("returns null when no finish distance was stated", () => {
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: null })).toBeNull();
    expect(parseMaxEndDistanceKm({ places: [] })).toBeNull();
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: "1km" })).toBeNull();
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: 0 })).toBeNull();
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: -2 })).toBeNull();
  });

  it("clamps a distance the form field would reject instead of dropping it", () => {
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: 0.05 })).toBe(0.1);
    expect(parseMaxEndDistanceKm({ maxEndDistanceKm: 400 })).toBe(50);
  });

  it("does not read a finish distance out of a duration or a search radius", () => {
    // Both are separate fields on the same reply; a prompt that states one of
    // them and no finish distance leaves this one null.
    expect(
      parsePlaceExtraction('{"places": [], "durationMinutes": 120}')
        .maxEndDistanceKm,
    ).toBeNull();
    expect(
      parsePlaceExtraction('{"places": [], "radiusMeters": 2000}')
        .maxEndDistanceKm,
    ).toBeNull();
  });

  it("carries a finish distance through a full extraction", () => {
    expect(
      parsePlaceExtraction(
        '{"places": [], "durationMinutes": 120, "maxEndDistanceKm": 0.5}',
      ),
    ).toEqual({
      places: [],
      contextLocation: null,
      durationMinutes: 120,
      categoryNeeds: [],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: 0.5,
      searchRadiusKm: null,
    });
  });

  it("keeps a finish distance even when the walker named the stops themselves", () => {
    // Unlike `stopCount`: naming the stops says nothing about how far from the
    // start the last one may be.
    expect(
      parsePlaceExtraction({
        places: ["Habima Square", "Carmel Market"],
        maxEndDistanceKm: 1,
      }).maxEndDistanceKm,
    ).toBe(1);
  });
});

describe("search radius extraction", () => {
  it("tells the model a search radius is not a finish distance, a duration, or a count", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "not where the walk has to END",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "It is a distance, not a time budget",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "It is a distance, not a count",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Never guess a search distance that was not stated",
    );
  });

  it("teaches both the Hebrew and English phrasings walkers actually use", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "'search up to 10km from here' -> 10",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "'look within 5km of my start' -> 5",
    );
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "'מאיפה שאני נמצא עכשיו עד 10 ק\"מ' -> 10",
    );
  });

  it("reads a stated search radius in kilometres", () => {
    expect(parseSearchRadiusKm('{"searchRadiusKm": 10}')).toBe(10);
    expect(parseSearchRadiusKm({ searchRadiusKm: 5 })).toBe(5);
    expect(parseSearchRadiusKm({ searchRadiusKm: 2.5 })).toBe(2.5);
  });

  it("returns null when no search radius was stated", () => {
    expect(parseSearchRadiusKm({ searchRadiusKm: null })).toBeNull();
    expect(parseSearchRadiusKm({ places: [] })).toBeNull();
    expect(parseSearchRadiusKm({ searchRadiusKm: "10km" })).toBeNull();
    expect(parseSearchRadiusKm({ searchRadiusKm: 0 })).toBeNull();
    expect(parseSearchRadiusKm({ searchRadiusKm: -3 })).toBeNull();
  });

  it("clamps a radius the form field would reject instead of dropping it", () => {
    // The "Search radius (km)" input is min 0.5 / max 10.
    expect(parseSearchRadiusKm({ searchRadiusKm: 0.2 })).toBe(0.5);
    expect(parseSearchRadiusKm({ searchRadiusKm: 30 })).toBe(10);
  });

  it("does not read a search radius out of a duration, a finish distance, or a count", () => {
    expect(
      parsePlaceExtraction('{"places": [], "durationMinutes": 120}')
        .searchRadiusKm,
    ).toBeNull();
    expect(
      parsePlaceExtraction('{"places": [], "maxEndDistanceKm": 1}')
        .searchRadiusKm,
    ).toBeNull();
    expect(
      parsePlaceExtraction('{"places": [], "stopCount": 3}').searchRadiusKm,
    ).toBeNull();
  });

  it("does not let a search radius leak into the finish distance", () => {
    expect(
      parsePlaceExtraction('{"places": [], "searchRadiusKm": 10}')
        .maxEndDistanceKm,
    ).toBeNull();
  });

  it("keeps a search radius even when the walker named the stops themselves", () => {
    expect(
      parsePlaceExtraction({
        places: ["Habima Square", "Carmel Market"],
        searchRadiusKm: 4,
      }).searchRadiusKm,
    ).toBe(4);
  });

  it("reads both distances out of one prompt that states both", () => {
    // Ariel's live test case: "a walk in Zichron Yaakov at גן טייל and to eat
    // something, starting from where I am now up to 10km, finishing within 1km
    // of where I am now" — two different distances in one sentence.
    expect(
      parsePlaceExtraction(
        '{"places": ["גן טייל"], "contextLocation": "זכרון יעקב", "categoryNeeds": ["food"], "searchRadiusKm": 10, "maxEndDistanceKm": 1}',
      ),
    ).toEqual({
      places: ["גן טייל"],
      contextLocation: "זכרון יעקב",
      durationMinutes: null,
      categoryNeeds: ["food"],
      stopCount: null,
      notableOnly: null,
      maxEndDistanceKm: 1,
      searchRadiusKm: 10,
    });
  });
});

describe("parseDurationMinutes", () => {
  it("reads a stated walk length", () => {
    expect(parseDurationMinutes('{"durationMinutes": 180}')).toBe(180);
  });

  it("returns null when the model stated no duration", () => {
    expect(parseDurationMinutes({ durationMinutes: null })).toBeNull();
    expect(parseDurationMinutes({ places: [] })).toBeNull();
  });

  it("refuses a duration the model wrote as prose", () => {
    expect(parseDurationMinutes({ durationMinutes: "three hours" })).toBeNull();
  });

  it("rounds a fractional answer to whole minutes", () => {
    expect(parseDurationMinutes({ durationMinutes: 89.6 })).toBe(90);
  });

  it("refuses a value too small or too large to be a walk", () => {
    expect(parseDurationMinutes({ durationMinutes: 0 })).toBeNull();
    expect(parseDurationMinutes({ durationMinutes: -30 })).toBeNull();
    expect(parseDurationMinutes({ durationMinutes: 2026 })).toBeNull();
  });

  it("survives a blocked or unparseable response", () => {
    expect(parseDurationMinutes("")).toBeNull();
    expect(parseDurationMinutes(["not an object"])).toBeNull();
  });
});

describe("parseCategoryNeeds", () => {
  it("reads the kinds of stop asked for without a name", () => {
    expect(
      parseCategoryNeeds('{"categoryNeeds": ["food", "religious"]}'),
    ).toEqual(["food", "religious"]);
  });

  it("returns an empty list when nothing of the sort was asked for", () => {
    expect(parseCategoryNeeds({ categoryNeeds: [] })).toEqual([]);
    expect(parseCategoryNeeds({ places: ["Habima Square"] })).toEqual([]);
  });

  it("drops values that are not categories, and 'other'", () => {
    expect(
      parseCategoryNeeds({
        categoryNeeds: ["food", "brunch", "other", 7, null],
      }),
    ).toEqual(["food"]);
  });

  it("keeps each category once and caps the list", () => {
    expect(parseCategoryNeeds({ categoryNeeds: ["food", "food"] })).toEqual([
      "food",
    ]);
    expect(
      parseCategoryNeeds({
        categoryNeeds: ["food", "park", "museum", "nature"],
      }),
    ).toHaveLength(3);
  });

  it("survives a blocked or unparseable response", () => {
    expect(parseCategoryNeeds("")).toEqual([]);
    expect(parseCategoryNeeds({ categoryNeeds: "food" })).toEqual([]);
  });
});

describe("pickNeedAttractions", () => {
  const ranked: Attraction[] = [
    {
      id: "osm-node-1",
      name: "City Park",
      coordinates: { lat: 1, lng: 1 },
      category: "park",
      avgVisitMinutes: 30,
      tags: {},
    },
    {
      id: "osm-node-2",
      name: "Best Restaurant",
      coordinates: { lat: 1, lng: 1 },
      category: "food",
      avgVisitMinutes: 45,
      tags: { amenity: "restaurant" },
    },
    {
      id: "osm-node-3",
      name: "Second Restaurant",
      coordinates: { lat: 1, lng: 1 },
      category: "food",
      avgVisitMinutes: 45,
      tags: {},
    },
  ];

  it("takes the best-ranked match for each need", () => {
    expect(pickNeedAttractions(ranked, ["food"]).map((a) => a.name)).toEqual([
      "Best Restaurant",
    ]);
  });

  it("marks the stop as coming from a stated need", () => {
    const [stop] = pickNeedAttractions(ranked, ["food"]);
    expect(stop.tags.source).toBe("prompt-need");
    expect(stop.tags.needCategory).toBe("food");
    // The POI's own tags are kept alongside the marker.
    expect(stop.tags.amenity).toBe("restaurant");
  });

  it("contributes nothing for a need with nothing nearby", () => {
    expect(pickNeedAttractions(ranked, ["museum"])).toEqual([]);
    expect(pickNeedAttractions([], ["food"])).toEqual([]);
  });

  it("never picks the same stop for two needs", () => {
    const picked = pickNeedAttractions(ranked, ["food", "park"]);
    expect(picked.map((a) => a.id)).toEqual(["osm-node-2", "osm-node-1"]);
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

describe("isUnderSpecifiedPrompt", () => {
  const base = {
    places: ["זכרון יעקב"],
    contextLocation: null,
    categoryNeeds: [] as AttractionCategory[],
    placeKind: "town",
  };

  it("recognises a place named with no stated intent", () => {
    expect(isUnderSpecifiedPrompt(base)).toBe(true);
  });

  it.each(["city", "village", "suburb", "neighbourhood", "administrative"])(
    "treats %s as an area",
    (placeKind) => {
      expect(isUnderSpecifiedPrompt({ ...base, placeKind })).toBe(true);
    },
  );

  // The whole distinction the extraction schema cannot make: both arrive as one
  // entry with a null context location.
  it.each(["square", "theatre", "pedestrian", "museum"])(
    "treats %s as a real destination",
    (placeKind) => {
      expect(isUnderSpecifiedPrompt({ ...base, placeKind })).toBe(false);
    },
  );

  it("says nothing about a prompt that named a context area", () => {
    expect(
      isUnderSpecifiedPrompt({ ...base, contextLocation: "זכרון יעקב" }),
    ).toBe(false);
  });

  it("says nothing about a prompt with a route in mind", () => {
    expect(
      isUnderSpecifiedPrompt({ ...base, places: ["מדרחוב", "גן טייל"] }),
    ).toBe(false);
  });

  it("says nothing when an intent was already stated", () => {
    expect(isUnderSpecifiedPrompt({ ...base, categoryNeeds: ["food"] })).toBe(
      false,
    );
  });

  it("says nothing when the place never geocoded", () => {
    expect(isUnderSpecifiedPrompt({ ...base, placeKind: null })).toBe(false);
  });
});

describe("suggestClarificationCategories", () => {
  it("asks a generic question when nothing is known about the walker", () => {
    expect(suggestClarificationCategories([], [])).toEqual(
      CLARIFICATION_CATEGORIES.slice(0, MAX_CLARIFICATION_CATEGORIES),
    );
  });

  it("leads with what the walker likes", () => {
    const suggested = suggestClarificationCategories(["food"], []);

    expect(suggested[0]).toBe("food");
    expect(suggested).toHaveLength(MAX_CLARIFICATION_CATEGORIES);
  });

  // The point of leading rather than filtering: a liked category the short list
  // does not contain still gets offered.
  it("offers a liked category the fixed list does not carry", () => {
    expect(suggestClarificationCategories(["shopping"], [])).toContain(
      "shopping",
    );
  });

  // Asymmetric on purpose. A downvote is an answer; a like is not the question.
  it("never asks about something already voted down", () => {
    const suggested = suggestClarificationCategories([], ["landmark", "food"]);

    expect(suggested).not.toContain("landmark");
    expect(suggested).not.toContain("food");
    expect(suggested).toHaveLength(MAX_CLARIFICATION_CATEGORIES);
  });

  it("drops a liked category that has since been voted down", () => {
    expect(suggestClarificationCategories(["museum"], ["museum"])).not.toContain(
      "museum",
    );
  });

  it("never offers `other` — it is not a kind of walk", () => {
    expect(suggestClarificationCategories(["other"], [])).not.toContain("other");
  });

  it("does not repeat a liked category that is also on the fixed list", () => {
    const suggested = suggestClarificationCategories(["nature"], []);

    expect(new Set(suggested).size).toBe(suggested.length);
  });

  // Asking something beats asking nothing; the chips can simply be ignored.
  it("falls back to the plain list when every suggestion is voted down", () => {
    expect(
      suggestClarificationCategories([], CLARIFICATION_CATEGORIES),
    ).toEqual(CLARIFICATION_CATEGORIES.slice(0, MAX_CLARIFICATION_CATEGORIES));
  });
});

// Separate from `isUnderSpecifiedPrompt` because it has to survive the answer:
// picking a kind of walk is not naming a stop, so there is still no named list.
describe("isAreaOnlyPrompt", () => {
  const base = {
    places: ["זכרון יעקב"],
    contextLocation: null,
    placeKind: "town",
  };

  it("stays true after the walker answers the clarifying question", () => {
    expect(isAreaOnlyPrompt(base)).toBe(true);
    expect(
      isUnderSpecifiedPrompt({ ...base, categoryNeeds: ["food"] }),
    ).toBe(false);
  });

  it("is false for a real destination", () => {
    expect(isAreaOnlyPrompt({ ...base, placeKind: "square" })).toBe(false);
  });

  it("is false once a smaller place was named alongside the area", () => {
    expect(
      isAreaOnlyPrompt({ ...base, contextLocation: "זכרון יעקב" }),
    ).toBe(false);
  });
});

// Step 9 of docs/persisted-history-design.md. Without this rule the model
// helpfully invents a dog park off "always walks with a dog".
describe("PLACE_EXTRACTION_SYSTEM_PROMPT — standing facts", () => {
  it("says facts never add places or category needs on their own", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /never add places or category needs/i,
    );
  });

  it("says the walker's current text wins over a stored fact", () => {
    expect(PLACE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /current text always wins/i,
    );
  });
});
