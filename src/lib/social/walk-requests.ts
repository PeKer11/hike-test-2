import type { SupabaseClient } from "@supabase/supabase-js";

import { avatarOr, type AvatarId } from "./avatars";
import { nearbyEnabled, presenceEnabled } from "./flag";

export type NoteCode = "on_my_way" | "late_10" | "here" | "cant_make_it";
export const NOTE_CODES: readonly NoteCode[] = ["on_my_way", "late_10", "here", "cant_make_it"];
export const MEET_IN_MINUTES = [0, 15, 30] as const;

/**
 * A public meeting place. Open data (OSM) carries its key, name and position. A Google place carries ONLY its
 * place id (Maps Platform terms): the name is looked up live when someone needs to see it.
 */
export type MeetPlace =
  | { kind: "osm"; ref: string; name: string; lat: number; lng: number }
  | { kind: "google"; ref: string };

/** A choice offered in the sheet. `label` is for the sender's own screen only and is never sent. */
export interface MeetChoice {
  place: MeetPlace;
  label: string;
}

export interface WalkRequest {
  id: string;
  direction: "in" | "out";
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  otherId: string;
  otherName: string;
  otherAvatar: AvatarId;
  meet: MeetPlace;
  /** Meeting time as an ISO string. */
  meetAt: string;
  myNote: NoteCode | null;
  theirNote: NoteCode | null;
  createdAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OSM_REF = /^osm-(node|way|relation)-[0-9]{1,15}$/;
const GOOGLE_REF = /^[A-Za-z0-9_-]{10,200}$/;
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const note = (v: unknown): NoteCode | null => (NOTE_CODES.includes(v as NoteCode) ? (v as NoteCode) : null);

/** Builds the meeting place a stop or a nearby place can stand for; null when it cannot be one (no OSM key, no Google id). */
export function meetPlaceFromAttraction(a: { id: string; name: string; coordinates: { lat: number; lng: number } }): MeetPlace | null {
  if (a.id.startsWith("google-") && GOOGLE_REF.test(a.id.slice(7))) return { kind: "google", ref: a.id.slice(7) };
  if (OSM_REF.test(a.id) && a.name.trim() && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng)) {
    return { kind: "osm", ref: a.id, name: a.name.trim().slice(0, 80), lat: a.coordinates.lat, lng: a.coordinates.lng };
  }
  return null;
}

/** Hides Google results when the map is not Google (Maps Platform: never show Places content on another map). */
export function visibleChoices(choices: MeetChoice[], mapProvider: "google" | "leaflet"): MeetChoice[] {
  return mapProvider === "google" ? choices : choices.filter((c) => c.place.kind !== "google");
}

export function sanitizeRequests(raw: unknown): WalkRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkRequest[] = [];
  for (const item of raw.slice(0, 20)) {
    const r = rec(item);
    if (!r) continue;
    const id = typeof r.id === "string" && UUID.test(r.id) ? r.id : null;
    const otherId = typeof r.other_id === "string" && UUID.test(r.other_id) ? r.other_id : null;
    const direction = r.direction === "in" || r.direction === "out" ? r.direction : null;
    const status = ["pending", "accepted", "declined", "cancelled", "expired"].includes(r.status as string) ? (r.status as WalkRequest["status"]) : null;
    const meetAt = typeof r.meet_at === "string" && !Number.isNaN(Date.parse(r.meet_at)) ? r.meet_at : null;
    const ref = typeof r.meet_ref === "string" ? r.meet_ref : "";
    let meet: MeetPlace | null = null;
    if (r.meet_kind === "google" && GOOGLE_REF.test(ref)) meet = { kind: "google", ref };
    else if (r.meet_kind === "osm" && OSM_REF.test(ref) && typeof r.meet_name === "string" && r.meet_name.trim()) {
      const lat = Number(r.meet_lat);
      const lng = Number(r.meet_lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        meet = { kind: "osm", ref, name: r.meet_name.trim().slice(0, 80), lat, lng };
      }
    }
    if (!id || !otherId || !direction || !status || !meetAt || !meet) continue;
    out.push({
      id,
      direction,
      status,
      otherId,
      otherName: typeof r.other_name === "string" && r.other_name.trim() ? r.other_name.trim().slice(0, 30) : "…",
      otherAvatar: avatarOr(r.other_avatar),
      meet,
      meetAt,
      myNote: note(r.my_note),
      theirNote: note(r.their_note),
      createdAt: typeof r.created_at === "string" ? r.created_at : meetAt,
    });
  }
  return out;
}

/** `null` = unavailable (flag off, migration C missing, error): the feature stays hidden. */
export async function listMyRequests(client: SupabaseClient): Promise<WalkRequest[] | null> {
  if (!presenceEnabled()) return null;
  const { data, error } = await client.rpc("my_walk_requests");
  return error ? null : sanitizeRequests(data);
}

/** The id of the new request, or null for any refusal (the reasons are deliberately not told). */
export async function sendRequest(client: SupabaseClient, toUser: string, place: MeetPlace, inMinutes: number): Promise<string | null> {
  if (!presenceEnabled() || !UUID.test(toUser)) return null;
  const { data, error } = await client.rpc("send_walk_request", {
    p_to_user: toUser,
    p_meet_kind: place.kind,
    p_meet_ref: place.ref,
    // A Google place: no name, no position. Only its id travels.
    p_meet_name: place.kind === "osm" ? place.name : null,
    p_meet_lat: place.kind === "osm" ? place.lat : null,
    p_meet_lng: place.kind === "osm" ? place.lng : null,
    p_meet_in_min: inMinutes,
  });
  return !error && typeof data === "string" && UUID.test(data) ? data : null;
}

/** A stranger walking nearby, by presence token. Needs the nearby flag AND migration D; any refusal is null. */
export async function sendNearbyRequest(client: SupabaseClient, token: string, place: MeetPlace, inMinutes: number): Promise<string | null> {
  if (!presenceEnabled() || !nearbyEnabled() || !UUID.test(token)) return null;
  const { data, error } = await client.rpc("send_walk_request_nearby", {
    p_token: token,
    p_meet_kind: place.kind,
    p_meet_ref: place.ref,
    p_meet_name: place.kind === "osm" ? place.name : null,
    p_meet_lat: place.kind === "osm" ? place.lat : null,
    p_meet_lng: place.kind === "osm" ? place.lng : null,
    p_meet_in_min: inMinutes,
  });
  return !error && typeof data === "string" && UUID.test(data) ? data : null;
}

export async function respondToRequest(client: SupabaseClient, id: string, accept: boolean): Promise<boolean> {
  if (!presenceEnabled()) return false;
  const { data, error } = await client.rpc("respond_walk_request", { p_id: id, p_accept: accept });
  return !error && data === true;
}

export async function cancelRequest(client: SupabaseClient, id: string): Promise<boolean> {
  if (!presenceEnabled()) return false;
  const { data, error } = await client.rpc("cancel_walk_request", { p_id: id });
  return !error && data === true;
}

export async function setRequestNote(client: SupabaseClient, id: string, code: NoteCode): Promise<boolean> {
  if (!presenceEnabled() || !NOTE_CODES.includes(code)) return false;
  const { data, error } = await client.rpc("set_walk_request_note", { p_id: id, p_note: code });
  return !error && data === true;
}

/** Open (not expired) incoming requests waiting for an answer. */
export const incomingPending = (rs: readonly WalkRequest[]): WalkRequest[] => rs.filter((r) => r.direction === "in" && r.status === "pending");

/** Accepted and still on: the meeting card. */
export const activeMeetings = (rs: readonly WalkRequest[]): WalkRequest[] => rs.filter((r) => r.status === "accepted");

/** A request the walker sent that is still waiting. */
export const outgoingPending = (rs: readonly WalkRequest[]): WalkRequest[] => rs.filter((r) => r.direction === "out" && r.status === "pending");

/** The map the app is showing now: Google places may be shown (and offered) only on the Google map. */
export function mapProviderNow(): "google" | "leaflet" {
  return process.env.NEXT_PUBLIC_MAP_PROVIDER !== "leaflet" && !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ? "google" : "leaflet";
}
