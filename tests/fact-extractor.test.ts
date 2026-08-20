import { describe, expect, it } from "vitest";

import { PLACE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/places/place-extractor";
import {
  buildCombinedExtractionPrompt,
  buildKnownFactsBlock,
  buildPromptWithFacts,
  COMBINED_EXTRACTION_SYSTEM_PROMPT,
  FACT_EXTRACTION_SYSTEM_PROMPT,
  parseCombinedExtraction,
  findContradicted,
  HALF_LIFE_DAYS,
  MAX_FACTS_IN_PROMPT,
  MIN_FACT_SCORE,
  normalizeFactKey,
  parseStandingFacts,
  scoreFact,
  selectFactsForPrompt,
  weakestFact,
  type FactImportance,
  type StoredFact,
} from "@/lib/preferences/fact-extractor";

const NOW = new Date("2026-08-12T09:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return NOW.getTime() - days * MS_PER_DAY;
}

function fact(overrides: Partial<StoredFact> = {}): StoredFact {
  const text = overrides.text ?? "does not eat meat";
  return {
    id: "fact-1",
    text,
    key: normalizeFactKey(text),
    importance: 1,
    occurrenceCount: 1,
    lastSeenAt: daysAgo(0),
    ...overrides,
  };
}

describe("normalizeFactKey", () => {
  it("reads two phrasings of the same fact as one key", () => {
    expect(normalizeFactKey("Does not eat meat!")).toBe(
      normalizeFactKey("does not   eat meat"),
    );
  });

  it("strips Hebrew niqqud so a vowelled and a bare spelling agree", () => {
    expect(normalizeFactKey("הוֹלֵךְ עם כלב")).toBe(
      normalizeFactKey("הולך עם כלב"),
    );
  });

  it("strips Latin accents", () => {
    expect(normalizeFactKey("prefers cafés")).toBe("prefers cafes");
  });

  it("keeps different facts apart", () => {
    expect(normalizeFactKey("does not eat meat")).not.toBe(
      normalizeFactKey("eats meat"),
    );
  });

  it("reduces a string of nothing but punctuation to an empty key", () => {
    expect(normalizeFactKey("!!! ---")).toBe("");
  });
});

describe("parseStandingFacts", () => {
  it("reads facts out of a JSON-mode text reply", () => {
    const reply = JSON.stringify({
      facts: [
        { text: "does not eat meat", importance: 3, replaces: null },
        { text: "always walks with a dog", importance: 2 },
      ],
    });

    expect(parseStandingFacts(reply)).toEqual([
      { text: "does not eat meat", importance: 3, replaces: null },
      { text: "always walks with a dog", importance: 2, replaces: null },
    ]);
  });

  it("reads a bare array as readily as a wrapped one", () => {
    expect(
      parseStandingFacts([{ text: "cannot manage stairs", importance: 3 }]),
    ).toEqual([
      { text: "cannot manage stairs", importance: 3, replaces: null },
    ]);
  });

  it("keeps the fact a new statement says it replaces", () => {
    const facts = parseStandingFacts({
      facts: [{ text: "eats meat", importance: 3, replaces: "does not eat meat" }],
    });

    expect(facts[0].replaces).toBe("does not eat meat");
  });

  // "No facts" is the common answer, and a garbled reply has to degrade to it
  // rather than to a 500 on a request the walker made for something else.
  it.each([
    ["prose instead of JSON", "I could not find any facts."],
    ["an empty string", ""],
    ["a null", null],
    ["a wrapper with no facts key", { preferences: [] }],
    ["facts that is not a list", { facts: "does not eat meat" }],
  ])("returns no facts for %s", (_label, input) => {
    expect(parseStandingFacts(input)).toEqual([]);
  });

  it.each([
    ["no text", { importance: 2 }],
    ["a non-string text", { text: 42, importance: 2 }],
    ["text shorter than the column allows", { text: "ok", importance: 2 }],
    ["text that normalizes to nothing", { text: "!!!!", importance: 2 }],
    ["no importance", { text: "walks with a dog" }],
    ["an importance outside 1-3", { text: "walks with a dog", importance: 7 }],
    ["an importance of zero", { text: "walks with a dog", importance: 0 }],
  ])("drops a fact with %s", (_label, malformed) => {
    const facts = parseStandingFacts({
      facts: [malformed, { text: "does not eat meat", importance: 3 }],
    });

    expect(facts).toEqual([
      { text: "does not eat meat", importance: 3, replaces: null },
    ]);
  });

  // The model was told 80 characters and the column takes 120: anything past
  // that is a run-on, not a second fact, so truncating beats dropping.
  it("truncates an over-long fact rather than losing it", () => {
    const facts = parseStandingFacts({
      facts: [{ text: "x".repeat(200), importance: 1 }],
    });

    expect(facts[0].text).toHaveLength(120);
  });

  it("collapses two phrasings of the same fact in one reply", () => {
    const facts = parseStandingFacts({
      facts: [
        { text: "does not eat meat", importance: 3 },
        { text: "Does not eat meat.", importance: 1 },
      ],
    });

    expect(facts).toHaveLength(1);
    expect(facts[0].importance).toBe(3);
  });

  it("believes at most three facts from one sentence", () => {
    const facts = parseStandingFacts({
      facts: [
        { text: "does not eat meat", importance: 3 },
        { text: "always walks with a dog", importance: 2 },
        { text: "cannot manage stairs", importance: 3 },
        { text: "walks with small children", importance: 2 },
      ],
    });

    expect(facts).toHaveLength(3);
  });
});

describe("scoreFact", () => {
  // 2*3 importance + 1 occurrence + 4 recency.
  it("scores a fresh hard constraint stated once at the top of the range", () => {
    expect(scoreFact(fact({ importance: 3 }), NOW)).toBeCloseTo(11, 5);
  });

  // 2*1 + 1 + 4.
  it("scores a fresh soft leaning stated once at the bottom", () => {
    expect(scoreFact(fact({ importance: 1 }), NOW)).toBeCloseTo(7, 5);
  });

  // The curve the design doc commits to in days, not in multiples of the
  // constant — a half-life of 90 has to fail here, and reading it off
  // HALF_LIFE_DAYS would make the test agree with whatever the code says.
  it.each([
    ["today", 0, 4],
    ["two months on", 60, 2],
    ["four months on", 120, 1],
    // Six half-lives: 4 * 0.5**6. The design doc's prose says "~0.25 at a
    // year", which is the eight-month point — the curve, not the sentence,
    // is what ships.
    ["a year on", 360, 0.0625],
  ])("contributes %s a recency term of %i-day age", (_label, days, expectedRecency) => {
    const score = scoreFact(fact({ lastSeenAt: daysAgo(days) }), NOW);

    // 2*1 importance + 1 occurrence, plus whatever recency is left.
    expect(score).toBeCloseTo(3 + expectedRecency, 5);
  });

  it("halves the recency term over exactly one half-life", () => {
    expect(HALF_LIFE_DAYS).toBe(60);

    const fresh = scoreFact(fact({ lastSeenAt: daysAgo(0) }), NOW) - 3;
    const aged = scoreFact(fact({ lastSeenAt: daysAgo(HALF_LIFE_DAYS) }), NOW) - 3;

    expect(aged).toBeCloseTo(fresh / 2, 5);
  });

  it("stops rewarding repetition past the occurrence cap", () => {
    const five = scoreFact(fact({ occurrenceCount: 5 }), NOW);
    const fifty = scoreFact(fact({ occurrenceCount: 50 }), NOW);

    expect(fifty).toBe(five);
    expect(five).toBeCloseTo(2 + 5 + 4, 5);
  });

  // A skewed clock is not evidence of anything; it must not buy a bonus.
  it("treats a fact last heard in the future as heard now", () => {
    const future = scoreFact(fact({ lastSeenAt: daysAgo(-30) }), NOW);

    expect(future).toBe(scoreFact(fact({ lastSeenAt: daysAgo(0) }), NOW));
  });

  // The intended asymmetry: recency demotes, it never deletes.
  it("keeps a year-old hard constraint above the floor", () => {
    const stale = fact({ importance: 3, lastSeenAt: daysAgo(365) });

    expect(scoreFact(stale, NOW)).toBeGreaterThanOrEqual(MIN_FACT_SCORE);
  });

  it("drops a year-old soft leaning below the floor", () => {
    const stale = fact({ importance: 1, lastSeenAt: daysAgo(365) });

    expect(scoreFact(stale, NOW)).toBeLessThan(MIN_FACT_SCORE);
  });
});

describe("selectFactsForPrompt", () => {
  it("returns the strongest facts first", () => {
    const selected = selectFactsForPrompt(
      [
        fact({ id: "soft", text: "prefers quiet streets", importance: 1 }),
        fact({ id: "hard", text: "does not eat meat", importance: 3 }),
        fact({ id: "habit", text: "always walks with a dog", importance: 2 }),
      ],
      NOW,
    );

    expect(selected.map((entry) => entry.id)).toEqual(["hard", "habit", "soft"]);
  });

  it("leaves out anything below the score floor", () => {
    const selected = selectFactsForPrompt(
      [
        fact({ id: "fresh", importance: 3 }),
        fact({ id: "faded", importance: 1, lastSeenAt: daysAgo(365) }),
      ],
      NOW,
    );

    expect(selected.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("spends prompt tokens on at most five facts", () => {
    const many = Array.from({ length: 12 }, (_unused, index) =>
      fact({ id: `fact-${index}`, importance: 3 }),
    );

    expect(selectFactsForPrompt(many, NOW)).toHaveLength(MAX_FACTS_IN_PROMPT);
  });

  it("breaks a tie on the more recently heard fact", () => {
    const selected = selectFactsForPrompt(
      [
        fact({ id: "older", lastSeenAt: daysAgo(0.2) }),
        fact({ id: "newer", lastSeenAt: daysAgo(0.1) }),
      ],
      NOW,
    );

    expect(selected.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("selects nothing from an empty profile", () => {
    expect(selectFactsForPrompt([], NOW)).toEqual([]);
  });
});

describe("weakestFact", () => {
  it("names the lowest-scoring fact, which is what eviction drops", () => {
    const weakest = weakestFact(
      [
        fact({ id: "hard", importance: 3 }),
        fact({ id: "soft-stale", importance: 1, lastSeenAt: daysAgo(200) }),
        fact({ id: "habit", importance: 2 }),
      ],
      NOW,
    );

    expect(weakest?.id).toBe("soft-stale");
  });

  it("breaks a tie on the less recently heard fact", () => {
    const weakest = weakestFact(
      [
        fact({ id: "newer", lastSeenAt: daysAgo(0.1) }),
        fact({ id: "older", lastSeenAt: daysAgo(0.2) }),
      ],
      NOW,
    );

    expect(weakest?.id).toBe("older");
  });

  it("has nothing to evict from an empty profile", () => {
    expect(weakestFact([], NOW)).toBeNull();
  });
});

// Ariel's call on the design doc's open question: a contradiction is surfaced
// to the walker, and if they say nothing the most recently stated fact wins.
// This is the detection half — matching the model's claim back to a real row.
describe("findContradicted", () => {
  const STORED = [
    fact({ id: "meat", text: "does not eat meat", importance: 3 }),
    fact({ id: "dog", text: "always walks with a dog", importance: 2 }),
  ];

  function extracted(overrides: {
    text?: string;
    importance?: FactImportance;
    replaces?: string | null;
  }) {
    return {
      text: "eats meat",
      importance: 3 as FactImportance,
      replaces: null,
      ...overrides,
    };
  }

  it("finds the stored fact a reversal names", () => {
    const found = findContradicted(
      extracted({ replaces: "does not eat meat" }),
      STORED,
    );

    expect(found?.id).toBe("meat");
  });

  it("matches on the normalized key, not the exact string", () => {
    const found = findContradicted(
      extracted({ replaces: "Does not eat MEAT." }),
      STORED,
    );

    expect(found?.id).toBe("meat");
  });

  it("finds nothing when the new fact contradicts nothing", () => {
    expect(findContradicted(extracted({ replaces: null }), STORED)).toBeNull();
  });

  // The model has invented a memory. Acting on it would retire a real fact on
  // the strength of a row that was never there.
  it("ignores a reversal naming a fact that is not on record", () => {
    const found = findContradicted(
      extracted({ replaces: "hates the sea" }),
      STORED,
    );

    expect(found).toBeNull();
  });

  // A repeat statement is a repeat, not a reversal; treating it as one would
  // supersede a row with its own successor.
  it("refuses to let a fact contradict itself", () => {
    const found = findContradicted(
      extracted({ text: "does not eat meat", replaces: "Does not eat meat" }),
      STORED,
    );

    expect(found).toBeNull();
  });

  it("finds nothing against an empty profile", () => {
    expect(
      findContradicted(extracted({ replaces: "does not eat meat" }), []),
    ).toBeNull();
  });
});

describe("buildKnownFactsBlock", () => {
  it("lists the facts the model should check a contradiction against", () => {
    const block = buildKnownFactsBlock([
      fact({ text: "does not eat meat" }),
      fact({ text: "always walks with a dog" }),
    ]);

    expect(block).toContain("- does not eat meat");
    expect(block).toContain("- always walks with a dog");
  });

  // With nothing known the request sent is what it was before contradictions
  // existed, which is what makes the change safe to ship.
  it("is empty for a walker with nothing on record", () => {
    expect(buildKnownFactsBlock([])).toBe("");
  });
});

describe("FACT_EXTRACTION_SYSTEM_PROMPT", () => {
  // The one real overlap with the preference pass. Without an explicit rule the
  // same statement is written twice and the two copies drift apart.
  it("tells the model that category likings belong to the preference pass", () => {
    expect(FACT_EXTRACTION_SYSTEM_PROMPT).toMatch(/preference pass/i);
    expect(FACT_EXTRACTION_SYSTEM_PROMPT).toMatch(/museums/i);
  });

  it("tells the model that an empty list is the normal answer", () => {
    expect(FACT_EXTRACTION_SYSTEM_PROMPT).toMatch(/empty list/i);
  });

  it("explains what replaces is for", () => {
    expect(FACT_EXTRACTION_SYSTEM_PROMPT).toMatch(/`replaces`/);
  });
});

describe("buildPromptWithFacts", () => {
  it("puts the facts in front of the request, each on its own line", () => {
    const contents = buildPromptWithFacts("a walk in Jaffa", [
      fact({ text: "does not eat meat" }),
      fact({ text: "always walks with a dog" }),
    ]);

    expect(contents).toBe(
      [
        "Standing facts about this walker:",
        "- does not eat meat",
        "- always walks with a dog",
        "",
        "Request:",
        "a walk in Jaffa",
      ].join("\n"),
    );
  });

  // The one property that makes step 9 safe to ship: a walker with nothing on
  // record sends byte-identical contents to what was sent before facts existed.
  it("is the prompt itself, unchanged, when there are no facts", () => {
    expect(buildPromptWithFacts("a walk in Jaffa", [])).toBe("a walk in Jaffa");
  });
});

// Step 11. The merge's whole risk is that folding two prompts into one blurs the
// boundary they were written to hold, so these are mostly about what survived.
describe("COMBINED_EXTRACTION_SYSTEM_PROMPT", () => {
  // The drift guard. A hand-merged third copy of either prompt would go stale
  // the first time someone edited an original; composition cannot.
  it("carries both source prompts verbatim", () => {
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toContain(
      PLACE_EXTRACTION_SYSTEM_PROMPT,
    );
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toContain(
      FACT_EXTRACTION_SYSTEM_PROMPT,
    );
  });

  // The one rule that had to survive the merge, in both directions. Before, it
  // was enforced by the two passes being different requests that could not see
  // each other's fields; now it is enforced by these lines.
  it("keeps a category liking out of the facts", () => {
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /never a standing fact|must not be repeated here/i,
    );
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toMatch(/I love museums/);
  });

  it("keeps a standing fact out of the places and the category needs", () => {
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /never adds a name to `places` and never adds a value to `categoryNeeds`/,
    );
  });

  // The reversal-only list is new, and useless — worse than useless, since it
  // would read as walk context — unless the instruction says what it is.
  it("explains the reversal-only fact list", () => {
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toContain(
      "Older facts, for spotting a reversal only",
    );
    expect(COMBINED_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /NOT context for this walk/,
    );
  });
});

describe("buildCombinedExtractionPrompt", () => {
  it("puts the steering facts in front of the request", () => {
    expect(
      buildCombinedExtractionPrompt("a walk in Jaffa", [
        fact({ text: "does not eat meat" }),
      ]),
    ).toBe(
      [
        "Standing facts about this walker:",
        "- does not eat meat",
        "",
        "Request:",
        "a walk in Jaffa",
      ].join("\n"),
    );
  });

  it("labels the older facts as a separate, reversal-only list", () => {
    expect(
      buildCombinedExtractionPrompt(
        "I eat meat again",
        [fact({ text: "always walks with a dog" })],
        [fact({ text: "does not eat meat" })],
      ),
    ).toBe(
      [
        "Standing facts about this walker:",
        "- always walks with a dog",
        "",
        "Older facts, for spotting a reversal only:",
        "- does not eat meat",
        "",
        "Request:",
        "I eat meat again",
      ].join("\n"),
    );
  });

  // A demoted fact still has to be contradictable even when nothing scored high
  // enough to steer the walk, so the second list stands on its own.
  it("sends the older list alone when nothing scored high enough to steer", () => {
    expect(
      buildCombinedExtractionPrompt(
        "I eat meat again",
        [],
        [fact({ text: "does not eat meat" })],
      ),
    ).toBe(
      [
        "Older facts, for spotting a reversal only:",
        "- does not eat meat",
        "",
        "Request:",
        "I eat meat again",
      ].join("\n"),
    );
  });

  // Same property `buildPromptWithFacts` has: a walker with nothing on record
  // sends the contents a plain extraction would have sent.
  it("is the prompt itself when there is nothing on record", () => {
    expect(buildCombinedExtractionPrompt("a walk in Jaffa", [], [])).toBe(
      "a walk in Jaffa",
    );
  });
});

describe("parseCombinedExtraction", () => {
  it("reads the walk and the facts out of one reply", () => {
    const { extraction, facts } = parseCombinedExtraction(
      JSON.stringify({
        places: ["Habima Square"],
        contextLocation: "Tel Aviv",
        durationMinutes: 120,
        facts: [{ text: "does not eat meat", importance: 3, replaces: null }],
      }),
    );

    expect(extraction.places).toEqual(["Habima Square"]);
    expect(extraction.contextLocation).toBe("Tel Aviv");
    expect(extraction.durationMinutes).toBe(120);
    expect(facts).toEqual([
      { text: "does not eat meat", importance: 3, replaces: null },
    ]);
  });

  // One merged call means one reply to lose. Each half degrades on its own, so a
  // model that mangles the facts costs a fact and not the walk.
  it("keeps the walk when the facts half is unusable", () => {
    const { extraction, facts } = parseCombinedExtraction(
      JSON.stringify({ places: ["Jaffa"], facts: "not a list" }),
    );

    expect(extraction.places).toEqual(["Jaffa"]);
    expect(facts).toEqual([]);
  });

  it("keeps the facts when the walk half is unusable", () => {
    const { extraction, facts } = parseCombinedExtraction(
      JSON.stringify({
        places: "not a list",
        facts: [{ text: "walks with a dog", importance: 2 }],
      }),
    );

    expect(extraction.places).toEqual([]);
    expect(facts).toEqual([
      { text: "walks with a dog", importance: 2, replaces: null },
    ]);
  });

  it("reads a blocked or empty reply as neither", () => {
    expect(parseCombinedExtraction("")).toEqual({
      extraction: {
        places: [],
        contextLocation: null,
        durationMinutes: null,
        categoryNeeds: [],
        stopCount: null,
        notableOnly: null,
        maxEndDistanceKm: null,
        searchRadiusKm: null,
      },
      facts: [],
    });
  });
});
