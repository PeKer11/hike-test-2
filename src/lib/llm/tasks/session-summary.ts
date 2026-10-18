import { z } from "zod";

import { PLANNER_SUMMARY } from "../prompts/planner-v1";
import { WALK_END_MAX_CHARS } from "../fit";
import { isOsmPoiKey } from "../walk-end-whitelist";
import type { LlmTask } from "../types";

const bin = z.string().regex(/^([01]\d|2[0-3]):(00|30)$/);

export const sessionSummarySchema = z.object({
  schemaVersion: z.literal(1),
  preferences: z
    .array(
      z.object({
        item: z.string().max(40),
        sentiment: z.enum(["like", "dislike"]),
        evidence: z.enum(["explicit", "behavior"]),
        confidence: z.number().min(0).max(0.9),
      }),
    )
    .max(6),
  antiPatterns: z
    .array(
      z.object({
        code: z.enum([
          "too-long", "too-short", "too-many-stops", "detour-declined",
          "asked-too-often", "wrong-pace-estimate", "heat-exposure",
          "closed-place", "crowded", "stairs-or-steep", "other",
        ]),
        note: z.string().max(80),
      }),
    )
    .max(4),
  pace: z
    .object({
      vsPlan: z.enum(["slower", "as-planned", "faster", "unknown"]),
      note: z.string().max(80).nullable(),
    })
    .nullable(),
  routine: z
    .array(
      z.object({
        habit: z.enum(["eat", "coffee", "rest"]),
        clock: z.enum(["wall", "walk"]),
        bin,
        evidence: z.enum(["visit", "said"]),
      }),
    )
    .max(3),
  places: z
    .array(
      z.object({
        poiKey: z.string().max(80),
        sentiment: z.enum(["liked", "disliked", "skipped"]),
      }),
    )
    .max(8),
  openQuestions: z
    .array(
      z.object({
        topic: z.string().max(30),
        question: z.string().max(90),
        answers: z.array(z.string().max(30)).min(2).max(3),
      }),
    )
    .max(2),
  dropped: z
    .array(
      z.enum([
        "location", "person-name", "contact", "health", "sensitive-trait",
        "unconsented", "injection",
      ]),
    )
    .max(7),
  injectionDetected: z.boolean(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const EMPTY_SESSION_SUMMARY: SessionSummary = {
  schemaVersion: 1,
  preferences: [],
  antiPatterns: [],
  pace: null,
  routine: [],
  places: [],
  openQuestions: [],
  dropped: [],
  injectionDetected: false,
};

export const MAX_SUMMARY_CHARS = 1_200;

// A 5+ digit run (phone / id) or a street-style address in any free text.
const DIGIT_RUN = /\d{5,}|\d[\d\s-]{6,}\d/;
// "12 Herzl St", "Herzl St 12". A bare ordinal ("1st", "3rd") is not an address:
// a street word needs whitespace between it and the number.
const ADDRESS = /\d+\s+(st|street|ave|avenue|road|rd)\b|\d+\s+(\S+\s+){1,2}(st|street|ave|avenue|road|rd)\b|(רח׳|רחוב|שדרות)\s*\S+\s*\d+|\S+\s+\d+\s*(רח׳|רחוב)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// A word followed by a 1-3 digit number ("Herzl 12", "הרצל 12"): a house number
// unless the number is a time, a decimal, or has a unit ("30 min", "2 stops").
const NAME_NUMBER =
  /(?:^|\s)[\p{L}]{2,}\s+\d{1,3}(?![\d:.,%\p{L}]|\s*(?:min|mins|minutes?|km|m|h|hrs?|hours?|stops?|places?|times?|x|דק|דקות|ק"מ|שעות|עצירות|מקומות|פעמים)(?![\p{L}]))/iu;
/** `preferences[].item`: a category or a short lowercase / Hebrew phrase, never digits or punctuation. */
const ITEM = /^[a-z֐-׿]+(?:[ -][a-z֐-׿]+){0,3}$/;

function unsafeText(t: string): boolean {
  return DIGIT_RUN.test(t) || ADDRESS.test(t) || EMAIL.test(t) || NAME_NUMBER.test(t);
}

function freeTexts(s: SessionSummary): string[] {
  return [
    ...s.preferences.map((p) => p.item),
    ...s.antiPatterns.map((a) => a.note),
    ...(s.pace?.note ? [s.pace.note] : []),
    ...s.openQuestions.flatMap((q) => [q.topic, q.question, ...q.answers]),
  ];
}

export interface SummaryContext {
  /** The walker's consent as sent in the CONSENT line. */
  learn: boolean;
  routine: boolean;
  /** poiKeys that were in the input; the model may only refer to these. */
  poiKeys: readonly string[];
}

/** Validates the model's answer. Throws (a schema failure) on anything unsafe to store. */
export function parseSessionSummary(text: string, ctx: SummaryContext): SessionSummary {
  const parsed = sessionSummarySchema.parse(JSON.parse(text));
  if (!ctx.learn) return EMPTY_SESSION_SUMMARY;
  // An injection attempt means nothing from this walk is stored.
  if (parsed.injectionDetected) {
    return { ...EMPTY_SESSION_SUMMARY, dropped: ["injection"], injectionDetected: true };
  }
  const allowed = new Set(ctx.poiKeys);
  if (parsed.places.some((p) => !isOsmPoiKey(p.poiKey) || !allowed.has(p.poiKey))) {
    throw new Error("session-summary: poiKey not in input");
  }
  if (!ctx.routine && parsed.routine.length > 0) {
    throw new Error("session-summary: routine returned without consent");
  }
  if (parsed.preferences.some((p) => !ITEM.test(p.item))) {
    throw new Error("session-summary: preference item is not a short plain phrase");
  }
  if (freeTexts(parsed).some(unsafeText)) {
    throw new Error("session-summary: phone, address or email in a note");
  }
  if (JSON.stringify(parsed).length > MAX_SUMMARY_CHARS) {
    throw new Error("session-summary: too long");
  }
  return parsed;
}

export interface SessionSummaryInput {
  /** Numeric / enum walk-end facts only; never free text from the walker except `feedback`. */
  walkEnd: Record<string, unknown>;
  feedback?: string;
  /** Existing memory notes, so the model skips what is already known. */
  memory?: string;
  uiLang: "en" | "he";
  consent: { learn: boolean; routine: boolean };
  poiKeys: readonly string[];
}

/** Tier 2 (fast model). The caller must not call this at all when learning consent is not granted. */
export function buildSessionSummaryTask(input: SessionSummaryInput): LlmTask<SessionSummary> {
  const user = [
    "TASK: session-summary",
    `UI_LANG: ${input.uiLang}`,
    `CONSENT: learn=${input.consent.learn ? "on" : "off"} routine=${input.consent.routine ? "on" : "off"}`,
  ].join("\n");
  return {
    name: "session-summary",
    system: PLANNER_SUMMARY,
    user,
    untrusted: [
      { source: "walk_end", text: JSON.stringify(input.walkEnd), maxChars: WALK_END_MAX_CHARS },
      ...(input.feedback ? [{ source: "feedback", text: input.feedback }] : []),
      ...(input.memory ? [{ source: "memory", text: input.memory }] : []),
    ],
    schema: sessionSummarySchema,
    parse: (text) =>
      parseSessionSummary(text, { ...input.consent, poiKeys: input.poiKeys }),
    maxOutputTokens: 400,
    tier: 2,
  };
}
