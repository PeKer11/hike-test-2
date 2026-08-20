import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();

// The Google SDK is the one thing here that would make a network call. The
// prompts, the schemas and the parsers are all the project's own code and run
// for real, which is the point: this file exists to check what actually goes on
// the wire.
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
    INTEGER: "INTEGER",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
  },
}));

import {
  extractPlaceNames,
  extractPlacesAndFacts,
  extractStandingFacts,
} from "@/lib/api/gemini-client";
import { PLACE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/places/place-extractor";
import {
  COMBINED_EXTRACTION_SYSTEM_PROMPT,
  FACT_EXTRACTION_SYSTEM_PROMPT,
  type StoredFact,
} from "@/lib/preferences/fact-extractor";

function fact(text: string, overrides: Partial<StoredFact> = {}): StoredFact {
  return {
    id: `fact-${text}`,
    text,
    key: text,
    importance: 3,
    occurrenceCount: 1,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

/** What the SDK was asked to send. */
const sentRequest = () => mockGenerateContent.mock.calls[0][0];

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  mockGenerateContent.mockReset();
  mockGenerateContent.mockResolvedValue({
    text: JSON.stringify({ places: [], facts: [] }),
  });
});

describe("extractPlaceNames", () => {
  it("sends the walker's standing facts in front of their request", async () => {
    await extractPlaceNames("a walk in Jaffa", [
      fact("does not eat meat"),
      fact("always walks with a dog"),
    ]);

    expect(sentRequest().contents).toBe(
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

  // The property step 9 rests on. A walker with nothing on record has to send
  // exactly what this function sent before facts existed.
  it("sends the bare prompt for a walker with no facts", async () => {
    await extractPlaceNames("a walk in Jaffa");

    expect(sentRequest().contents).toBe("a walk in Jaffa");
  });

  it("sends the bare prompt when an empty fact list is passed explicitly", async () => {
    await extractPlaceNames("a walk in Jaffa", []);

    expect(sentRequest().contents).toBe("a walk in Jaffa");
  });

  // Per-user text belongs in `contents`; the instruction is shared across every
  // walker and is the half worth caching.
  it("keeps the system instruction free of the walker's own facts", async () => {
    // A fact phrased so it cannot collide with the prompt's own examples.
    await extractPlaceNames("a walk in Jaffa", [fact("keeps chickens at home")]);

    expect(sentRequest().config.systemInstruction).toBe(
      PLACE_EXTRACTION_SYSTEM_PROMPT,
    );
    expect(sentRequest().config.systemInstruction).not.toContain(
      "keeps chickens at home",
    );
    expect(sentRequest().contents).toContain("keeps chickens at home");
  });

  it("parses the reply into the extraction the route reads", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        places: ["Habima Square"],
        contextLocation: "Tel Aviv",
        durationMinutes: 90,
      }),
    });

    const extraction = await extractPlaceNames("a walk in Tel Aviv");

    expect(extraction.places).toEqual(["Habima Square"]);
    expect(extraction.contextLocation).toBe("Tel Aviv");
    expect(extraction.durationMinutes).toBe(90);
  });
});

// Step 11: the walk pass and the fact pass in one request, for the one walker
// who was going to pay for both anyway.
describe("extractPlacesAndFacts", () => {
  it("asks for both halves in one request", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        places: ["Habima Square"],
        facts: [{ text: "does not eat meat", importance: 3, replaces: null }],
      }),
    });

    const result = await extractPlacesAndFacts(
      "I don't eat meat, take me to Habima Square",
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.extraction.places).toEqual(["Habima Square"]);
    expect(result.facts).toEqual([
      { text: "does not eat meat", importance: 3, replaces: null },
    ]);
  });

  // The merged instruction is the two originals, so neither pass can quietly
  // lose a rule it had when it was a request of its own.
  it("sends the merged instruction, with both originals inside it", async () => {
    await extractPlacesAndFacts("a walk in Jaffa");

    const instruction = sentRequest().config.systemInstruction;
    expect(instruction).toBe(COMBINED_EXTRACTION_SYSTEM_PROMPT);
    expect(instruction).toContain(PLACE_EXTRACTION_SYSTEM_PROMPT);
    expect(instruction).toContain(FACT_EXTRACTION_SYSTEM_PROMPT);
  });

  // Both schemas, one object. `facts` is required so "no facts" and "the model
  // forgot job 2" stop looking alike.
  it("sends a schema that carries the walk fields and the facts", async () => {
    await extractPlacesAndFacts("a walk in Jaffa");

    const schema = sentRequest().config.responseSchema;
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        "places",
        "contextLocation",
        "durationMinutes",
        "categoryNeeds",
        "stopCount",
        "notableOnly",
        "maxEndDistanceKm",
        "searchRadiusKm",
        "facts",
      ]),
    );
    expect(schema.required).toEqual(["places", "facts"]);
  });

  it("keeps the walker's own facts out of the shared instruction", async () => {
    await extractPlacesAndFacts("a walk in Jaffa", [fact("keeps chickens at home")]);

    expect(sentRequest().config.systemInstruction).not.toContain(
      "keeps chickens at home",
    );
    expect(sentRequest().contents).toContain("keeps chickens at home");
  });

  it("labels the steering facts and the reversal-only facts separately", async () => {
    await extractPlacesAndFacts(
      "I eat meat again",
      [fact("always walks with a dog")],
      [fact("does not eat meat")],
    );

    expect(sentRequest().contents).toBe(
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

  it("sends the bare prompt for a walker with nothing on record", async () => {
    await extractPlacesAndFacts("a walk in Jaffa");

    expect(sentRequest().contents).toBe("a walk in Jaffa");
  });

  it("reads a blocked or empty reply as neither a walk nor facts", async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    const result = await extractPlacesAndFacts("a walk in Jaffa");

    expect(result.extraction.places).toEqual([]);
    expect(result.facts).toEqual([]);
  });
});

describe("extractStandingFacts", () => {
  it("sends the known facts so the model can mark a reversal", async () => {
    await extractStandingFacts("I eat meat again", [fact("does not eat meat")]);

    expect(sentRequest().contents).toContain("Already known about this walker:");
    expect(sentRequest().contents).toContain("- does not eat meat");
    expect(sentRequest().contents).toContain("I eat meat again");
  });

  it("sends the bare text for a walker with nothing on record", async () => {
    await extractStandingFacts("I don't eat meat");

    expect(sentRequest().contents).toBe("I don't eat meat");
  });

  it("parses the facts out of the reply", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        facts: [
          { text: "eats meat", importance: 3, replaces: "does not eat meat" },
        ],
      }),
    });

    expect(
      await extractStandingFacts("I eat meat again", [fact("does not eat meat")]),
    ).toEqual([
      { text: "eats meat", importance: 3, replaces: "does not eat meat" },
    ]);
  });

  it("reads a blocked or empty reply as no facts rather than throwing", async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    expect(await extractStandingFacts("a walk in Jaffa")).toEqual([]);
  });
});
