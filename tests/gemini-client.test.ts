import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  extractCategoryPreferences,
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

/**
 * What `@google/genai` really throws for a non-2xx: an `ApiError` whose numeric
 * HTTP status is a top-level property, with the whole error body stringified
 * into the message. The status is what the wrapper reads, so that is what these
 * fakes have to carry.
 */
function apiError(status: number): Error & { status: number } {
  const error = new Error(
    JSON.stringify({ error: { code: status, message: "fake failure" } }),
  );
  return Object.assign(error, { status });
}

describe("retrying a Gemini call", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The wrapper logs each retry; keep it out of the test output.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries a rate-limited call and returns the answer the retry gives", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce({ text: JSON.stringify({ places: ["Jaffa"] }) });

    const pending = extractPlaceNames("a walk in Jaffa");
    await vi.advanceTimersByTimeAsync(10_000);

    expect((await pending).places).toEqual(["Jaffa"]);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("retries a 500 as well as a 429", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce({
        text: JSON.stringify({ facts: [{ text: "eats meat", importance: 3 }] }),
      });

    const pending = extractStandingFacts("I eat meat again");
    await vi.advanceTimersByTimeAsync(10_000);

    expect((await pending)[0].text).toBe("eats meat");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // The wrapper is shared, not bolted onto the place call alone.
  it("retries the preference call too", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({
        text: JSON.stringify({ preferences: [] }),
      });

    const pending = extractCategoryPreferences("I liked the museums");
    await vi.advanceTimersByTimeAsync(10_000);

    await pending;
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // The contract the callers already have: `learnPreferencesFromText` and
  // `learnFactsFromText` catch and fall back, the place call fails the request.
  // Retries delay that, they must not swallow it.
  it("rethrows the last failure once the attempts are spent", async () => {
    const failure = apiError(429);
    mockGenerateContent.mockRejectedValue(failure);

    const settled = extractPlaceNames("a walk in Jaffa").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await settled).toBe(failure);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 400 — the same request would fail the same way", async () => {
    const failure = apiError(400);
    mockGenerateContent.mockRejectedValue(failure);

    const settled = extractPlaceNames("a walk in Jaffa").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await settled).toBe(failure);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry an auth failure", async () => {
    mockGenerateContent.mockRejectedValue(apiError(403));

    const settled = extractPlaceNames("a walk in Jaffa").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await settled;
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failure with no status to judge", async () => {
    mockGenerateContent.mockRejectedValue(new Error("something else broke"));

    const settled = extractPlaceNames("a walk in Jaffa").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await settled;
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("waits longer before each retry than before the one behind it", async () => {
    // Mid-window: the wait is the fixed half plus half the random half, so
    // 0.75 × the window.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    mockGenerateContent.mockRejectedValue(apiError(429));

    const settled = extractPlaceNames("a walk in Jaffa").catch(() => "failed");

    await vi.advanceTimersByTimeAsync(0);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // First window 600ms → 300 + 0.5 × 300 = 450ms.
    await vi.advanceTimersByTimeAsync(449);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    // Second window doubles to 1200ms → 600 + 0.5 × 600 = 900ms.
    await vi.advanceTimersByTimeAsync(899);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);

    expect(await settled).toBe("failed");
  });

  // The half that stops a rate-limited burst from coming back in step. Two
  // draws of the same window have to give two different waits.
  it("jitters the wait rather than using a fixed interval", async () => {
    async function firstRetryAt(random: number): Promise<number> {
      mockGenerateContent.mockReset();
      mockGenerateContent.mockRejectedValue(apiError(429));
      vi.spyOn(Math, "random").mockReturnValue(random);

      const settled = extractPlaceNames("a walk in Jaffa").catch(() => "failed");

      let waited = 0;
      while (mockGenerateContent.mock.calls.length < 2 && waited < 600) {
        await vi.advanceTimersByTimeAsync(1);
        waited += 1;
      }

      await vi.advanceTimersByTimeAsync(10_000);
      await settled;
      return waited;
    }

    // Bottom of the 600ms window is the fixed half alone; a high draw lands
    // near the whole window. A fixed interval would give the same wait twice.
    const low = await firstRetryAt(0);
    const high = await firstRetryAt(0.998);

    expect(low).toBe(300);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(600);
  });

  // The budget stops a *new* attempt starting, so a chain of slow failures
  // fails at roughly the budget instead of at attempts × slow.
  it("gives up rather than starting a retry past the latency budget", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    // Each attempt takes 9.8s to fail, so a 450ms wait plus what is already
    // spent is over the 10s budget before the second attempt could start.
    mockGenerateContent.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(apiError(429)), 9_800);
        }),
    );

    const settled = extractPlaceNames("a walk in Jaffa").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await settled).toMatchObject({ status: 429 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
