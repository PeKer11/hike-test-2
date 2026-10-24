import type { SupabaseClient } from "@supabase/supabase-js";

import type { SavedStop } from "./saved-walks";

export interface FriendRow {
  friendshipId: string;
  friendId: string;
  label: string;
  status: "pending" | "accepted";
  /** True when the other person sent the request to me. */
  incoming: boolean;
}

export interface FriendWalk {
  id: string;
  ownerLabel: string;
  title: string;
  status: "planned" | "saved" | "completed";
  areaLabel: string | null;
  totalMin: number | null;
  distanceM: number | null;
  stops: SavedStop[];
  createdAt: string;
}

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);

export function sanitizeFriendCode(v: unknown): string | null {
  return typeof v === "string" && /^[A-Z0-9]{6,12}$/.test(v) ? v : null;
}

export function sanitizeFriends(raw: unknown): FriendRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FriendRow[] = [];
  for (const item of raw.slice(0, 200)) {
    const r = rec(item);
    if (!r) continue;
    const friendshipId = uuid(r.friendship_id);
    const friendId = uuid(r.friend_id);
    const label = str(r.label, 40);
    if (!friendshipId || !friendId || !label) continue;
    if (r.status !== "pending" && r.status !== "accepted") continue;
    out.push({ friendshipId, friendId, label, status: r.status, incoming: r.incoming === true });
  }
  return out;
}

function sanitizeStops(raw: unknown): SavedStop[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedStop[] = [];
  for (const item of raw.slice(0, 40)) {
    const r = rec(item);
    const name = r ? str(r.name, 120) : null;
    const lat = r ? num(r.lat) : null;
    const lng = r ? num(r.lng) : null;
    if (!r || !name || lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    out.push({ name, category: str(r.category, 40) ?? "other", lat, lng });
  }
  return out;
}

export function sanitizeFriendWalks(raw: unknown): FriendWalk[] {
  if (!Array.isArray(raw)) return [];
  const out: FriendWalk[] = [];
  for (const item of raw.slice(0, 50)) {
    const r = rec(item);
    if (!r) continue;
    const id = uuid(r.id);
    const title = str(r.title, 120);
    const createdAt = str(r.created_at, 40);
    if (!id || !title || !createdAt) continue;
    if (r.status !== "planned" && r.status !== "saved" && r.status !== "completed") continue;
    out.push({
      id,
      ownerLabel: str(r.owner_label, 40) ?? "Friend",
      title,
      status: r.status,
      areaLabel: str(r.area_label, 60),
      totalMin: num(r.total_min),
      distanceM: num(r.distance_m),
      stops: sanitizeStops(r.stops),
      createdAt,
    });
  }
  return out;
}

export async function getMyFriendCode(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.rpc("my_friend_code");
  return error ? null : sanitizeFriendCode(data);
}

/** true = request sent (or already friends); false = it did not go through, for any reason. */
export async function requestFriend(client: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await client.rpc("request_friend", { code: code.trim().toUpperCase().slice(0, 12) });
  return !error && data === true;
}

export async function listFriends(client: SupabaseClient): Promise<FriendRow[]> {
  const { data, error } = await client.rpc("list_friends");
  return error ? [] : sanitizeFriends(data);
}

export async function listFriendsWalks(client: SupabaseClient): Promise<FriendWalk[]> {
  const { data, error } = await client.rpc("friends_walks");
  return error ? [] : sanitizeFriendWalks(data);
}

export async function acceptFriend(client: SupabaseClient, friendshipId: string): Promise<boolean> {
  const { data, error } = await client.from("friendships").update({ status: "accepted" }).eq("id", friendshipId).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

/** Decline a request, cancel one I sent, or remove a friend: all are a delete of the row. */
export async function removeFriendship(client: SupabaseClient, friendshipId: string): Promise<boolean> {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId);
  return !error;
}
