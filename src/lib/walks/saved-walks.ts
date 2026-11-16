import type { SupabaseClient } from "@supabase/supabase-js";

import type { Coordinates } from "@/lib/types";

import { decodePolyline, encodePolyline } from "./polyline";

export type SavedWalkStatus = "planned" | "saved" | "completed";

export interface SavedStop {
  name: string;
  category: string;
  lat: number;
  lng: number;
  /** Google place_id when the stop came from Google (kept so the stop can be looked up again). */
  placeId?: string;
  /** Minutes planned at this stop, so "walk again" keeps the same total time. */
  visitMinutes?: number;
  /** The walker's own pace (min/km) for the leg arriving at this stop. */
  legPaceMinPerKm?: number;
}

export interface SavedWalk {
  id: string;
  title: string;
  status: SavedWalkStatus;
  areaLabel: string | null;
  start: { lat: number; lng: number };
  totalMin: number | null;
  distanceM: number | null;
  stops: SavedStop[];
  /** The limits the walk was built with, to build it again. */
  params: Record<string, unknown>;
  visibility: "private" | "friends";
  createdAt: string;
  completedAt: string | null;
  /** The route our router drew, when the walk was saved after geometry was stored. Absent on older walks. */
  geometry?: Coordinates[];
  end?: Coordinates;
  isLoop?: boolean;
  /** For a variant: the walk it was made from, and how. */
  parentWalkId?: string;
  variantKind?: VariantKind;
}

export type VariantKind = "reverse" | "shorter" | "longer" | "start_here" | "start_at" | "skip_stop" | "add_stop" | "swap_type" | "edit";

export type NewSavedWalk = Pick<SavedWalk, "title" | "start" | "stops"> &
  Partial<Pick<SavedWalk, "status" | "areaLabel" | "totalMin" | "distanceM" | "params" | "visibility" | "geometry" | "end" | "isLoop" | "parentWalkId" | "variantKind">>;

interface Row {
  id: string;
  title: string;
  status: SavedWalkStatus;
  area_label: string | null;
  start_lat: number;
  start_lng: number;
  total_min: number | null;
  distance_m: number | null;
  stops: SavedStop[];
  params: Record<string, unknown>;
  visibility: "private" | "friends";
  created_at: string;
  completed_at: string | null;
  geometry?: string | null;
  end_lat?: number | null;
  end_lng?: number | null;
  is_loop?: boolean | null;
  parent_walk_id?: string | null;
  variant_kind?: VariantKind | null;
}

const COLUMNS = "id, title, status, area_label, start_lat, start_lng, total_min, distance_m, stops, params, visibility, created_at, completed_at";
/** The columns the geometry/variants migration adds. Until it is applied, queries naming them fail and fall back to COLUMNS. */
const NEW_COLUMNS = "geometry, end_lat, end_lng, is_loop, parent_walk_id, variant_kind";
const COLUMNS_V2 = `${COLUMNS}, ${NEW_COLUMNS}`;

/** Whether the new columns exist, learnt from the first failing query; null until known. */
let newColumnsExist: boolean | null = null;
/** Test hook: forget what was learnt. */
export const resetColumnProbe = () => {
  newColumnsExist = null;
};

export const fromRow = (r: Row): SavedWalk => {
  const geometry = typeof r.geometry === "string" && r.geometry ? decodePolyline(r.geometry) : [];
  return {
    ...baseFromRow(r),
    ...(geometry.length >= 2 ? { geometry } : {}),
    ...(r.end_lat != null && r.end_lng != null ? { end: { lat: Number(r.end_lat), lng: Number(r.end_lng) } } : {}),
    ...(typeof r.is_loop === "boolean" ? { isLoop: r.is_loop } : {}),
    ...(r.parent_walk_id ? { parentWalkId: r.parent_walk_id } : {}),
    ...(r.variant_kind ? { variantKind: r.variant_kind } : {}),
  };
};

const baseFromRow = (r: Row): SavedWalk => ({
  id: r.id,
  title: r.title,
  status: r.status,
  areaLabel: r.area_label,
  start: { lat: Number(r.start_lat), lng: Number(r.start_lng) },
  totalMin: r.total_min,
  distanceM: r.distance_m,
  stops: Array.isArray(r.stops) ? r.stops : [],
  params: r.params ?? {},
  visibility: r.visibility,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

/** One walk by id (the caller's own, or a friend's shared one: row-level security decides). Null when not found. */
/** Postgres 42703 / PostgREST PGRST204: the column is not there. Anything else (network, RLS) proves nothing. */
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function getWalkById(client: SupabaseClient, id: string): Promise<SavedWalk | null> {
  const query = (columns: string) => client.from("saved_walks").select(columns).eq("id", id).maybeSingle();
  if (newColumnsExist !== false) {
    const { data, error } = await query(COLUMNS_V2);
    if (!error) {
      newColumnsExist = true;
      return data ? fromRow(data as unknown as Row) : null;
    }
    if (newColumnsExist === null && isMissingColumn(error)) newColumnsExist = false;
  }
  const { data, error } = await query(COLUMNS);
  return error || !data ? null : fromRow(data as unknown as Row);
}

/** The signed-in walker's own walks, newest first. Throws on a query failure. */
export async function listMyWalksOrThrow(client: SupabaseClient, userId: string, limit = 50): Promise<SavedWalk[]> {
  const query = (columns: string) => client.from("saved_walks").select(columns).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (newColumnsExist !== false) {
    const { data, error } = await query(COLUMNS_V2);
    if (!error && data) {
      newColumnsExist = true;
      return (data as unknown as Row[]).map(fromRow);
    }
    // Most likely the migration is not applied yet: use the old columns, and remember not to ask again.
    if (newColumnsExist === null && isMissingColumn(error)) newColumnsExist = false;
  }
  const { data, error } = await query(COLUMNS);
  if (error || !data) throw new Error("saved_walks query failed");
  return (data as unknown as Row[]).map(fromRow);
}

/** Same, but empty on any failure. */
export async function listMyWalks(client: SupabaseClient, userId: string, limit = 50): Promise<SavedWalk[]> {
  try {
    return await listMyWalksOrThrow(client, userId, limit);
  } catch {
    return [];
  }
}

/** The columns the migration adds, for an insert. Empty when there is nothing to store. */
function newColumnValues(w: NewSavedWalk): Record<string, unknown> {
  const geometry = w.geometry && w.geometry.length >= 2 ? encodePolyline(w.geometry) : null;
  return {
    ...(geometry && geometry.length <= 60000 ? { geometry } : {}),
    ...(w.end ? { end_lat: w.end.lat, end_lng: w.end.lng } : {}),
    ...(typeof w.isLoop === "boolean" ? { is_loop: w.isLoop } : {}),
    ...(w.parentWalkId ? { parent_walk_id: w.parentWalkId } : {}),
    ...(w.variantKind ? { variant_kind: w.variantKind } : {}),
  };
}

export async function insertWalk(client: SupabaseClient, userId: string, w: NewSavedWalk): Promise<string | null> {
  const extra = newColumnsExist === false ? {} : newColumnValues(w);
  const first = await insertRow(client, userId, w, extra);
  if (first || Object.keys(extra).length === 0) return first;
  // A failure with the new columns in it may just mean they do not exist yet: save the walk without them.
  // (Only the read probes may conclude the columns are missing; an insert can fail for other reasons.)
  return insertRow(client, userId, w, {});
}

/** Write geometry, end and loop onto a walk saved before they were stored. No-op until the migration is applied. */
export async function backfillWalkGeometry(client: SupabaseClient, id: string, geometry: Coordinates[], end: Coordinates | undefined, isLoop: boolean | undefined): Promise<boolean> {
  if (newColumnsExist === false) return false;
  const values = newColumnValues({ geometry, end, isLoop } as NewSavedWalk);
  if (Object.keys(values).length === 0) return false;
  const { error } = await client.from("saved_walks").update(values).eq("id", id);
  return !error;
}

async function insertRow(client: SupabaseClient, userId: string, w: NewSavedWalk, extra: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await client
    .from("saved_walks")
    .insert({
      ...extra,
      user_id: userId,
      title: w.title.slice(0, 120),
      status: w.status ?? "planned",
      area_label: w.areaLabel?.slice(0, 60) ?? null,
      start_lat: w.start.lat,
      start_lng: w.start.lng,
      total_min: w.totalMin ?? null,
      distance_m: w.distanceM ?? null,
      stops: w.stops.slice(0, 40),
      params: w.params ?? {},
      visibility: w.visibility ?? "private",
    })
    .select("id")
    .single();
  return error || !data ? null : (data as { id: string }).id;
}
