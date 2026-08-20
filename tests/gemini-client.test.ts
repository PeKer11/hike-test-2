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
  extractStandingFacts,
} from "@/lib/api/gemini-client";
import { PLACE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/places/place-extractor";
import type { StoredFact } from "@/lib/preferences/fact-extractor";

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
