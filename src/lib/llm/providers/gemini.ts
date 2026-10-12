import { GoogleGenAI } from "@google/genai";

import type { ProviderCall } from "../types";

function apiKeyOrThrow(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
  }
  return apiKey;
}

export const callGemini: ProviderCall = async (req) => {
  const client = new GoogleGenAI({ apiKey: apiKeyOrThrow() });

  const response = await client.models.generateContent({
    model: req.model,
    contents: req.user,
    config: {
      systemInstruction: req.system,
      responseMimeType: "application/json",
      // Native schema when the task has one; otherwise the JSON Schema form.
      ...(req.geminiSchema
        ? { responseSchema: req.geminiSchema }
        : { responseJsonSchema: req.jsonSchema }),
      maxOutputTokens: req.maxOutputTokens,
      // Per-request timeout: the old wrapper had none, so one hung request hung.
      httpOptions: { timeout: req.timeoutMs },
      abortSignal: req.signal,
      // `thinkingConfig: { thinkingBudget: 0 }` was tried to reserve the full
      // output budget for the answer, but gemini-3.5-flash-lite rejects that
      // field with a 400 (works fine on 2.5-series models) — omitted.
    },
  });

  // JSON mode makes `text` a JSON document; the task parser copes with a
  // blocked or empty response.
  return {
    text: response.text ?? "",
    inTok: response.usageMetadata?.promptTokenCount ?? 0,
    outTok: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
};
