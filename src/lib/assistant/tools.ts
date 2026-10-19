import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import type { ToolDef } from "@/lib/llm/providers/openai-tools";
import type { AttractionCategory } from "@/lib/types";
import { getMatrix } from "@/lib/api/ors-client";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";

import {
  DEFAULT_PACE_MIN_PER_KM,
  visitMinutes,
  type AssistantState,
  type BuildAction,
  type Candidate,
} from "./state";

const CATEGORIES: AttractionCategory[] = [
  "food",
  "nature",
  "park",
  "museum",
  "landmark",
  "viewpoint",
  "religious",
  "shopping",
  "entertainment",
  "other",
];

/** Most results Sol ever sees from one tool call: keeps the prompt small. */
const MAX_RESULTS_TO_MODEL = 6;
const DEFAULT_NEARBY_RADIUS_M = 2000;

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "search_place",
      description:
        "Find one named place anywhere (a landmark, a venue, a city or neighbourhood). Use the full natural name incl. the city, e.g. 'Habima Theatre Tel Aviv'. Returns up to 3 candidates with ids.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_nearby",
      description:
        "Find places of one kind (food, nature, park, museum, ...) around a point. `around` is a candidate id (e.g. a city you found) or omitted for the walk's start.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: CATEGORIES },
          around: { type: "string", description: "candidate id; omit for the start point" },
          radius_m: { type: "number" },
          count: { type: "number", description: "how many results (max 6)" },
        },
        required: ["category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_start",
      description: "Set the walk's start point to a candidate id, e.g. the city the walker says they are in.",
      parameters: {
        type: "object",
        properties: { candidate_id: { type: "string" } },
        required: ["candidate_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_walk_params",
      description:
        "Record limits the walker EXPLICITLY stated. Leave a field out when they said nothing: that means no limit. Never ask about unstated limits.",
      parameters: {
        type: "object",
        properties: {
          time_minutes: { type: "number" },
          radius_km: { type: "number" },
          end_distance_km: { type: "number" },
          max_walk_km: { type: "number", description: "cap on the total distance walked" },
          pace_min_per_km: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_limits",
      description:
        "Show the walker tap-to-choose boxes for time available, search radius, how far from the start the walk may end, and the maximum walking distance. Call it once, before build_walk, when they have not given those limits. Then write one short sentence inviting them to choose.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_walk",
      description:
        "Estimate walking distance, walking minutes, visiting minutes and total time for visiting these stops from the start (real street distances, average pace). Use it to check the stops fit the walker's limits before build_walk.",
      parameters: {
        type: "object",
        properties: { stop_ids: { type: "array", items: { type: "string" } } },
        required: ["stop_ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_walk",
      description:
        "Build and show the walk. Call only after the walker confirmed the stops. `stop_ids` are candidate ids in the order proposed.",
      parameters: {
        type: "object",
        properties: { stop_ids: { type: "array", items: { type: "string" } } },
        required: ["stop_ids"],
        additionalProperties: false,
      },
    },
  },
];

export interface ToolRun {
  /** Compact JSON string handed back to the model. */
  output: string;
  state: AssistantState;
  action?: BuildAction;
  askLimits?: boolean;
}

interface Estimate {
  walkKm: number;
  walkMin: number;
  visitMin: number;
  totalMin: number;
  legs: Array<{ to: string; km: number; min: number }>;
}

/** Nearest-neighbour order from the start, street distances from ORS (straight line x1.3 if ORS fails). */
async function estimateWalk(origin: Candidate["coordinates"], stops: Candidate[], pace: number): Promise<Estimate> {
  const points = [origin, ...stops.map((s) => s.coordinates)];
  let dist: number[][];
  try {
    const m = await getMatrix({ locations: points.map(toOrsCoord) } as Parameters<typeof getMatrix>[0]);
    dist = m.distances as number[][];
    if (!dist?.length) throw new Error("empty");
  } catch {
    dist = points.map((a) => points.map((b) => haversineDistance(a, b) * 1.3));
  }
  const left = new Set(stops.map((_, i) => i + 1));
  let at = 0;
  const legs: Estimate["legs"] = [];
  let meters = 0;
  while (left.size) {
    let best = -1;
    for (const j of left) if (best < 0 || (dist[at][j] ?? Infinity) < (dist[at][best] ?? Infinity)) best = j;
    const d = dist[at][best] ?? 0;
    meters += d;
    legs.push({ to: stops[best - 1].name, km: Math.round(d / 100) / 10, min: Math.round((d / 1000) * pace) });
    left.delete(best);
    at = best;
  }
  const walkKm = Math.round(meters / 100) / 10;
  const walkMin = Math.round((meters / 1000) * pace);
  const visitMin = stops.reduce((sum, s) => sum + visitMinutes(s.category), 0);
  return { walkKm, walkMin, visitMin, totalMin: walkMin + visitMin, legs };
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function addCandidates(state: AssistantState, found: Candidate[]): Candidate[] {
  const known = new Map(state.candidates.map((c) => [c.placeId, c]));
  const result: Candidate[] = [];
  let next = state.candidates.length;
  for (const c of found) {
    const existing = known.get(c.placeId);
    if (existing) {
      result.push(existing);
      continue;
    }
    const withId = { ...c, id: `c${++next}` };
    state.candidates.push(withId);
    known.set(c.placeId, withId);
    result.push(withId);
  }
  return result;
}

/** What the model sees: id, name, kind, distance. Coordinates stay on the server. */
function compact(list: Candidate[]): string {
  return JSON.stringify(
    list.slice(0, MAX_RESULTS_TO_MODEL).map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.category,
      ...(c.distanceMeters !== undefined ? { dist_m: c.distanceMeters } : {}),
    })),
  );
}

/** Runs one tool call against the state. Never throws: a failure is an answer the model can read. */
export async function runTool(
  name: string,
  rawArgs: string,
  input: AssistantState,
): Promise<ToolRun> {
  const state: AssistantState = {
    ...input,
    params: { ...input.params },
    candidates: [...input.candidates],
    chosen: [...input.chosen],
  };
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    return { output: JSON.stringify({ error: "bad arguments" }), state };
  }

  try {
    if (name === "search_place") {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
      if (!query) return { output: JSON.stringify({ error: "query required" }), state };
      const places = await searchTextPlaces(query, state.origin ?? undefined, 3);
      const found = addCandidates(
        state,
        places.map((p) => ({
          id: "",
          name: p.name,
          coordinates: p.coordinates,
          category: "other" as const,
          placeId: p.placeId,
          distanceMeters: state.origin
            ? Math.round(haversineDistance(state.origin, p.coordinates))
            : undefined,
        })),
      );
      return { output: found.length ? compact(found) : JSON.stringify({ error: "nothing found" }), state };
    }

    if (name === "find_nearby") {
      const category = CATEGORIES.find((c) => c === args.category);
      if (!category) return { output: JSON.stringify({ error: "unknown category" }), state };
      const anchor =
        typeof args.around === "string"
          ? state.candidates.find((c) => c.id === args.around)?.coordinates
          : state.origin;
      if (!anchor) {
        return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      }
      const radius =
        num(args.radius_m) ??
        (state.params.radiusKm ? state.params.radiusKm * 1000 : DEFAULT_NEARBY_RADIUS_M);
      const wanted = Math.min(MAX_RESULTS_TO_MODEL, Math.round(num(args.count) ?? 3));
      const places = await searchNearbyPlaces(category, anchor, radius);
      const ranked = places
        .map((p) => ({
          id: "",
          name: p.name,
          coordinates: p.coordinates,
          category,
          placeId: p.placeId,
          distanceMeters: Math.round(haversineDistance(anchor, p.coordinates)),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, wanted);
      const found = addCandidates(state, ranked);
      return { output: found.length ? compact(found) : JSON.stringify({ error: "nothing found" }), state };
    }

    if (name === "set_start") {
      const c = state.candidates.find((x) => x.id === args.candidate_id);
      if (!c) return { output: JSON.stringify({ error: "unknown candidate id" }), state };
      state.origin = c.coordinates;
      return { output: JSON.stringify({ ok: true, start: c.name }), state };
    }

    if (name === "set_walk_params") {
      const t = num(args.time_minutes);
      const r = num(args.radius_km);
      const e = typeof args.end_distance_km === "number" && args.end_distance_km >= 0 ? args.end_distance_km : undefined;
      const p = num(args.pace_min_per_km);
      const w = num(args.max_walk_km);
      if (w) state.params.maxWalkKm = w;
      state.limitsSettled = true;
      if (t) state.params.timeMinutes = t;
      if (r) state.params.radiusKm = r;
      if (e !== undefined) state.params.endDistanceKm = e;
      if (p) state.params.paceMinPerKm = p;
      return { output: JSON.stringify({ ok: true, params: state.params }), state };
    }

    if (name === "ask_limits") {
      return { output: JSON.stringify({ ok: true, shown: true }), state, askLimits: true };
    }

    if (name === "estimate_walk" || name === "build_walk") {
      const ids = Array.isArray(args.stop_ids) ? args.stop_ids.filter((x): x is string => typeof x === "string") : [];
      const picked = ids
        .map((id) => state.candidates.find((c) => c.id === id))
        .filter((c): c is Candidate => Boolean(c));
      if (picked.length === 0) return { output: JSON.stringify({ error: "no valid stop ids" }), state };
      if (!state.origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      const est = await estimateWalk(state.origin, picked, state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM);
      const { timeMinutes, maxWalkKm } = state.params;
      const problems: string[] = [];
      if (timeMinutes && est.totalMin > timeMinutes) problems.push(`needs ${est.totalMin} min, they have ${timeMinutes}`);
      if (maxWalkKm && est.walkKm > maxWalkKm * 1.1) problems.push(`walks ${est.walkKm} km, their cap is ${maxWalkKm}`);
      if (name === "estimate_walk") {
        return { output: JSON.stringify({ ...est, fits: problems.length === 0, problems }), state };
      }
      if (!state.limitsSettled) {
        return { output: JSON.stringify({ error: "limits not asked yet: call ask_limits first" }), state };
      }
      if (problems.length) {
        return { output: JSON.stringify({ error: "does not fit", problems, estimate: est }), state };
      }
    }

    if (name === "build_walk") {
      const ids = Array.isArray(args.stop_ids) ? args.stop_ids.filter((x): x is string => typeof x === "string") : [];
      const stops = ids
        .map((id) => state.candidates.find((c) => c.id === id))
        .filter((c): c is Candidate => Boolean(c));
      if (stops.length === 0) return { output: JSON.stringify({ error: "no valid stop ids" }), state };
      const origin = state.origin;
      if (!origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      state.chosen = stops.map((s) => s.id);
      return {
        output: JSON.stringify({ ok: true, building: stops.map((s) => s.name) }),
        state,
        action: { type: "build", origin, params: state.params, stops },
      };
    }
  } catch {
    return { output: JSON.stringify({ error: "lookup failed, try again or say so" }), state };
  }
  return { output: JSON.stringify({ error: "unknown tool" }), state };
}
