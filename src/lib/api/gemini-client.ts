import "server-only";

import { GoogleGenAI, Type, type Schema } from "@google/genai";

import {
  parsePlaceNames,
  PLACE_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/places/place-extractor";

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
      systemInstruction: PLACE_EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: PLACES_SCHEMA,
      maxOutputTokens: 512,
      // `thinkingConfig: { thinkingBudget: 0 }` was tried to reserve the full
      // output budget for the answer, but gemini-3.5-flash-lite rejects that
      // field with a 400 (works fine on 2.5-series models) — omitted.
    },
  });

  // JSON mode makes `text` a JSON document; `parsePlaceNames` handles the
  // string, and also copes with a blocked or empty response.
  return parsePlaceNames(response.text ?? "");
}
