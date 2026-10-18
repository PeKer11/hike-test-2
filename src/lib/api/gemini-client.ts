import "server-only";

import { Type, type Schema } from "@google/genai";

import { runLlm } from "@/lib/llm/llm-client";
import {
  canonicalNameSchema,
  factsSchema,
  placesSchema,
  preferencesSchema,
} from "@/lib/llm/schemas";
import type { LlmCallContext, LlmTask } from "@/lib/llm/types";
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

// This file is now a thin wrapper over `src/lib/llm/` (provider seam, retry,
// per-request timeout, optional budget guard). The model and provider come from
// env (`LLM_PROVIDER`, `LLM_MODEL`); the default is a *pinned* Gemini Flash-Lite
// id, never the "-latest" alias, which silently moved to a pricier model and
// started rejecting `thinkingConfig`. See `src/lib/llm/config.ts`.
// The four tasks below keep their Gemini-native response schemas, prompts and
// parsers unchanged, so the Gemini request is the same as before.

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
export function buildExtractPlacesTask(
  prompt: string,
  facts: StoredFact[] = [],
): LlmTask<PlaceExtraction> {
  return {
    name: "extract-places",
    system: PLACE_EXTRACTION_SYSTEM_PROMPT,
    user: buildPromptWithFacts(prompt, facts),
    schema: placesSchema,
    geminiSchema: PLACES_SCHEMA,
    // JSON mode makes the reply a JSON document; `parsePlaceExtraction`
    // handles the string, and also copes with a blocked or empty response.
    parse: parsePlaceExtraction,
    maxOutputTokens: 512,
    tier: 1,
  };
}

export async function extractPlaceNames(
  prompt: string,
  facts: StoredFact[] = [],
  ctx: LlmCallContext,
): Promise<PlaceExtraction> {
  const { data } = await runLlm(buildExtractPlacesTask(prompt, facts), ctx);
  return data;
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
  ctx: LlmCallContext,
): Promise<string | null> {
  const { data } = await runLlm(
    {
      name: "canonical-name",
      system: CANONICAL_NAME_SYSTEM_PROMPT,
      user: [`Term: ${name}`, `Area: ${contextLocation ?? "not given"}`].join("\n"),
      schema: canonicalNameSchema,
      geminiSchema: CANONICAL_NAME_SCHEMA,
      parse: parseCanonicalName,
      maxOutputTokens: 128,
      tier: 1,
    },
    ctx,
  );
  return data;
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
  ctx: LlmCallContext,
): Promise<CategoryPreference[]> {
  const { data } = await runLlm(
    {
      name: "preferences",
      system: PREFERENCE_EXTRACTION_SYSTEM_PROMPT,
      user: text,
      schema: preferencesSchema,
      geminiSchema: PREFERENCES_SCHEMA,
      parse: parseCategoryPreferences,
      maxOutputTokens: 256,
      tier: 1,
    },
    ctx,
  );
  return data;
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
export function buildFactsTask(
  text: string,
  knownFacts: StoredFact[] = [],
): LlmTask<ExtractedFact[]> {
  const known = buildKnownFactsBlock(knownFacts);
  return {
    name: "facts",
    system: FACT_EXTRACTION_SYSTEM_PROMPT,
    // Per-user text belongs in the user contents; the system instruction
    // stays a module constant, which is the half worth caching across walkers.
    user: known ? `${known}Text:\n${text}` : text,
    schema: factsSchema,
    geminiSchema: FACTS_SCHEMA,
    parse: parseStandingFacts,
    maxOutputTokens: 256,
    tier: 1,
  };
}

export async function extractStandingFacts(
  text: string,
  knownFacts: StoredFact[] = [],
  ctx: LlmCallContext,
): Promise<ExtractedFact[]> {
  const { data } = await runLlm(buildFactsTask(text, knownFacts), ctx);
  return data;
}
