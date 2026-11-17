import { z } from "zod";

import { TASTE_SUMMARY } from "../prompts/taste-v1";
import { cleanUntrustedText } from "../sanitize";
import type { LlmTask } from "../types";
import { unsafeText } from "./session-summary";

export const TASTE_TAGS = [
  "nature", "views", "food", "coffee", "history", "museums", "markets", "parks", "quiet", "urban",
  "beach", "religious", "shopping", "family", "long_walks", "short_walks", "loops", "night",
] as const;
export type TasteTag = (typeof TASTE_TAGS)[number];

export const tasteSummarySchema = z.object({
  schemaVersion: z.literal(1),
  bullets: z.array(z.string().max(90)).max(3),
  tags: z.array(z.enum(TASTE_TAGS)).max(6),
  areas: z.array(z.string().max(40)).max(3),
  injectionDetected: z.boolean(),
});
export type TasteSummary = z.infer<typeof tasteSummarySchema>;

export const EMPTY_TASTE_SUMMARY: TasteSummary = { schemaVersion: 1, bullets: [], tags: [], areas: [], injectionDetected: false };

/** One finished walk, as the taste summary may see it. */
export interface TasteWalk {
  areaLabel: string | null;
  distanceM: number | null;
  totalMin: number | null;
  stops: { category: string; name?: string | null; source?: string | null; placeId?: string | null }[];
}

const CATEGORY = /^[a-z_]{1,24}$/;
const MAX_WALKS = 30;
const MAX_STOPS = 12;

/**
 * What the model may read. Categories for every stop; a stop NAME only when the stop is known to come from OSM (open
 * data). A Google stop, or a stop of unknown origin, is its category only: Google place names never leave the app
 * (Maps Platform terms). No coordinates, no dates, no times of day, no titles.
 */
export function buildTasteInput(walks: readonly TasteWalk[]): { walks: unknown[]; areas: string[] } {
  const areas = new Set<string>();
  const out = walks.slice(0, MAX_WALKS).map((w) => {
    const area = w.areaLabel ? cleanUntrustedText(w.areaLabel, 40) : null;
    if (area) areas.add(area);
    return {
      area,
      km: w.distanceM === null ? null : Math.round(w.distanceM / 100) / 10,
      min: w.totalMin === null ? null : Math.round(w.totalMin),
      stops: w.stops.slice(0, MAX_STOPS).map((s) => {
        const category = CATEGORY.test(s.category) ? s.category : "other";
        const osm = s.source === "osm" && !s.placeId && s.name;
        return osm ? { category, name: cleanUntrustedText(s.name as string, 60) } : { category };
      }),
    };
  });
  return { walks: out, areas: [...areas] };
}

/** Validates the model's answer. Throws on anything unsafe to store; areas the input did not contain are dropped. */
export function parseTasteSummary(text: string, allowedAreas: readonly string[]): TasteSummary {
  const parsed = tasteSummarySchema.parse(JSON.parse(text));
  if (parsed.injectionDetected) return { ...EMPTY_TASTE_SUMMARY, injectionDetected: true };
  if (parsed.bullets.some(unsafeText)) throw new Error("taste-summary: phone, address or email in a bullet");
  const allowed = new Set(allowedAreas);
  return {
    ...parsed,
    tags: [...new Set(parsed.tags)],
    areas: parsed.areas.filter((a) => allowed.has(a)),
  };
}

export interface TasteSummaryInput {
  walks: readonly TasteWalk[];
  uiLang: "en" | "he";
}

/** Tier 1 (cheap model). The caller must not call this at all without learning consent. */
export function buildTasteSummaryTask(input: TasteSummaryInput): LlmTask<TasteSummary> {
  const { walks, areas } = buildTasteInput(input.walks);
  return {
    name: "taste-summary",
    system: TASTE_SUMMARY,
    user: [`TASK: taste-summary`, `UI_LANG: ${input.uiLang}`, `ALLOWED_TAGS: ${TASTE_TAGS.join(", ")}`].join("\n"),
    untrusted: [{ source: "walks", text: JSON.stringify({ walks }), maxChars: 8_000 }],
    schema: tasteSummarySchema,
    parse: (text) => parseTasteSummary(text, areas),
    maxOutputTokens: 400,
    tier: 1,
  };
}

/** At most one summary a week, unless three or more walks were finished since the last one. */
export const TASTE_COOLDOWN_MS = 7 * 24 * 3600_000;
export const TASTE_MIN_NEW_WALKS = 3;
export const TASTE_MIN_WALKS = 3;

export function tasteCooldown(args: { lastCreatedAtMs: number | null; newWalksSince: number; nowMs: number }): { allowed: boolean; nextAvailableAtMs: number | null } {
  if (args.lastCreatedAtMs === null) return { allowed: true, nextAvailableAtMs: null };
  const next = args.lastCreatedAtMs + TASTE_COOLDOWN_MS;
  if (args.nowMs >= next || args.newWalksSince >= TASTE_MIN_NEW_WALKS) return { allowed: true, nextAvailableAtMs: null };
  return { allowed: false, nextAvailableAtMs: next };
}
