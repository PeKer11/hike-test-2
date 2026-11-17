import { avatarOr, type AvatarId } from "./avatars";
import { presenceEnabled } from "./flag";

export type SinceBucket = "just_started" | "about_30" | "over_45";
export type DistanceBucket = "here" | "near" | "far" | null;

/** One person who is walking now. The client renders the words from these keys; no time or place is exact. */
export interface WalkingNowRow {
  token: string;
  /** Null for nearby strangers (phase 8). */
  friendId: string | null;
  displayName: string;
  avatar: AvatarId;
  relation: "friend" | "nearby";
  areaLabel: string | null;
  since: SinceBucket;
  distance: DistanceBucket;
  profileVisible: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function sanitizeWalkingNow(raw: unknown): WalkingNowRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkingNowRow[] = [];
  for (const item of raw.slice(0, 50)) {
    const r = rec(item);
    const token = r && typeof r.token === "string" && UUID.test(r.token) ? r.token : null;
    const name = r && typeof r.display_name === "string" && r.display_name.trim() ? r.display_name.trim().slice(0, 30) : null;
    if (!r || !token || !name) continue;
    const friendId = typeof r.friend_id === "string" && UUID.test(r.friend_id) ? r.friend_id : null;
    const relation = r.relation === "nearby" ? "nearby" : "friend";
    if (relation === "friend" && !friendId) continue;
    out.push({
      token,
      friendId,
      displayName: name,
      avatar: avatarOr(r.avatar),
      relation,
      areaLabel: typeof r.area_label === "string" && r.area_label.trim() ? r.area_label.trim().slice(0, 60) : null,
      since: r.since_bucket === "about_30" || r.since_bucket === "over_45" ? r.since_bucket : "just_started",
      distance: r.distance_bucket === "here" || r.distance_bucket === "near" || r.distance_bucket === "far" ? r.distance_bucket : null,
      profileVisible: r.profile_visible === true,
    });
  }
  return out;
}

/** The route's own rows (already camelCase and sanitized on the server); re-checked here so the page renders nothing unfamiliar. */
export function sanitizeRouteRows(raw: unknown): WalkingNowRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkingNowRow[] = [];
  for (const item of raw.slice(0, 50)) {
    const r = rec(item);
    const token = r && typeof r.token === "string" && UUID.test(r.token) ? r.token : null;
    const name = r && typeof r.displayName === "string" && r.displayName.trim() ? r.displayName.trim().slice(0, 30) : null;
    if (!r || !token || !name) continue;
    const friendId = typeof r.friendId === "string" && UUID.test(r.friendId) ? r.friendId : null;
    const relation = r.relation === "nearby" ? "nearby" : "friend";
    if (relation === "friend" && !friendId) continue;
    out.push({
      token,
      friendId,
      displayName: name,
      avatar: avatarOr(r.avatar),
      relation,
      areaLabel: typeof r.areaLabel === "string" && r.areaLabel.trim() ? r.areaLabel.trim().slice(0, 60) : null,
      since: r.since === "about_30" || r.since === "over_45" ? r.since : "just_started",
      distance: r.distance === "here" || r.distance === "near" || r.distance === "far" ? r.distance : null,
      profileVisible: r.profileVisible === true,
    });
  }
  return out;
}

/** `available:false` = the flag is off or the migration is not applied: the section stays hidden. */
export interface WalkingNowResult {
  available: boolean;
  rows: WalkingNowRow[];
}

export async function fetchWalkingNow(fetchFn: typeof fetch = fetch): Promise<WalkingNowResult> {
  if (!presenceEnabled()) return { available: false, rows: [] };
  try {
    const res = await fetchFn("/api/social/walking-now", { method: "GET", cache: "no-store" });
    if (!res.ok) return { available: false, rows: [] };
    const body = (await res.json()) as { available?: boolean; rows?: unknown };
    return { available: body.available === true, rows: sanitizeRouteRows(body.rows) };
  } catch {
    return { available: false, rows: [] };
  }
}

/** Words for the buckets, in both languages. */
export const sinceCopy: Record<"en" | "he", Record<SinceBucket, string>> = {
  en: { just_started: "just started", about_30: "about 30 min", over_45: "over 45 min" },
  he: { just_started: "התחילו עכשיו", about_30: "כ-30 דק׳", over_45: "מעל 45 דק׳" },
};
export const distanceCopy: Record<"en" | "he", Record<"here" | "near" | "far", string>> = {
  en: { here: "right here", near: "nearby", far: "farther away" },
  he: { here: "ממש קרוב", near: "קרוב", far: "רחוק יותר" },
};
