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

function apiKeyOrThrow(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
  }
  return apiKey;
}

/**
 * Ask Gemini Flash-Lite to pull the named places out of a free-text prompt,
 * along with the area they sit in, how long the walk is, and any kind of stop
 * asked for without a name. Uses JSON mode with a response schema so the answer
 * arrives as structured JSON instead of prose we would have to regex.
 */
export async function extractPlaceNames(
  prompt: string,
): Promise<PlaceExtraction> {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: PLACE_EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: PLACES_SCHEMA,
      maxOutputTokens: 512,
      // `thinkingConfig: { thinkingBudget: 0 }` was tried to reserve the full
      // output budget for the answer, but gemini-3.5-flash-lite rejects that
      // field with a 400 (works fine on 2.5-series models) — omitted.
    },
  });

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

  const response = await client.models.generateContent({
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
  });

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

  const response = await client.models.generateContent({
    model: MODEL,
    contents: text,
    config: {
      systemInstruction: PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: PREFERENCES_SCHEMA,
      maxOutputTokens: 256,
    },
  });

  return parseCategoryPreferences(response.text ?? "");
}
