import type { SupabaseClient } from "@supabase/supabase-js";

import type { SavedWalk } from "./saved-walks";
import { withWalkClient } from "./walk-history";

export interface WalkRun {
  id: string;
  walkId: string;
  startedAt: string;
  finishedAt: string | null;
  minutes: number | null;
  distanceM: number | null;
}

export interface NewWalkRun {
  startedAt?: string;
  finishedAt?: string;
  minutes?: number;
  distanceM?: number;
}

/** A walk with its runs: one entry in the list, however many times it was walked. */
export interface WalkWithRuns {
  walk: SavedWalk;
  /** Newest first. */
  runs: WalkRun[];
  runCount: number;
  lastRunAt: string | null;
  /** Built (or bookmarked) but never walked. */
  isDraft: boolean;
}

interface Row {
  id: string;
  walk_id: string;
  started_at: string;
  finished_at: string | null;
  minutes: number | null;
  distance_m: number | null;
}

const COLUMNS = "id, walk_id, started_at, finished_at, minutes, distance_m";

const fromRow = (r: Row): WalkRun => ({
  id: r.id,
  walkId: r.walk_id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  minutes: r.minutes,
  distanceM: r.distance_m,
});

const clampInt = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : null;

/** Never-walked builds are drafts; a walk with at least one run is walked. */
export const isDraft = (runCount: number): boolean => runCount === 0;

/** Add a run to a walk. Returns the run id, or null on any failure. */
export async function addRun(client: SupabaseClient, userId: string, walkId: string, run: NewWalkRun = {}): Promise<string | null> {
  const { data, error } = await client
    .from("walk_runs")
    .insert({
      walk_id: walkId,
      user_id: userId,
      ...(run.startedAt ? { started_at: run.startedAt } : {}),
      finished_at: run.finishedAt ?? null,
      minutes: clampInt(run.minutes, 1440),
      distance_m: clampInt(run.distanceM, 200000),
    })
    .select("id")
    .single();
  return error || !data ? null : (data as { id: string }).id;
}

/** One walk's runs, newest first. Empty on any failure. */
export async function listRuns(client: SupabaseClient, walkId: string): Promise<WalkRun[]> {
  const { data, error } = await client.from("walk_runs").select(COLUMNS).eq("walk_id", walkId).order("started_at", { ascending: false });
  return error || !data ? [] : (data as Row[]).map(fromRow);
}

/** Group runs under their walks (pure). Walks keep their given order. */
export function groupRuns(walks: SavedWalk[], runs: WalkRun[]): WalkWithRuns[] {
  const byWalk = new Map<string, WalkRun[]>();
  for (const r of runs) byWalk.set(r.walkId, [...(byWalk.get(r.walkId) ?? []), r]);
  return walks.map((walk) => {
    const own = (byWalk.get(walk.id) ?? []).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { walk, runs: own, runCount: own.length, lastRunAt: own[0]?.startedAt ?? null, isDraft: isDraft(own.length) };
  });
}

/** All of the walker's runs for the given walks, in ONE query. */
export async function listRunsForWalks(client: SupabaseClient, walkIds: string[]): Promise<WalkRun[]> {
  if (walkIds.length === 0) return [];
  const { data, error } = await client.from("walk_runs").select(COLUMNS).in("walk_id", walkIds).order("started_at", { ascending: false });
  return error || !data ? [] : (data as Row[]).map(fromRow);
}

/** The walker's walks grouped with their runs. */
export async function listMyWalksWithRuns(client: SupabaseClient, walks: SavedWalk[]): Promise<WalkWithRuns[]> {
  return groupRuns(walks, await listRunsForWalks(client, walks.map((w) => w.id)));
}

/** Browser helpers: signed-out or any failure is swallowed (null / empty). */
export const recordRun = (walkId: string, run: NewWalkRun = {}): Promise<string | null> =>
  withWalkClient((c, uid) => addRun(c, uid, walkId, run));

export const fetchRuns = async (walkId: string): Promise<WalkRun[]> =>
  (await withWalkClient((c) => listRuns(c, walkId))) ?? [];

export const fetchWalksWithRuns = async (walks: SavedWalk[]): Promise<WalkWithRuns[]> =>
  (await withWalkClient((c) => listMyWalksWithRuns(c, walks))) ?? groupRuns(walks, []);
