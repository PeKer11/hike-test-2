import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { parsePlaceNames } from "@/lib/places/place-extractor";

// Ariel picked Haiku for this: the task is a short, cheap NER pass on one
// sentence, and latency sits in front of the user typing a prompt.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = [
  "You extract place names from a walker's free-text description of where they want to go.",
  "Return the places in the order the user mentioned them.",
  "Keep the user's own wording (for example 'Habima Square', 'the Jaffa port').",
  "Drop leading articles, and shorten a vague description to a searchable phrase",
  "(for example 'a good market' becomes 'market').",
  "Ignore anything that is not a place: durations, pace, moods, and general chatter.",
  "If the text names no places at all, return an empty list.",
].join(" ");

const RECORD_PLACES_TOOL: Anthropic.Tool = {
  name: "record_places",
  description:
    "Record the list of places the user wants to visit, in the order they mentioned them.",
  input_schema: {
    type: "object",
    properties: {
      places: {
        type: "array",
        items: { type: "string" },
        description: "Place, venue, or landmark names extracted from the text.",
      },
    },
    required: ["places"],
    additionalProperties: false,
  },
};

/**
 * Ask Claude Haiku to pull the named places out of a free-text prompt.
 * Uses forced tool use so the answer arrives as structured JSON instead of
 * prose we would have to regex.
 */
export async function extractPlaceNames(prompt: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [RECORD_PLACES_TOOL],
    tool_choice: { type: "tool", name: RECORD_PLACES_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === RECORD_PLACES_TOOL.name) {
      return parsePlaceNames(block.input);
    }
  }

  // Forced tool use should make this unreachable, but a text-only reply is
  // still worth one defensive parse before giving up.
  for (const block of message.content) {
    if (block.type === "text") {
      const names = parsePlaceNames(block.text);
      if (names.length > 0) {
        return names;
      }
    }
  }

  return [];
}
