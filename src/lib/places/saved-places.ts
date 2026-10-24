import type { SupabaseClient } from "@supabase/supabase-js";

import type { SavedStop } from "@/lib/walks/saved-walks";
import { withWalkClient } from "@/lib/walks/walk-history";

export type PlaceSource = "google" | "osm";

export interface SavedPlace {
  id: string;
  source: PlaceSource;
  /** google: the place id. osm: "lat,lng" rounded to 5 decimals. */
  placeRef: string;
  label: string;
  category: string;
  /** OSM only. Google places carry no coordinates (terms): resolve them again by place id. */
  coordinates: { lat: number; lng: number } | null;
  visitedAt: string | null;
  createdAt: string;
}

export interface NewSavedPlace {
  source: PlaceSource;
  placeRef: string;
  label: string;
  category?: string;
  /** Used for OSM only; dropped for Google. */
  coordinates?: { lat: number; lng: number } | null;
}

export interface PlaceKey {
  source: PlaceSource;
  placeRef: string;
}

interface Row {
  id: string;
  source: PlaceSource;
  place_ref: string;
  label: string;
  category: string;
  lat: number | null;
  lng: number | null;
  visited_at: string | null;
  created_at: string;
}

const COLUMNS = "id, source, place_ref, label, category, lat, lng, visited_at, created_at";

const fromRow = (r: Row): SavedPlace => ({
  id: r.id,
  source: r.source,
  placeRef: r.place_ref,
  label: r.label,
  category: r.category,
  coordinates: r.lat === null || r.lng === null ? null : { lat: Number(r.lat), lng: Number(r.lng) },
  visitedAt: r.visited_at,
  createdAt: r.created_at,
});

/** The stable OSM key for a stop (stops carry no OSM id). */
export const osmRef = (c: { lat: number; lng: number }): string => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

const validCoord = (c: NewSavedPlace["coordinates"]): c is { lat: number; lng: number } =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;

/** Row to insert, or null when it is unusable. Google rows never keep coordinates. */
export function sanitizePlace(userId: string, p: NewSavedPlace): Record<string, unknown> | null {
  const label = (p.label ?? "").trim().slice(0, 120);
  const ref = (p.placeRef ?? "").trim().slice(0, 300);
  if (!label || !ref || (p.source !== "google" && p.source !== "osm")) return null;
  const base = { user_id: userId, source: p.source, place_ref: ref, label, category: (p.category ?? "other").slice(0, 40) || "other" };
  if (p.source === "google") return { ...base, lat: null, lng: null };
  if (!validCoord(p.coordinates)) return null;
  return { ...base, lat: p.coordinates.lat, lng: p.coordinates.lng };
}

/** Saved places from a walk's stops: Google stops by place id, the rest as OSM with their coordinates. */
export function placesFromStops(stops: SavedStop[]): NewSavedPlace[] {
  return stops.map((s) =>
    s.placeId
      ? { source: "google" as const, placeRef: s.placeId, label: s.name, category: s.category }
      : { source: "osm" as const, placeRef: osmRef(s), label: s.name, category: s.category, coordinates: { lat: s.lat, lng: s.lng } },
  );
}

/** The walker's places, newest first. Empty on any failure. */
export async function listPlaces(client: SupabaseClient, userId: string, limit = 200): Promise<SavedPlace[]> {
  const { data, error } = await client.from("saved_places").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return error || !data ? [] : (data as Row[]).map(fromRow);
}

/** Add places; ones already in the list are left alone (idempotent). Returns how many rows were sent, or null on failure. */
export async function addPlaces(client: SupabaseClient, userId: string, places: NewSavedPlace[]): Promise<number | null> {
  const rows = places.map((p) => sanitizePlace(userId, p)).filter((r): r is Record<string, unknown> => r !== null);
  if (rows.length === 0) return 0;
  const { error } = await client.from("saved_places").upsert(rows, { onConflict: "user_id,source,place_ref", ignoreDuplicates: true });
  return error ? null : rows.length;
}

export const addPlace = (client: SupabaseClient, userId: string, p: NewSavedPlace): Promise<number | null> => addPlaces(client, userId, [p]);

/** Add every stop of a walk to the list. */
export const addFromWalk = (client: SupabaseClient, userId: string, stops: SavedStop[]): Promise<number | null> =>
  addPlaces(client, userId, placesFromStops(stops));

export async function removePlace(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { error } = await client.from("saved_places").delete().eq("id", id).eq("user_id", userId);
  return !error;
}

/** Mark places as visited now (those not in the list are ignored). */
export async function markVisited(client: SupabaseClient, userId: string, keys: PlaceKey[], now: Date = new Date()): Promise<boolean> {
  let ok = true;
  const at = now.toISOString();
  for (const source of ["google", "osm"] as const) {
    const refs = keys.filter((k) => k.source === source).map((k) => k.placeRef);
    if (refs.length === 0) continue;
    const { error } = await client.from("saved_places").update({ visited_at: at }).eq("user_id", userId).eq("source", source).in("place_ref", refs);
    if (error) ok = false;
  }
  return ok;
}

/** The "I've walked all of these" button: removes every place marked visited, in one go. */
export async function clearVisited(client: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await client.from("saved_places").delete().eq("user_id", userId).not("visited_at", "is", null);
  return !error;
}

/** The stops of a finished walk, as keys for markVisited. */
export const keysFromStops = (stops: SavedStop[]): PlaceKey[] => placesFromStops(stops).map(({ source, placeRef }) => ({ source, placeRef }));

/** Browser helpers: signed-out or any failure is swallowed (null / false / empty). */
export const fetchPlaces = async (): Promise<SavedPlace[]> => (await withWalkClient((c, uid) => listPlaces(c, uid))) ?? [];
export const savePlaces = (places: NewSavedPlace[]): Promise<number | null> => withWalkClient((c, uid) => addPlaces(c, uid, places));
export const saveStopsAsPlaces = (stops: SavedStop[]): Promise<number | null> => withWalkClient((c, uid) => addFromWalk(c, uid, stops));
export const deletePlace = async (id: string): Promise<boolean> => (await withWalkClient((c, uid) => removePlace(c, uid, id))) === true;
export const markStopsVisited = async (stops: SavedStop[]): Promise<boolean> =>
  (await withWalkClient((c, uid) => markVisited(c, uid, keysFromStops(stops)))) === true;
export const clearVisitedPlaces = async (): Promise<boolean> => (await withWalkClient((c, uid) => clearVisited(c, uid))) === true;
