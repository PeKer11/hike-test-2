import "server-only";

import { GoogleGenAI, Type, type Schema } from "@google/genai";

import {
  CANONICAL_NAME_SYSTEM_PROMPT,
  parseCanonicalName,
  parsePlaceExtraction,
  PLACE_EXTRACTION_SYSTEM_PROMPT,
  type PlaceExtraction,
} from "@/lib/places/place-extractor";
import {
  buildKnownFactsBlock,
  buildPromptWithFacts,
  FACT_EXTRACTION_SYSTEM_PROMPT,
  parseStandingFacts,
  type ExtractedFact,
  type StoredFact,
} from "@/lib/preferences/fact-extractor";
import {
  ATTRACTION_CATEGORIES,
  parseCategoryPreferences,
  PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
  type CategoryPreference,
} from "@/lib/preferences/preference-extractor";

// Ariel picked Flash-Lite for this: the task is a short, cheap NER pass on one
// sentence, latency sits in front of the user typing a prompt, and Google AI
// Studio's free tier covers it without a credit card.
// Pinned model names get deprecated (gemini-2.5-flash-lite 404'd for new
// projects); the "-latest" alias auto-follows Google's current stable
// Flash-Lite release instead of needing a manual bump each time.
const MODEL = "gemini-flash-lite-latest";

const PLACES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Place, venue, or landmark names extracted from the text.",
    },
    contextLocation: {
      type: Type.STRING,
      nullable: true,
      description:
        "City, town, neighbourhood, or region named only to say where the places are, or null.",
    },
    durationMinutes: {
      type: Type.INTEGER,
      nullable: true,
      description:
        "Total walk length in whole minutes when the text states one unambiguously, or null.",
    },
    categoryNeeds: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ATTRACTION_CATEGORIES },
      description:
        "Kinds of stop asked for on this walk without naming a place, for example food for 'I also want to eat'.",
    },
    stopCount: {
      type: Type.INTEGER,
      nullable: true,
      description:
        "How many stops the walker asked for, when the text states a count unambiguously, or null.",
    },
    // A quality asked of every stop, not a kind of stop, so it is its own field
    // rather than a value in `categoryNeeds`. That enum is `ATTRACTION_CATEGORIES`,
    // shared with the preference learner and the ranker's category score table —
    // a pseudo-category "famous" would immediately be learnable as a standing
    // preference and would need a base score, neither of which means anything.
    notableOnly: {
      type: Type.BOOLEAN,
      nullable: true,
      description:
        "True when the walker asks specifically for famous or well-known places, otherwise null.",
    },
    // Deliberately not the search radius: this is where the walk has to END,
    // the same distinction `maxEndDistanceFromOriginMeters` already makes
    // downstream. A number, not an integer, because "half a kilometre" is 0.5.
    maxEndDistanceKm: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "How far from the start the walk may finish, in kilometres, when the text states one unambiguously, or null.",
    },
    // The other half of the same sentence, and deliberately not the same field:
    // this is how far out to LOOK for stops, where `maxEndDistanceKm` is where
    // the walk has to end. A prompt can state both at once and mean two
    // different numbers. A number, not an integer, because "half a kilometre"
    // is 0.5.
    searchRadiusKm: {
      type: Type.NUMBER,
      nullable: true,
      description:
        "How far from the origin to search for places, in kilometres, when the text states one unambiguously, or null.",
    },
  },
  // Everything past `places` stays optional: most prompts have none of it, and a
  // missing field parses to null / an empty list just like an explicit one.
  required: ["places"],
};

const CANONICAL_NAME_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    canonicalName: {
      type: Type.STRING,
      nullable: true,
      description:
        "The formal or commonly-mapped name of the place, or null if none is known with confidence.",
    },
  },
  // Left optional for the same reason as `contextLocation`: an omitted field
  // and an explicit null both mean "no better name", and both parse to null.
  required: [],
};

const PREFERENCES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    preferences: {
      type: Type.ARRAY,
      description:
        "Standing preferences about kinds of places that the text states clearly. Usually empty.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ATTRACTION_CATEGORIES },
          sentiment: { type: Type.STRING, enum: ["like", "dislike"] },
        },
        required: ["category", "sentiment"],
      },
    },
  },
  required: ["preferences"],
};

const FACTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    facts: {
      type: Type.ARRAY,
      description:
        "Standing facts about the walker that outlive this one walk. Usually empty.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description:
              "The fact in short third person, at most 80 characters.",
          },
          importance: {
            type: Type.INTEGER,
            description:
              "3 a hard constraint the walk must respect, 2 a persistent habit, 1 a soft leaning.",
          },
          // Nullable rather than omitted-when-absent for the same reason
          // `contextLocation` is: an explicit null is the common answer, and
          // asking the model to leave a field out is a weaker instruction than
          // asking it to say "nothing".
          replaces: {
            type: Type.STRING,
            nullable: true,
            description:
              "The exact text of a known fact this one contradicts, or null.",
          },
        },
        required: ["text", "importance"],
      },
    },
  },
  required: ["facts"],
};

function apiKeyOrThrow(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
  }
  return apiKey;
}

/** Total tries for one Gemini call, first attempt included. */
const MAX_ATTEMPTS = 3;

/** First backoff window; each retry doubles it. */
const BASE_DELAY_MS = 600;

/**
 * How long a single call may spend on retries, measured from the first attempt.
 * The place call runs ~1s at the median, so three attempts plus their backoffs
 * land around 5s and this only bites when attempts themselves run long. It is
 * deliberately far below `WALK_PLAN_TIMEOUT_MS` (120s): a walk build is one
 * foreground action the walker chose to wait for, while this sits in front of
 * the prompt box with nothing on screen yet, and a prompt that fails clearly at
 * ~10s beats one that hangs for half a minute and fails anyway.
 *
 * Note what this does and does not bound. It stops a *new* attempt from
 * starting past the budget; it cannot cut short an attempt already in flight,
 * because no per-request timeout is set on the SDK today (`httpOptions.timeout`
 * would be the place). So one hung request still hangs — the budget bounds what
 * retrying adds, which is the part introduced here.
 */
const RETRY_BUDGET_MS = 10_000;

/**
 * The HTTP status behind a failed call, or null when there is none to read.
 *
 * `@google/genai` throws its own `ApiError` with the numeric status as a
 * top-level `status` property (`throwErrorIfNotOK` in the SDK builds it for
 * anything 400-599). The `message` is the whole error body JSON-stringified, so
 * the status is the field to read and the message is not worth parsing. Read
 * structurally rather than with `instanceof ApiError` so this keeps working
 * against anything that reports a status the same way.
 */
function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Worth trying again only when the request itself was fine: 429 means we asked
 * too fast, 5xx means their side. A 400 (bad schema, unsupported field — see
 * the `thinkingConfig` note below) or a 401/403 will fail identically on every
 * attempt, so retrying one spends the budget to arrive at the same error later.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Equal jitter: half the window fixed so each retry really does wait longer
 * than the last, half random so two requests rate-limited by the same burst do
 * not come back in step. A fixed interval is what turns one 429 into a retry
 * storm, which is the failure this exists to avoid, so the random half is the
 * point rather than a refinement.
 *
 * No separate per-delay cap: with three attempts the longest sleep is 1.2s, and
 * `RETRY_BUDGET_MS` is what actually bounds the growth.
 */
function backoffDelayMs(attempt: number): number {
  const window = BASE_DELAY_MS * 2 ** (attempt - 1);
  return window / 2 + Math.random() * (window / 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a Gemini call, retrying it through rate limits and transient server
 * errors. Nothing here changes what callers see on failure: the last error is
 * rethrown as it arrived, so `learnPreferencesFromText` and
 * `learnFactsFromText` still swallow it into their fallbacks and the place call
 * still fails the request the way it does today — just after the retries rather
 * than on the first 429.
 */
async function withGeminiRetry<T>(call: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const status = statusOf(error);
      if (
        attempt >= MAX_ATTEMPTS ||
        status === null ||
        !isRetryableStatus(status)
      ) {
        throw error;
      }

      const delay = backoffDelayMs(attempt);
      if (Date.now() - startedAt + delay >= RETRY_BUDGET_MS) {
        throw error;
      }

      console.warn(
        `Gemini call failed with ${status}; retrying in ${Math.round(delay)}ms (attempt ${attempt + 1} of ${MAX_ATTEMPTS})`,
      );
      await sleep(delay);
    }
  }
}

/**
 * Ask Gemini Flash-Lite to pull the named places out of a free-text prompt,
 * along with the area they sit in, how long the walk is, and any kind of stop
 * asked for without a name. Uses JSON mode with a response schema so the answer
 * arrives as structured JSON instead of prose we would have to regex.
 *
 * `facts` is what the walker is on record as standing for — dietary rules,
 * mobility limits, who they walk with. They are context for reading the
 * request, never an addition to it (see the rule at the end of
 * `PLACE_EXTRACTION_SYSTEM_PROMPT`), and they ride in the user contents rather
 * than the system instruction because the instruction is shared across walkers
 * and is the half worth caching. With none, the request sent is byte-identical
 * to the one this function sent before facts existed.
 */
export async function extractPlaceNames(
  prompt: string,
  facts: StoredFact[] = [],
): Promise<PlaceExtraction> {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: MODEL,
      contents: buildPromptWithFacts(prompt, facts),
      config: {
        systemInstruction: PLACE_EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: PLACES_SCHEMA,
        maxOutputTokens: 512,
        // `thinkingConfig: { thinkingBudget: 0 }` was tried to reserve the full
        // output budget for the answer, but gemini-3.5-flash-lite rejects that
        // field with a 400 (works fine on 2.5-series models) — omitted.
      },
    }),
  );

  // JSON mode makes `text` a JSON document; `parsePlaceExtraction` handles the
  // string, and also copes with a blocked or empty response.
  return parsePlaceExtraction(response.text ?? "");
}

/**
 * Second chance for a name Nominatim could not find: ask the model what that
 * place is actually called on a map, so the caller can retry the lookup with
 * the mapped name. Returns null whenever the model has nothing better to offer
 * — see `CANONICAL_NAME_SYSTEM_PROMPT` for why null is the preferred answer.
 */
export async function resolveCanonicalName(
  name: string,
  contextLocation: string | null,
): Promise<string | null> {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: MODEL,
      contents: [
        `Term: ${name}`,
        `Area: ${contextLocation ?? "not given"}`,
      ].join("\n"),
      config: {
        systemInstruction: CANONICAL_NAME_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: CANONICAL_NAME_SCHEMA,
        maxOutputTokens: 128,
      },
    }),
  );

  return parseCanonicalName(response.text ?? "");
}

/**
 * Pull the standing category preferences out of free text — the "name your own
 * stops" box, or the post-walk "what did you like?" box. Deliberately a
 * separate call from `extractPlaceNames` rather than an extra field on it:
 *
 * - place extraction runs for everyone, this runs only for a signed-in walker
 *   who has left preference learning on, so folding them together would make
 *   every logged-out prompt pay for a field nobody reads;
 * - the post-walk box has no places to extract at all, and reusing one function
 *   for both entry points keeps a single definition of what a preference is.
 */
export async function extractCategoryPreferences(
  text: string,
): Promise<CategoryPreference[]> {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: MODEL,
      contents: text,
      config: {
        systemInstruction: PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: PREFERENCES_SCHEMA,
        maxOutputTokens: 256,
      },
    }),
  );

  return parseCategoryPreferences(response.text ?? "");
}

/**
 * Pull the standing facts out of free text — the things about a walker that
 * outlive any one walk, as opposed to the category preferences above.
 *
 * A separate call from `extractCategoryPreferences` for the same reason that
 * one is separate from `extractPlaceNames`, and a separate call from
 * `extractPlaceNames` for a stronger one: place extraction runs for everyone
 * including logged-out walkers, and this runs only for a signed-in walker with
 * learning left on. Folding them together would make every anonymous prompt pay
 * for a field nobody reads.
 *
 * `knownFacts` is what the walker is already on record as saying, and it is
 * here so the model can mark a statement that reverses one of them. With an
 * empty list the request sent is byte-identical to one made before
 * contradiction detection existed.
 */
export async function extractStandingFacts(
  text: string,
  knownFacts: StoredFact[] = [],
): Promise<ExtractedFact[]> {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const known = buildKnownFactsBlock(knownFacts);

  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: MODEL,
      // Per-user text belongs in `contents`; the system instruction stays a
      // module constant, which is the half worth caching across walkers.
      contents: known ? `${known}Text:\n${text}` : text,
      config: {
        systemInstruction: FACT_EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: FACTS_SCHEMA,
        maxOutputTokens: 256,
      },
    }),
  );

  return parseStandingFacts(response.text ?? "");
}
