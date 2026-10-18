import type { SupabaseClient } from "@supabase/supabase-js";

import {
  alreadyFolded,
  applyAnswer,
  applyWalk,
  sanitizeHabitRow,
  walkKeyOf,
  type AnswerEvent,
  type HabitRow,
  type HabitState,
  type WalkObservation,
} from "@/lib/preferences/habit-model";

/**
 * Storage for `routine_habits` (migration 20261012100000). Consent is enforced
 * by the callers (`planWalkEndWrites` returns null without learning consent) and
 * again by RLS (own rows only). Wall-clock rows only in v1. Numbers only: no
 * coordinates, no place names. Never sent to an LLM.
 */

export const ROUTINE_HABITS_TABLE = "routine_habits";

/** What a finished walk contributes to the habit model. */
export interface HabitWalkEnd {
  /** Used for the retry guard (`walkKeyOf`). */
  startedAtMs: number;
  observations: WalkObservation[];
  answers: AnswerEvent[];
}

interface DbRow {
  habit: string;
  clock: string;
  day_type: string;
  succ: number[];
  opp: number[];
  day_masks: number[];
  mask_day: number;
  timing: unknown;
  decline_streak: number;
  muted_until: string | null;
  last_asked_hour: string | null;
  last_walk_key: number;
}

function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function rowFromDb(raw: unknown): HabitRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as DbRow;
  if (r.clock !== "wall") return null;
  return sanitizeHabitRow({
    habit: r.habit,
    dayType: r.day_type,
    succ: r.succ,
    opp: r.opp,
    dayMasks: r.day_masks,
    maskDay: r.mask_day,
    timing: r.timing,
    declineStreak: r.decline_streak,
    mutedUntilMs: ms(r.muted_until),
    lastAskedMs: ms(r.last_asked_hour),
    lastWalkKey: r.last_walk_key,
  });
}

export function rowToDb(userId: string, row: HabitRow) {
  return {
    user_id: userId,
    habit: row.habit,
    clock: "wall",
    day_type: row.dayType,
    succ: row.succ,
    opp: row.opp,
    day_masks: row.dayMasks,
    mask_day: row.maskDay,
    timing: row.timing,
    decline_streak: row.declineStreak,
    muted_until: row.mutedUntilMs === null ? null : new Date(row.mutedUntilMs).toISOString(),
    last_asked_hour: row.lastAskedMs === null ? null : new Date(row.lastAskedMs).toISOString(),
    last_walk_key: row.lastWalkKey,
    updated_at: new Date().toISOString(),
  };
}

/** Validates an untrusted array (a stored or wire payload) into rows; bad rows are dropped. */
export function sanitizeHabitRows(raw: unknown): HabitState {
  if (!Array.isArray(raw)) return [];
  const out: HabitState = [];
  for (const r of raw) {
    const row = sanitizeHabitRow(r);
    if (row) out.push(row);
  }
  return out;
}

/** Null on failure, so a write never starts from a state it could not read. */
async function readRows(client: SupabaseClient, userId: string): Promise<HabitState | null> {
  try {
    const { data, error } = await client
      .from(ROUTINE_HABITS_TABLE)
      .select("habit, clock, day_type, succ, opp, day_masks, mask_day, timing, decline_streak, muted_until, last_asked_hour, last_walk_key")
      .eq("user_id", userId);
    if (error || !Array.isArray(data)) return null;
    return data.map(rowFromDb).filter((r): r is HabitRow => r !== null);
  } catch {
    return null;
  }
}

/** The walker's habit rows; empty on any failure (a missing table must not break a walk). */
export async function loadRoutineHabits(client: SupabaseClient, userId: string): Promise<HabitState> {
  return (await readRows(client, userId)) ?? [];
}

/**
 * The state after a walk: decay once and add the observation, then apply the
 * answers. A walk already folded in (retry) changes nothing, answers included.
 */
export function foldHabitWalk(state: HabitState, walk: HabitWalkEnd): HabitState {
  const walkKey = walkKeyOf(walk.startedAtMs);
  let next = state;
  const done = new Set<string>();
  for (const obs of walk.observations) {
    if (done.has(obs.habit) || alreadyFolded(next, obs.habit, walkKey)) continue;
    done.add(obs.habit);
    next = applyWalk(next, obs, walkKey);
    for (const a of walk.answers) if (a.habit === obs.habit) next = applyAnswer(next, a);
  }
  return next;
}

/**
 * Reads the current rows, folds the walk in and upserts the rows that changed.
 * The caller has already checked consent; returns false on any failure.
 */
export async function persistRoutineHabits(
  client: SupabaseClient,
  userId: string,
  walk: HabitWalkEnd,
): Promise<boolean> {
  if (walk.observations.length === 0) return true;
  const before = await readRows(client, userId);
  if (before === null) return false;
  const after = foldHabitWalk(before, walk);
  const changed = after.filter((r) => !before.includes(r));
  if (changed.length === 0) return true;
  const { error } = await client
    .from(ROUTINE_HABITS_TABLE)
    .upsert(changed.map((r) => rowToDb(userId, r)), { onConflict: "user_id,habit,clock,day_type" });
  return !error;
}
