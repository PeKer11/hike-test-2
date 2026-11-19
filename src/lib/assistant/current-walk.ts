import { cleanUntrustedText } from "@/lib/llm/sanitize";
import { haversineDistance } from "@/lib/utils/geo";
import type { Coordinates } from "@/lib/types";
import type { AssistantState, Candidate } from "./state";
import { parseOrigin } from "./stored-state";

/** The walk the walker sees on the map, as the client describes it. Per turn only; never stored. */
export interface CurrentWalk {
  source: "plan" | "saved" | "walking";
  start: Coordinates;
  stops: { name: string; coordinates: Coordinates; category?: string }[];
  totalMin?: number;
  remainingMin?: number;
  pace?: PaceInfo;
}

/** Plan pace vs the walker's measured pace; spareMin is signed (positive = ahead of the time limit). */
export interface PaceInfo {
  plannedMinPerKm: number;
  measuredKmh?: number;
  spareMin?: number;
}

const SOURCES = new Set(["plan", "saved", "walking"]);
const KINDS = new Set(["landmark", "museum", "park", "food", "viewpoint", "religious", "shopping", "entertainment", "nature"]);
const MAX_STOPS = 12;
const SAME_PLACE_M = 40;

const minutes = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1440 ? Math.round(v) : undefined);

const parsePace = (v: unknown): PaceInfo | undefined => {
  if (typeof v !== "object" || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const planned = r.plannedMinPerKm;
  if (typeof planned !== "number" || !Number.isFinite(planned) || planned < 3 || planned > 90) return undefined;
  const kmh = typeof r.measuredKmh === "number" && Number.isFinite(r.measuredKmh) && r.measuredKmh >= 0.5 && r.measuredKmh <= 20 ? Math.round(r.measuredKmh * 10) / 10 : undefined;
  const spare = typeof r.spareMin === "number" && Number.isFinite(r.spareMin) && Math.abs(r.spareMin) <= 1440 ? Math.round(r.spareMin) : undefined;
  return { plannedMinPerKm: Math.round(planned * 10) / 10, ...(kmh !== undefined ? { measuredKmh: kmh } : {}), ...(spare !== undefined ? { spareMin: spare } : {}) };
};

/** Validates what the client sent. Anything off is dropped; null when there is no usable walk. */
export function parseCurrentWalk(value: unknown): CurrentWalk | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.source !== "string" || !SOURCES.has(v.source)) return null;
  const start = parseOrigin(v.start);
  if (!start || !Array.isArray(v.stops)) return null;
  const stops: CurrentWalk["stops"] = [];
  for (const raw of v.stops.slice(0, MAX_STOPS)) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const coordinates = parseOrigin(r.coordinates);
    const name = typeof r.name === "string" ? cleanUntrustedText(r.name, 120) : "";
    if (!coordinates || !name) continue;
    stops.push({ name, coordinates, ...(typeof r.category === "string" ? { category: r.category } : {}) });
  }
  if (stops.length === 0) return null;
  return { source: v.source as CurrentWalk["source"], start, stops, totalMin: minutes(v.totalMin), remainingMin: minutes(v.remainingMin), pace: parsePace(v.pace) };
}

/** Gives each stop on the map a candidate id (reusing one within 40 m) and makes them the chosen walk. */
export function seedCurrentWalk(state: AssistantState, walk: CurrentWalk): AssistantState {
  const candidates = [...state.candidates];
  let next = candidates.reduce((max, c) => Math.max(max, Number(/^c(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
  const ids: string[] = [];
  for (const stop of walk.stops) {
    const same = candidates.find((c) => haversineDistance(c.coordinates, stop.coordinates) <= SAME_PLACE_M);
    if (same) {
      ids.push(same.id);
      continue;
    }
    next += 1;
    const c: Candidate = {
      id: `c${next}`,
      name: stop.name,
      coordinates: stop.coordinates,
      category: (stop.category && KINDS.has(stop.category) ? stop.category : "other") as Candidate["category"],
      placeId: `walk:${stop.coordinates.lat.toFixed(5)},${stop.coordinates.lng.toFixed(5)}`,
    };
    candidates.push(c);
    ids.push(c.id);
  }
  return {
    ...state,
    candidates,
    chosen: ids,
    current: { ids, source: walk.source, totalMin: walk.totalMin, remainingMin: walk.remainingMin, pace: walk.pace },
  };
}

/** One line for the fenced background: what is on the map now, and what "extend" means. */
export function currentWalkNote(state: AssistantState): string {
  const cur = state.current;
  if (!cur) return "";
  const named = cur.ids.map((id) => `${id} ${state.candidates.find((c) => c.id === id)?.name ?? ""}`.trim()).join("; ");
  const time = cur.totalMin !== undefined ? `, about ${cur.totalMin} min${cur.remainingMin !== undefined ? ` (${cur.remainingMin} min of it left)` : ""}` : "";
  const p = cur.pace;
  const paceNote = p
    ? ` Pace: the walk is planned at ${Math.round((60 / p.plannedMinPerKm) * 10) / 10} km/h (${p.plannedMinPerKm} min/km)${p.measuredKmh !== undefined ? `; the walker is actually moving at ${p.measuredKmh} km/h` : ""}.` +
      (p.spareMin !== undefined && Math.abs(p.spareMin) >= 8
        ? p.spareMin > 0
          ? ` Spare time: +${p.spareMin} min (ahead of plan): offer to extend or add a stop, NEVER to shorten.`
          : ` Spare time: ${p.spareMin} min (behind plan): offer more time or skipping one stop, never adding a stop.`
        : "")
    : "";
  return `\nThe walk on the map now (${cur.source}): stops in order: ${named}${time}. "Extend", "longer" or "I have another hour" mean THIS walk: keep these ids in this order, call set_walk_params with add_minutes, find_nearby around the last stop for the added time, then estimate_walk and build_walk with these ids first and the new ones after (ordered=true) in the same turn.${paceNote}`;
}
