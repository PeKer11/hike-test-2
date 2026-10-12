import type { SupabaseClient } from "@supabase/supabase-js";

import type { AttractionCategory } from "@/lib/types";
import type { AskPriors, QuestionKind } from "@/lib/walk/companion/companion-types";
import type { WalkEnvironment } from "@/lib/types/discovery";

/**
 * Companion memory: event-sourced numeric signals only. No LLM summaries, no raw
 * tracks, no free text. Everything is gated by the walker's learning consent
 * (`learnPreferences`): with consent off, `planWalkEndWrites` returns null and
 * `persistWalkEnd` makes zero client calls.
 *
 * The session clock is `profiles.session_count`, as `category_preferences` uses.
 */

// --- Pace per environment ---------------------------------------------------
export interface EnvPace {
  minPerKm: number;
  n: number;
}
export type PaceByEnv = Partial<Record<WalkEnvironment, EnvPace>>;

export const PACE_EWMA_ALPHA = 0.3;
/** Walks with less active walking than this say nothing about pace. */
export const MIN_ACTIVE_MINUTES = 10;
const MIN_PLAUSIBLE_PACE = 3;
const MAX_PLAUSIBLE_PACE = 60;

export interface EnvPaceSample {
  env: WalkEnvironment;
  /** Active walking minutes (dwell excluded, as `PaceAdvisor` does). */
  activeMinutes: number;
  /** Active-walking pace, min/km. */
  minPerKm: number;
}

export function updatePaceByEnv(prev: PaceByEnv, samples: EnvPaceSample[]): PaceByEnv {
  const next: PaceByEnv = { ...prev };
  for (const s of samples) {
    if (
      !(s.activeMinutes >= MIN_ACTIVE_MINUTES) ||
      !Number.isFinite(s.minPerKm) ||
      s.minPerKm < MIN_PLAUSIBLE_PACE ||
      s.minPerKm > MAX_PLAUSIBLE_PACE
    ) {
      continue;
    }
    const old = next[s.env];
    next[s.env] = old
      ? {
          minPerKm: PACE_EWMA_ALPHA * s.minPerKm + (1 - PACE_EWMA_ALPHA) * old.minPerKm,
          n: old.n + 1,
        }
      : { minPerKm: s.minPerKm, n: 1 };
  }
  return next;
}

/** n-weighted blend across environments: the `walking_pace_min_per_km` fallback. */
/** Validates a stored `pace_by_env` value on read: only finite paces in 3-60 min/km with n >= 1 survive. */
export function sanitizePaceByEnv(raw: unknown): PaceByEnv {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: PaceByEnv = {};
  for (const [env, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const { minPerKm, n } = v as { minPerKm?: unknown; n?: unknown };
    if (
      typeof minPerKm === "number" &&
      Number.isFinite(minPerKm) &&
      minPerKm >= MIN_PLAUSIBLE_PACE &&
      minPerKm <= MAX_PLAUSIBLE_PACE &&
      typeof n === "number" &&
      Number.isFinite(n) &&
      n >= 1
    ) {
      out[env as WalkEnvironment] = { minPerKm, n };
    }
  }
  return out;
}

export function blendedPace(paceByEnv: PaceByEnv): number | null {
  let total = 0;
  let weight = 0;
  for (const p of Object.values(paceByEnv)) {
    if (!p) continue;
    total += p.minPerKm * p.n;
    weight += p.n;
  }
  return weight > 0 ? total / weight : null;
}

// --- Place interactions -----------------------------------------------------
export type InteractionKind =
  | "visited"
  | "dismissed"
  | "declined_detour"
  | "added"
  | "offered";

export interface InteractionRow {
  poi_key: string;
  kind: InteractionKind;
  count: number;
  last_session: number;
}

export const VISITED_SUPPRESS_SESSIONS = 180;
export const DISMISSED_SUPPRESS_SESSIONS = 30;
export const DETOUR_BLOCK_SESSIONS = 20;
export const DETOUR_DECLINES_TO_BLOCK = 2;

export interface Suppression {
  /** poi keys not to announce again. */
  suppressedKeys: Set<string>;
  /** No detour offers at all right now. */
  detourOffersBlocked: boolean;
}

/** `notableKeys`: a visited place that is notable may be announced again. */
export function interactionSuppression(
  rows: InteractionRow[],
  currentSession: number,
  notableKeys: ReadonlySet<string> = new Set(),
): Suppression {
  const suppressedKeys = new Set<string>();
  let declines = 0;
  for (const r of rows) {
    const age = currentSession - r.last_session;
    if (r.kind === "visited" && age < VISITED_SUPPRESS_SESSIONS && !notableKeys.has(r.poi_key)) {
      suppressedKeys.add(r.poi_key);
    } else if (r.kind === "dismissed" && age < DISMISSED_SUPPRESS_SESSIONS) {
      suppressedKeys.add(r.poi_key);
    } else if (r.kind === "declined_detour" && age < DETOUR_BLOCK_SESSIONS) {
      declines += r.count;
    }
  }
  return {
    suppressedKeys,
    detourOffersBlocked: declines >= DETOUR_DECLINES_TO_BLOCK,
  };
}

/** Upsert shape: bump the count and stamp the session. */
export function foldInteraction(
  existing: InteractionRow | undefined,
  poiKey: string,
  kind: InteractionKind,
  session: number,
): InteractionRow {
  return {
    poi_key: poiKey,
    kind,
    count: (existing?.count ?? 0) + 1,
    last_session: session,
  };
}

// --- Question stats ---------------------------------------------------------
export const MAX_QUESTIONS_PER_SUMMARY = 20;

export interface QuestionEntry {
  kind: QuestionKind;
  /** An answer id, or "ignored". */
  answer: string;
}

export function priorsFromSummaries(
  summaries: ReadonlyArray<{ questions: QuestionEntry[] }>,
): AskPriors {
  const priors: AskPriors = {};
  for (const s of summaries) {
    for (const q of s.questions) {
      const p = (priors[q.kind] ??= { asked: 0, answered: 0 });
      p.asked += 1;
      if (q.answer !== "ignored") p.answered += 1;
    }
  }
  return priors;
}

// --- Walk end: the consent-gated write plan ----------------------------------
export interface WalkEndInput {
  /** The walker's "Remember my preferences" setting. */
  learnPreferences: boolean;
  startedAtMs: number;
  /** City name only. Truncated; never coordinates. */
  areaLabel?: string | null;
  plannedMin: number;
  actualMin: number;
  distanceM: number;
  envMinutes: Partial<Record<WalkEnvironment, number>>;
  stopsPlanned: number;
  stopsVisited: number;
  questions: QuestionEntry[];
  collapseCount: number;
  paceSamples: EnvPaceSample[];
  interactions: Array<{ poiKey: string; kind: InteractionKind; category: AttractionCategory }>;
}

export interface WalkSummaryRow {
  started_hour: string;
  area_label: string | null;
  planned_min: number;
  actual_min: number;
  distance_m: number;
  env_minutes: Partial<Record<WalkEnvironment, number>>;
  stops_planned: number;
  stops_visited: number;
  questions: QuestionEntry[];
  collapse_count: number;
}

export interface WalkEndPlan {
  summary: WalkSummaryRow;
  interactions: Array<{ poiKey: string; kind: InteractionKind; category: AttractionCategory }>;
  paceSamples: EnvPaceSample[];
}

export function truncateToHour(ms: number): string {
  const safe = Number.isFinite(ms) ? ms : 0;
  return new Date(Math.floor(safe / 3_600_000) * 3_600_000).toISOString();
}

/** Round and clamp to a migration range; non-finite becomes the minimum. */
function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Null when consent is off: the caller writes nothing. */
export function planWalkEndWrites(input: WalkEndInput): WalkEndPlan | null {
  if (input.learnPreferences !== true) return null;
  const label = input.areaLabel?.trim().slice(0, 60) || null;
  return {
    summary: {
      started_hour: truncateToHour(input.startedAtMs),
      area_label: label,
      planned_min: clampInt(input.plannedMin, 0, 1440),
      actual_min: clampInt(input.actualMin, 0, 1440),
      distance_m: clampInt(input.distanceM, 0, 200000),
      env_minutes: input.envMinutes,
      stops_planned: clampInt(input.stopsPlanned, 0, 100),
      stops_visited: clampInt(input.stopsVisited, 0, 100),
      questions: input.questions.slice(-MAX_QUESTIONS_PER_SUMMARY),
      collapse_count: clampInt(input.collapseCount, 0, 1000),
    },
    interactions: input.interactions,
    paceSamples: input.paceSamples,
  };
}

// --- Store (RLS enforces own rows; the caller passes the session client) -----
export interface CompanionMemory {
  sessionCount: number;
  paceByEnv: PaceByEnv;
  calloutLevel: "quiet" | "normal" | "chatty" | null;
  uiLanguage: "en" | "he" | null;
  typicalWalkMinutes: number | null;
  interactions: InteractionRow[];
  priors: AskPriors;
}

export async function loadCompanionMemory(
  client: SupabaseClient,
  userId: string,
  learnPreferences: boolean,
): Promise<CompanionMemory | null> {
  if (!learnPreferences) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("session_count, pace_by_env, callout_level, ui_language, typical_walk_minutes")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  const { data: rows } = await client
    .from("place_interactions")
    .select("poi_key, kind, count, last_session")
    .eq("user_id", userId);
  const { data: sums } = await client
    .from("walk_summaries")
    .select("questions")
    .eq("user_id", userId)
    .order("started_hour", { ascending: false })
    .limit(20);
  const p = profile as Record<string, unknown>;
  return {
    sessionCount: Number(p.session_count) || 0,
    paceByEnv: sanitizePaceByEnv(p.pace_by_env),
    calloutLevel: (p.callout_level as CompanionMemory["calloutLevel"]) ?? null,
    uiLanguage: (p.ui_language as CompanionMemory["uiLanguage"]) ?? null,
    typicalWalkMinutes: (p.typical_walk_minutes as number | null) ?? null,
    interactions: (rows as InteractionRow[] | null) ?? [],
    priors: priorsFromSummaries(
      ((sums as Array<{ questions: QuestionEntry[] }> | null) ?? []).map((s) => ({
        questions: Array.isArray(s.questions) ? s.questions : [],
      })),
    ),
  };
}

/** Writes a walk's summary, interactions and pace. No client call at all without consent. */
export async function persistWalkEnd(
  client: SupabaseClient,
  userId: string,
  input: WalkEndInput,
  currentSession: number,
  prevPaceByEnv: PaceByEnv,
): Promise<boolean> {
  const plan = planWalkEndWrites(input);
  if (plan === null) return false;

  const ins = await client.from("walk_summaries").insert({ user_id: userId, ...plan.summary });
  if (ins.error) return false;

  if (plan.interactions.length > 0) {
    const keys = [...new Set(plan.interactions.map((i) => i.poiKey))];
    const { data: existing, error: readErr } = await client
      .from("place_interactions")
      .select("poi_key, kind, count, last_session")
      .eq("user_id", userId)
      .in("poi_key", keys);
    if (readErr) return false;
    const byId = new Map(
      ((existing as InteractionRow[] | null) ?? []).map((r) => [`${r.poi_key}|${r.kind}`, r]),
    );
    const folded = new Map<string, InteractionRow & { category: AttractionCategory }>();
    for (const i of plan.interactions) {
      const id = `${i.poiKey}|${i.kind}`;
      const prev = folded.get(id) ?? byId.get(id);
      folded.set(id, {
        ...foldInteraction(prev, i.poiKey, i.kind, currentSession),
        category: i.category,
      });
    }
    const up = await client.from("place_interactions").upsert(
      [...folded.values()].map((r) => ({
        user_id: userId,
        ...r,
        last_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,poi_key,kind" },
    );
    if (up.error) return false;
  }

  if (plan.paceSamples.length > 0) {
    const upd = await client
      .from("profiles")
      .update({ pace_by_env: updatePaceByEnv(prevPaceByEnv, plan.paceSamples) })
      .eq("id", userId);
    if (upd.error) return false;
  }
  return true;
}
