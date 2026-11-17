import type { SupabaseClient } from "@supabase/supabase-js";

import { avatarOr, type AvatarId } from "./avatars";
import { nearbyEnabled, socialProfilesEnabled } from "./flag";

export type Visibility = "private" | "friends" | "public";
export type PresenceAudience = "off" | "friends" | "public";

export interface SocialProfile {
  displayName: string;
  avatar: AvatarId;
  visibility: Visibility;
  showHistory: boolean;
  showTaste: boolean;
  presenceAudience: PresenceAudience;
  suspended: boolean;
}

/** `unavailable`: the flag is off, or the migration is not applied (the feature stays hidden, no error). */
export type MyProfile = { status: "ok"; profile: SocialProfile } | { status: "none" } | { status: "unavailable" };

export type FriendState = "me" | "friends" | "pending_out" | "pending_in" | "none";

export interface ProfileCard {
  displayName: string;
  avatar: AvatarId;
  visibility: Visibility;
  relation: "me" | "friend" | "other";
  /** First day of the month the profile was made, as YYYY-MM-DD. */
  memberSince: string;
  walkCount: number;
  kmTotal: number;
  topAreas: string[];
  topCategories: string[];
  tasteTags: string[];
  friendState: FriendState;
}

/** A stop as others may see it: Google stops have only a category and a place id; hidden ones only a category. */
export interface PublicStop {
  category: string;
  name?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export interface ProfileWalk {
  id: string;
  areaLabel: string | null;
  /** YYYY-MM-DD, never a time of day. */
  walkedOn: string;
  totalMin: number | null;
  distanceM: number | null;
  stops: PublicStop[];
}

export interface BlockedUser {
  userId: string;
  displayName: string | null;
  avatar: AvatarId;
}

export type SaveProfileCode =
  | "ok" | "signin" | "suspended" | "adult_required" | "rate_limited" | "name_reserved" | "invalid" | "unavailable" | "error";

export type ReportReason = "harassment" | "spam" | "fake" | "unsafe" | "minor" | "other";
export type ReportContext = "profile" | "presence" | "walk_request" | "walk" | "name";

/** A function or table that is not in the database yet: PostgREST PGRST202 / PGRST205, Postgres 42883 / 42P01. */
export function isMissingRpc(error: { code?: string } | null | undefined): boolean {
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(error?.code ?? "");
}

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const strings = (v: unknown, n: number, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, n).map((x) => x.slice(0, max)) : [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIS: readonly string[] = ["private", "friends", "public"];
const PRES: readonly string[] = ["off", "friends", "public"];

const RESERVED = /(traike|admin|support|official|moderator|staff|תמיכה|מנהל|צוות|טרייק)/;

/** The same rules the database enforces, so the form can say what is wrong before a round trip. */
export function validateDisplayName(raw: string): "invalid" | "name_reserved" | null {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 30) return "invalid";
  if (/[@<>/\\]/.test(clean) || /[0-9]{5,}/.test(clean)) return "invalid";
  if (RESERVED.test(clean.toLowerCase())) return "name_reserved";
  return null;
}

export function sanitizeProfile(raw: unknown): SocialProfile | null {
  const r = rec(raw);
  const displayName = r ? str(r.display_name, 30) : null;
  if (!r || !displayName) return null;
  return {
    displayName,
    avatar: avatarOr(r.avatar),
    visibility: VIS.includes(r.visibility as string) ? (r.visibility as Visibility) : "private",
    showHistory: r.show_history !== false,
    showTaste: r.show_taste === true,
    presenceAudience: PRES.includes(r.presence_audience as string) ? (r.presence_audience as PresenceAudience) : "off",
    suspended: typeof r.suspended_at === "string",
  };
}

export function sanitizeCard(raw: unknown): ProfileCard | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const r = rec(row);
  const displayName = r ? str(r.display_name, 30) : null;
  if (!r || !displayName) return null;
  const relation = r.relation === "me" || r.relation === "friend" ? r.relation : "other";
  const fs = ["me", "friends", "pending_out", "pending_in"].includes(r.friend_state as string) ? (r.friend_state as FriendState) : "none";
  return {
    displayName,
    avatar: avatarOr(r.avatar),
    visibility: VIS.includes(r.visibility as string) ? (r.visibility as Visibility) : "private",
    relation,
    memberSince: day(r.member_since) ?? "",
    walkCount: Math.max(0, Math.round(num(r.walk_count) ?? 0)),
    kmTotal: Math.max(0, Math.round(num(r.km_total) ?? 0)),
    topAreas: strings(r.top_areas, 3, 60),
    topCategories: strings(r.top_categories, 3, 24),
    tasteTags: strings(r.taste_tags, 6, 24),
    friendState: fs,
  };
}

export function sanitizePublicStops(raw: unknown): PublicStop[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicStop[] = [];
  for (const item of raw.slice(0, 40)) {
    const r = rec(item);
    if (!r) continue;
    const category = str(r.category, 40) ?? "other";
    const placeId = typeof r.placeId === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(r.placeId) ? r.placeId : undefined;
    const name = str(r.name, 80);
    const lat = num(r.lat);
    const lng = num(r.lng);
    // A stop with a place id is shown by id only, whatever else arrives (Google terms: only the id is kept).
    if (placeId) out.push({ category, placeId });
    else if (name && lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) out.push({ category, name, lat, lng });
    else out.push({ category });
  }
  return out;
}

export function sanitizeProfileWalks(raw: unknown): ProfileWalk[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileWalk[] = [];
  for (const item of raw.slice(0, 50)) {
    const r = rec(item);
    const id = r && typeof r.id === "string" && UUID.test(r.id) ? r.id : null;
    const walkedOn = r ? day(r.walked_on) : null;
    if (!r || !id || !walkedOn) continue;
    out.push({
      id,
      areaLabel: str(r.area_label, 60),
      walkedOn,
      totalMin: num(r.total_min),
      distanceM: num(r.distance_m),
      stops: sanitizePublicStops(r.stops),
    });
  }
  return out;
}

export function sanitizeBlocks(raw: unknown): BlockedUser[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockedUser[] = [];
  for (const item of raw.slice(0, 100)) {
    const r = rec(item);
    const userId = r && typeof r.user_id === "string" && UUID.test(r.user_id) ? r.user_id : null;
    if (!r || !userId) continue;
    out.push({ userId, displayName: str(r.display_name, 30), avatar: avatarOr(r.avatar) });
  }
  return out;
}

/** The signed-in walker's own profile. Reads the own-row policy; no profile is `none`. */
export async function getMyProfile(client: SupabaseClient, userId: string): Promise<MyProfile> {
  if (!socialProfilesEnabled()) return { status: "unavailable" };
  const { data, error } = await client.from("social_profiles").select("*").eq("user_id", userId).maybeSingle();
  // Missing table or any failure: the feature stays hidden.
  if (error) return { status: "unavailable" };
  const profile = sanitizeProfile(data);
  return profile ? { status: "ok", profile } : { status: "none" };
}

export interface SaveProfileInput {
  displayName: string;
  avatar: AvatarId;
  visibility: Visibility;
  showHistory: boolean;
  showTaste: boolean;
  presenceAudience: PresenceAudience;
  /** Required (and only read) when the profile is created. */
  adult: boolean;
}

export async function saveProfile(client: SupabaseClient, input: SaveProfileInput): Promise<SaveProfileCode> {
  if (!socialProfilesEnabled()) return "unavailable";
  const local = validateDisplayName(input.displayName);
  if (local) return local;
  // "Everyone nearby" exists only when the nearby feature is on (it needs counsel's sign-off first): never sent otherwise.
  const presenceAudience: PresenceAudience = input.presenceAudience === "public" && !nearbyEnabled() ? "friends" : input.presenceAudience;
  const { data, error } = await client.rpc("save_social_profile", {
    p_display_name: input.displayName.replace(/\s+/g, " ").trim(),
    p_avatar: input.avatar,
    p_visibility: input.visibility,
    p_show_history: input.showHistory,
    p_show_taste: input.showTaste,
    p_presence_audience: presenceAudience,
    p_adult: input.adult,
  });
  if (error) return isMissingRpc(error) ? "unavailable" : "error";
  const known: SaveProfileCode[] = ["ok", "signin", "suspended", "adult_required", "rate_limited", "name_reserved", "invalid"];
  return known.includes(data as SaveProfileCode) ? (data as SaveProfileCode) : "error";
}

export async function deleteMyProfile(client: SupabaseClient, userId: string): Promise<boolean> {
  if (!socialProfilesEnabled()) return false;
  const { error } = await client.from("social_profiles").delete().eq("user_id", userId);
  return !error;
}

/** `null` = nothing to show (private, blocked, no profile, or unavailable): all look the same on purpose. */
export async function getProfileCard(client: SupabaseClient, target: string): Promise<ProfileCard | null> {
  if (!socialProfilesEnabled() || !UUID.test(target)) return null;
  const { data, error } = await client.rpc("social_profile_card", { p_target: target });
  return error ? null : sanitizeCard(data);
}

export async function getProfileWalks(client: SupabaseClient, target: string, before?: string): Promise<ProfileWalk[]> {
  if (!socialProfilesEnabled() || !UUID.test(target)) return [];
  const { data, error } = await client.rpc("social_profile_walks", { p_target: target, p_before: before ?? null, p_limit: 20 });
  return error ? [] : sanitizeProfileWalks(data);
}

export async function blockUser(client: SupabaseClient, target: string): Promise<boolean> {
  if (!socialProfilesEnabled() || !UUID.test(target)) return false;
  const { data, error } = await client.rpc("block_user", { p_target: target });
  return !error && data === true;
}

export async function unblockUser(client: SupabaseClient, userId: string, target: string): Promise<boolean> {
  if (!socialProfilesEnabled()) return false;
  const { error } = await client.from("user_blocks").delete().eq("blocker", userId).eq("blocked", target);
  return !error;
}

export async function listMyBlocks(client: SupabaseClient): Promise<BlockedUser[]> {
  if (!socialProfilesEnabled()) return [];
  const { data, error } = await client.rpc("list_my_blocks");
  return error ? [] : sanitizeBlocks(data);
}

export async function reportUser(
  client: SupabaseClient,
  target: string,
  context: ReportContext,
  reason: ReportReason,
  note?: string,
): Promise<boolean> {
  if (!socialProfilesEnabled() || !UUID.test(target)) return false;
  const { data, error } = await client.rpc("report_user", {
    p_target: target,
    p_context: context,
    p_reason: reason,
    p_note: note?.trim().slice(0, 500) || null,
  });
  return !error && data === true;
}

export async function requestFriendById(client: SupabaseClient, target: string): Promise<boolean> {
  if (!socialProfilesEnabled() || !UUID.test(target)) return false;
  const { data, error } = await client.rpc("request_friend_by_id", { p_target: target });
  return !error && data === true;
}

/** The card of a nearby stranger, by their presence token (phase 8). Null unless the nearby flag is on, migration D is applied and they are public. */
export async function getCardByToken(client: SupabaseClient, token: string): Promise<{ userId: string; card: ProfileCard } | null> {
  if (!socialProfilesEnabled() || !nearbyEnabled() || !UUID.test(token)) return null;
  const { data, error } = await client.rpc("social_profile_card_by_token", { p_token: token });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  const userId = rec(row) && typeof (row as Record<string, unknown>).user_id === "string" ? ((row as Record<string, unknown>).user_id as string) : null;
  const card = sanitizeCard(row);
  return userId && UUID.test(userId) && card ? { userId, card } : null;
}
