import { z } from "zod";

import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";

// Provider-neutral shapes of the four existing answers. Gemini keeps its own
// native `Schema` constants in gemini-client.ts; these feed Anthropic / OpenAI
// as JSON Schema. The parse* functions remain the semantic validators, so a
// looser or stricter schema here never changes what the app accepts.

const category = z.enum(ATTRACTION_CATEGORIES as [string, ...string[]]);

export const placesSchema = z.object({
  places: z.array(z.string()),
  contextLocation: z.string().nullable().optional(),
  durationMinutes: z.number().int().nullable().optional(),
  categoryNeeds: z.array(category).optional(),
  stopCount: z.number().int().nullable().optional(),
  notableOnly: z.boolean().nullable().optional(),
  maxEndDistanceKm: z.number().nullable().optional(),
  searchRadiusKm: z.number().nullable().optional(),
});

export const canonicalNameSchema = z.object({
  canonicalName: z.string().nullable().optional(),
});

export const preferencesSchema = z.object({
  preferences: z.array(
    z.object({ category, sentiment: z.enum(["like", "dislike"]) }),
  ),
});

export const factsSchema = z.object({
  facts: z.array(
    z.object({
      text: z.string(),
      importance: z.number().int(),
      replaces: z.string().nullable().optional(),
    }),
  ),
});
