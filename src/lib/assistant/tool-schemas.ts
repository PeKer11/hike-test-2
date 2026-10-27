import { z } from "zod";

/**
 * Argument shapes for every tool the model can call. The bounds are hard sanity limits; the clamps inside
 * the tools stay. An unknown key, a wrong type or an absurd size makes the whole call fail with a short error.
 */
const id = z.string().min(1).max(40);
const clock = z.string().min(3).max(8);
const KINDS = ["food", "nature", "park", "museum", "landmark", "viewpoint", "religious", "shopping", "entertainment", "other"] as const;
const hoursAhead = z.number().min(0).max(240);
const walkMin = z.number().min(0).max(1440);

/** The furthest find_nearby searches, whatever the model or a stored radius asks for. */
export const MAX_NEARBY_RADIUS_M = 10_000;

export const ASSISTANT_TOOL_ARGS = {
  search_place: z.object({ query: z.string().min(1).max(200) }).strict(),
  find_nearby: z
    .object({
      category: z.enum(KINDS),
      around: id.optional(),
      radius_m: z.number().min(100).max(MAX_NEARBY_RADIUS_M).optional(),
      count: z.number().min(1).max(20).optional(),
      spread: z.boolean().optional(),
    })
    .strict(),
  set_stop_plan: z
    .object({
      stops: z
        .array(
          z
            .object({
              id,
              dwell_min: z.number().min(0).max(1440).optional(),
              pace: z.enum(["brisk", "normal", "stroll"]).optional(),
              pace_min_per_km: z.number().min(0).max(60).optional(),
              arrive_after: clock.optional(),
              arrive_before: clock.optional(),
            })
            .strict(),
        )
        .max(20)
        .optional(),
      clear_ids: z.array(id).max(20).optional(),
    })
    .strict(),
  set_stop_order: z
    .object({
      first: id.optional(),
      last: id.optional(),
      end_at: id.optional(),
      before: z.array(z.object({ a: id, b: id }).strict()).max(20).optional(),
      clear: z.boolean().optional(),
    })
    .strict(),
  set_breaks: z
    .object({
      rest_min: z.number().min(0).max(240).optional(),
      rest_every_min: walkMin.optional(),
      rest_every_km: z.number().min(0).max(100).optional(),
      meals: z.array(z.object({ from: clock, to: clock, minutes: z.number().min(0).max(480) }).strict()).max(6).optional(),
      clear: z.boolean().optional(),
    })
    .strict(),
  set_clock: z
    .object({
      start_time: clock.optional(),
      start_in_hours: hoursAhead.optional(),
      end_by: clock.optional(),
      clear: z.boolean().optional(),
    })
    .strict(),
  set_transit: z.object({ back: z.boolean() }).strict(),
  set_start: z.object({ candidate_id: id }).strict(),
  set_walk_params: z
    .object({
      time_minutes: walkMin.optional(),
      radius_km: z.number().min(0).max(200).optional(),
      end_distance_km: z.number().min(0).max(200).optional(),
      max_walk_km: z.number().min(0).max(200).optional(),
      pace_min_per_km: z.number().min(0).max(60).optional(),
      no_repeat: z.boolean().optional(),
      avoid_streets: z.array(z.string().max(120)).max(20).optional(),
      via_streets: z.array(z.string().max(120)).max(10).optional(),
      stay_in_area: z.string().max(160).optional(),
      access: z.enum(["stroller", "wheelchair", "none"]).optional(),
      max_grade_pct: z.number().min(0).max(100).optional(),
      avoid_dangerous: z.boolean().optional(),
      // Unknown rule names are answered as `ignored` by the tool, so they are not rejected here.
      clear: z.array(z.string().max(40)).max(13).optional(),
    })
    .strict(),
  ask_limits: z.object({}).strict(),
  offer_choices: z.object({ options: z.array(z.string().max(80)).min(1).max(10) }).strict(),
  remember: z.object({ fact: z.string().max(300) }).strict(),
  estimate_walk: z.object({ stop_ids: z.array(id).max(20), ordered: z.boolean().optional() }).strict(),
  check_weather: z.object({ start_in_hours: hoursAhead.optional(), duration_minutes: walkMin.optional() }).strict(),
  check_safety: z.object({ start_in_hours: hoursAhead.optional(), duration_minutes: walkMin.optional() }).strict(),
  check_nature_hazards: z.object({ start_in_hours: hoursAhead.optional() }).strict(),
  recall_walks: z.object({ limit: z.number().min(1).max(10).optional(), contains: z.string().max(120).optional() }).strict(),
  find_clean_walk: z.object({ count: z.number().min(1).max(12), must_ids: z.array(id).max(12).optional() }).strict(),
  build_walk: z.object({ stop_ids: z.array(id).max(20), ordered: z.boolean().optional() }).strict(),
} as const;

export const WALK_TOOL_ARGS = {
  remember: z.object({ fact: z.string().max(300) }).strict(),
  find_places: z
    .object({
      query: z.string().max(200).optional(),
      category: z.enum(KINDS).optional(),
      radius_m: z.number().min(100).max(3000).optional(),
    })
    .strict(),
  propose_add_stop: z.object({ place_id: z.string().min(1).max(20) }).strict(),
  propose_skip_stop: z.object({ stop_number: z.number().int().min(1).max(50) }).strict(),
  propose_head_back: z.object({}).strict(),
} as const;

/** Strict-mode tool schemas make a model send `null` for a field it leaves out. */
export const dropNulls = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));

export type ParsedToolArgs = { ok: true; args: Record<string, unknown> } | { ok: false; error: string };

export function parseToolArgs(schemas: Record<string, z.ZodType>, name: string, raw: string): ParsedToolArgs {
  const schema = schemas[name];
  if (!schema) return { ok: false, error: "unknown tool" };
  if (raw.length > 8_000) return { ok: false, error: "bad arguments" };
  let json: unknown;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { ok: false, error: "bad arguments" };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return { ok: false, error: "bad arguments" };
  const parsed = schema.safeParse(dropNulls(json as Record<string, unknown>));
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, error: `bad arguments: ${issues.join("; ")}` };
  }
  return { ok: true, args: parsed.data as Record<string, unknown> };
}
