import type { SupabaseClient } from "@supabase/supabase-js";

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
}

export type NewSavedWalk = Pick<SavedWalk, "title" | "start" | "stops"> &
  Partial<Pick<SavedWalk, "status" | "areaLabel" | "totalMin" | "distanceM" | "params" | "visibility">>;

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
}

const COLUMNS = "id, title, status, area_label, start_lat, start_lng, total_min, distance_m, stops, params, visibility, created_at, completed_at";

export const fromRow = (r: Row): SavedWalk => ({
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

/** The signed-in walker's own walks, newest first. Throws on a query failure. */
export async function listMyWalksOrThrow(client: SupabaseClient, userId: string, limit = 50): Promise<SavedWalk[]> {
  const { data, error } = await client.from("saved_walks").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error || !data) throw new Error("saved_walks query failed");
  return (data as Row[]).map(fromRow);
}

/** Same, but empty on any failure. */
export async function listMyWalks(client: SupabaseClient, userId: string, limit = 50): Promise<SavedWalk[]> {
  try {
    return await listMyWalksOrThrow(client, userId, limit);
  } catch {
    return [];
  }
}

export async function insertWalk(client: SupabaseClient, userId: string, w: NewSavedWalk): Promise<string | null> {
  const { data, error } = await client
    .from("saved_walks")
    .insert({
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
