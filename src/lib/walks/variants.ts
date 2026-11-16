import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { DEFAULT_PACE_MIN_PER_KM } from "@/lib/walk/pace";

import type { SavedStop, SavedWalk, NewSavedWalk, VariantKind } from "./saved-walks";
import { isLoopWalk, stopsForJoin } from "./walk-again";

export type VariantRequest =
  | { kind: "reverse" }
  | { kind: "start_here" | "start_at"; at: Coordinates }
  | { kind: "skip_stop"; stopName: string }
  | { kind: "shorter"; minutes: number };

/** What the router says about a route through some waypoints. */
export interface RoutedLine {
  geometry: Coordinates[];
  distanceM: number;
  /** Total climb, null when the router gave no heights. */
  ascentM: number | null;
}
export type RouteFn = (waypoints: Coordinates[]) => Promise<RoutedLine>;

export interface VariantDraft extends NewSavedWalk {
  geometry: Coordinates[];
  end: Coordinates;
  isLoop: boolean;
  parentWalkId: string;
  variantKind: VariantKind;
  /** Climb of the new route (not stored; shown to the walker). */
  ascentM: number | null;
}

export type VariantOutcome = { ok: true; draft: VariantDraft } | { ok: false; needsAi?: boolean; error: string };

const DEFAULT_VISIT_MIN = 10;
/** A straight line understates a street route; this is the usual factor for a rough, router-free estimate. */
const DETOUR = 1.3;

const LABELS = {
  en: { reverse: "reversed", shorter: "shorter", start_here: "from here", start_at: "from a new start", skip_stop: (n: string) => `without ${n}` },
  he: { reverse: "הפוך", shorter: "קצר יותר", start_here: "מכאן", start_at: "מנקודה אחרת", skip_stop: (n: string) => `בלי ${n}` },
} as const;

const hebrew = (s: string) => /[֐-׿]/.test(s);

function titleFor(walk: SavedWalk, req: VariantRequest): string {
  const l = hebrew(walk.title) ? LABELS.he : LABELS.en;
  const suffix = req.kind === "skip_stop" ? l.skip_stop(req.stopName.slice(0, 30)) : l[req.kind];
  return `${walk.title} · ${suffix}`.slice(0, 120);
}

const paceOf = (walk: SavedWalk): number => {
  const p = walk.params?.walkingPaceMinPerKm;
  return typeof p === "number" && p > 0 ? p : DEFAULT_PACE_MIN_PER_KM;
};

const visitMin = (s: SavedStop) => (typeof s.visitMinutes === "number" && s.visitMinutes >= 0 ? s.visitMinutes : DEFAULT_VISIT_MIN);

/** The waypoints of a walk: start, each stop, and the end (the start again for a loop). */
export function waypointsOf(start: Coordinates, stops: SavedStop[], end: Coordinates): Coordinates[] {
  return [start, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), end];
}

/** Router-free estimate of a walk's minutes, to decide what to drop before routing once. */
export function estimateMinutes(waypoints: Coordinates[], stops: SavedStop[], pace: number): number {
  let meters = 0;
  for (let i = 1; i < waypoints.length; i += 1) meters += haversineDistance(waypoints[i - 1], waypoints[i]) * DETOUR;
  return (meters / 1000) * pace + stops.reduce((sum, s) => sum + visitMin(s), 0);
}

/**
 * Make a variant of a walk, deterministically. The route is ALWAYS re-routed through the new waypoints:
 * a reversed line is not the original polyline backwards (one-way footpaths, steps and turn restrictions
 * differ, and the climb flips), so time, distance and climb are recomputed from the router.
 * The parent is never touched: the result is a new walk that points at it.
 */
export async function makeVariant(walk: SavedWalk, req: VariantRequest, route: RouteFn): Promise<VariantOutcome> {
  if (walk.stops.length === 0) return { ok: false, error: "the walk has no stops" };
  const loop = isLoopWalk(walk);
  const originalEnd = walk.end ?? (loop ? walk.start : { lat: walk.stops[walk.stops.length - 1].lat, lng: walk.stops[walk.stops.length - 1].lng });
  const pace = paceOf(walk);

  let start = walk.start;
  let end = originalEnd;
  let stops = walk.stops;

  if (req.kind === "reverse") {
    stops = [...walk.stops].reverse();
    if (!loop) {
      start = originalEnd;
      end = walk.start;
    }
  } else if (req.kind === "start_here" || req.kind === "start_at") {
    const ahead = stopsForJoin(walk, req.at);
    if (ahead.length === 0) return { ok: false, error: "no stops are left from there" };
    stops = ahead;
    start = req.at;
    end = loop ? req.at : originalEnd;
  } else if (req.kind === "skip_stop") {
    const needle = req.stopName.trim().toLowerCase();
    const index = walk.stops.findIndex((s) => s.name.toLowerCase() === needle) >= 0
      ? walk.stops.findIndex((s) => s.name.toLowerCase() === needle)
      : walk.stops.findIndex((s) => s.name.toLowerCase().includes(needle));
    if (index < 0) return { ok: false, error: "no stop with that name" };
    if (walk.stops.length === 1) return { ok: false, error: "that is the only stop" };
    stops = walk.stops.filter((_, i) => i !== index);
  } else if (req.kind === "shorter") {
    if (!(req.minutes > 0)) return { ok: false, error: "no target time" };
    let kept = [...walk.stops];
    // Drop the stop whose removal saves the most (its visit and the detour to it), until the estimate fits.
    while (kept.length > 1 && estimateMinutes(waypointsOf(start, kept, end), kept, pace) > req.minutes) {
      let best = 0;
      let bestSaved = -Infinity;
      kept.forEach((_, i) => {
        const rest = kept.filter((__, j) => j !== i);
        const saved = estimateMinutes(waypointsOf(start, kept, end), kept, pace) - estimateMinutes(waypointsOf(start, rest, end), rest, pace);
        if (saved > bestSaved) {
          bestSaved = saved;
          best = i;
        }
      });
      kept = kept.filter((_, i) => i !== best);
    }
    if (estimateMinutes(waypointsOf(start, kept, end), kept, pace) > req.minutes) {
      return { ok: false, needsAi: true, error: "dropping stops cannot reach that time; ask for a new, shorter walk instead" };
    }
    if (kept.length === walk.stops.length) return { ok: false, error: "the walk already fits that time" };
    stops = kept;
  }

  let routed: RoutedLine;
  try {
    routed = await route(waypointsOf(start, stops, end));
  } catch {
    return { ok: false, error: "the route could not be drawn right now" };
  }
  if (routed.geometry.length < 2) return { ok: false, error: "the route could not be drawn right now" };

  const totalMin = Math.round((routed.distanceM / 1000) * pace + stops.reduce((sum, s) => sum + visitMin(s), 0));
  return {
    ok: true,
    draft: {
      title: titleFor(walk, req),
      start,
      stops,
      end,
      isLoop: loop,
      geometry: routed.geometry,
      status: "planned",
      areaLabel: walk.areaLabel,
      totalMin,
      distanceM: Math.round(routed.distanceM),
      params: { ...walk.params },
      visibility: "private",
      parentWalkId: walk.id,
      variantKind: req.kind,
      ascentM: routed.ascentM,
    },
  };
}
