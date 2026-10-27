import type { WalkCompanionInput } from "@/components/route/WalkCompanionPanel";
import type { Coordinates } from "@/lib/types";
import type { Attraction, AttractionCategory } from "@/lib/types/walk-plan";

import { DEFAULT_PACE_MIN_PER_KM } from "@/lib/walk/pace";
import type { NewSavedWalk, SavedStop, SavedWalk } from "./saved-walks";

/** Attractions from Google carry their place id in the attraction id (`google-<placeId>`). */
const GOOGLE_PREFIX = "google-";

/** Google place id of a stop: from a `google-` id, or from the tag the chat and AI builder put on their stops. */
function placeIdOf(a: Attraction): string | undefined {
  if (a.id.startsWith(GOOGLE_PREFIX)) return a.id.slice(GOOGLE_PREFIX.length);
  const tagged = (a.tags as Record<string, unknown> | undefined)?.placeId;
  // Only Google-shaped ids: "via:<street>" marks a street waypoint, not a place.
  return typeof tagged === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(tagged) ? tagged : undefined;
}

export function stopsFromAttractions(items: Attraction[]): SavedStop[] {
  return items.map((a) => ({
    name: a.name,
    category: a.category,
    lat: a.coordinates.lat,
    lng: a.coordinates.lng,
    ...(Number.isFinite(a.avgVisitMinutes) && a.avgVisitMinutes >= 0 ? { visitMinutes: Math.round(a.avgVisitMinutes) } : {}),
    ...(placeIdOf(a) ? { placeId: placeIdOf(a) } : {}),
    ...(a.legPaceMinPerKm !== undefined && Number.isFinite(a.legPaceMinPerKm) ? { legPaceMinPerKm: a.legPaceMinPerKm } : {}),
  }));
}

/** The limits the walk was built with, small enough to rebuild it. */
export function paramsFromInput(input: WalkCompanionInput): Record<string, unknown> {
  return {
    availableMinutes: input.availableMinutes,
    walkingPaceMinPerKm: input.walkingPaceMinPerKm,
    radiusMeters: input.radiusMeters,
    ...(input.maxEndDistanceFromOriginMeters !== undefined
      ? { maxEndDistanceFromOriginMeters: input.maxEndDistanceFromOriginMeters }
      : {}),
    ...(input.preferredCategories?.length ? { preferredCategories: input.preferredCategories } : {}),
  };
}

export function titleForWalk(stops: SavedStop[], now: Date = new Date()): string {
  const day = now.toLocaleDateString("en", { month: "short", day: "numeric" });
  if (stops.length === 0) return `Walk, ${day}`;
  const first = stops[0].name;
  return stops.length === 1 ? `${first}, ${day}` : `${first} + ${stops.length - 1} more, ${day}`;
}

export function newWalkFromPlan(
  input: WalkCompanionInput,
  attractions: Attraction[],
  totalMin: number,
  distanceM: number,
  routeRules?: Record<string, unknown>,
): NewSavedWalk {
  const stops = stopsFromAttractions(attractions);
  return {
    title: titleForWalk(stops),
    start: { lat: input.origin.lat, lng: input.origin.lng },
    stops,
    areaLabel: null,
    status: "planned",
    totalMin: Math.round(totalMin),
    distanceM: Math.round(distanceM),
    params: { ...paramsFromInput(input), ...(routeRules && Object.keys(routeRules).length ? { routeRules } : {}) },
  };
}

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

/** Rebuild the same stops, in the same order, through the normal build path. */
export function rebuildFromSaved(walk: SavedWalk): { input: WalkCompanionInput; attractions: Attraction[]; routeRules: Record<string, unknown> } {
  const p = walk.params;
  const input: WalkCompanionInput = {
    origin: walk.start,
    availableMinutes: num(p.availableMinutes, walk.totalMin ?? 60),
    walkingPaceMinPerKm: num(p.walkingPaceMinPerKm, DEFAULT_PACE_MIN_PER_KM),
    radiusMeters: num(p.radiusMeters, 1500),
    ...(typeof p.maxEndDistanceFromOriginMeters === "number"
      ? { maxEndDistanceFromOriginMeters: p.maxEndDistanceFromOriginMeters }
      : {}),
    ...(Array.isArray(p.preferredCategories)
      ? { preferredCategories: p.preferredCategories as AttractionCategory[] }
      : {}),
  };
  const attractions: Attraction[] = walk.stops.map((s, i) => ({
    id: s.placeId ? `${GOOGLE_PREFIX}${s.placeId}` : `saved-${walk.id}-${i}`,
    name: s.name,
    coordinates: { lat: s.lat, lng: s.lng },
    category: s.category as AttractionCategory,
    // 0 is a real answer ("just pass by"), so only a missing value falls back.
    avgVisitMinutes: typeof s.visitMinutes === "number" && s.visitMinutes >= 0 ? s.visitMinutes : 10,
    ...(typeof s.legPaceMinPerKm === "number" ? { legPaceMinPerKm: s.legPaceMinPerKm } : {}),
    tags: {},
  }));
  const routeRules = typeof p.routeRules === "object" && p.routeRules !== null ? (p.routeRules as Record<string, unknown>) : {};
  return { input, attractions, routeRules };
}

/** Where a saved walk goes, in order: start, each stop, and back to the start for a loop. Used to preview it on the map. */
export function previewPathOf(walk: SavedWalk): Coordinates[] {
  const ok = (c: Coordinates) => Number.isFinite(c.lat) && Number.isFinite(c.lng);
  const path = [walk.start, ...walk.stops.map((s) => ({ lat: s.lat, lng: s.lng }))].filter(ok);
  const loop = (walk.params as { maxEndDistanceFromOriginMeters?: unknown } | null)?.maxEndDistanceFromOriginMeters === 0;
  return loop && ok(walk.start) && path.length > 1 ? [...path, walk.start] : path;
}

/** Signed-in browser session -> run `fn`; any failure or signed-out is swallowed (null). */
export async function withWalkClient<T>(
  fn: (client: import("@supabase/supabase-js").SupabaseClient, userId: string) => Promise<T>,
): Promise<T | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return null;
    return await fn(client, data.user.id);
  } catch {
    return null;
  }
}

export const saveBuiltWalk = (w: NewSavedWalk): Promise<string | null> =>
  withWalkClient(async (c, uid) => (await import("./saved-walks")).insertWalk(c, uid, w));

export async function updateWalk(
  id: string,
  patch: { status?: "saved" | "completed"; visibility?: "private" | "friends"; totalMin?: number; distanceM?: number },
): Promise<boolean> {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.status === "completed") row.completed_at = new Date().toISOString();
  if (patch.visibility) row.visibility = patch.visibility;
  if (patch.totalMin !== undefined) row.total_min = Math.round(patch.totalMin);
  if (patch.distanceM !== undefined) row.distance_m = Math.round(patch.distanceM);
  const ok = await withWalkClient(async (c) => !(await c.from("saved_walks").update(row).eq("id", id)).error);
  return ok === true;
}

export async function deleteWalk(id: string): Promise<boolean> {
  const ok = await withWalkClient(async (c) => !(await c.from("saved_walks").delete().eq("id", id)).error);
  return ok === true;
}
