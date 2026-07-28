import "server-only";

import { GoogleGenAI, Type, type Schema } from "@google/genai";

import { parsePlaceNames } from "@/lib/places/place-extractor";

// Ariel picked Flash-Lite for this: the task is a short, cheap NER pass on one
// sentence, latency sits in front of the user typing a prompt, and Google AI
// Studio's free tier covers it without a credit card.
const MODEL = "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = [
  "You extract place names from a walker's free-text description of where they want to go.",
  "Return the places in the order the user mentioned them.",
  "Keep the user's own wording (for example 'Habima Square', 'the Jaffa port').",
  "Drop leading articles, and shorten a vague description to a searchable phrase",
  "(for example 'a good market' becomes 'market').",
  "Ignore anything that is not a place: durations, pace, moods, and general chatter.",
  "If the text names no places at all, return an empty list.",
].join(" ");

const PLACES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Place, venue, or landmark names extracted from the text.",
    },
  },
  required: ["places"],
};

/**
 * Ask Gemini Flash-Lite to pull the named places out of a free-text prompt.
 * Uses JSON mode with a response schema so the answer arrives as structured
 * JSON instead of prose we would have to regex.
 */
export async function extractPlaceNames(prompt: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
  }

  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: PLACES_SCHEMA,
      maxOutputTokens: 512,
      // Extraction is trivial for this model, and thinking tokens count
      // against `maxOutputTokens` — leave the whole budget for the answer.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // JSON mode makes `text` a JSON document; `parsePlaceNames` handles the
  // string, and also copes with a blocked or empty response.
  return parsePlaceNames(response.text ?? "");
}
