import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import type { ToolDef } from "@/lib/llm/providers/openai-tools";
import type { AttractionCategory } from "@/lib/types";
import { getMatrix } from "@/lib/api/ors-client";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { buildCleanRoute } from "@/lib/walk/clean-route";
import { bestOrder, insideBoundary, outsideKm, pickSpread, type Boundary } from "@/lib/walk/loop-search";
import { fetchTownBoundary } from "@/lib/walk/town-boundary";
import { fetchForbiddenWays } from "@/lib/walk/forbidden-ways";
import { orsRoute } from "@/lib/walk/ors-route";

import {
  DEFAULT_PACE_MIN_PER_KM,
  visitMinutes,
  type AssistantState,
  type BuildAction,
  type Candidate,
  type WalkParams,
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
          spread: { type: "boolean", description: "true to pick results spread across the whole area instead of the nearest ones; use it when the walker wants to see the whole town" },
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
          no_repeat: { type: "boolean", description: "true when the walker said never to walk the same street twice" },
          avoid_streets: { type: "array", items: { type: "string" }, description: "street names the walker does not want to walk along, exactly as they wrote them" },
          stay_in_area: { type: "string", description: "town the whole walk must stay inside, with country, e.g. 'Caesarea, Israel'; the server checks the real route against its boundary" },
          avoid_dangerous: { type: "boolean", description: "true when the walker wants to avoid dangerous roads; the server finds them from OpenStreetMap (fast roads, no sidewalk)" },
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
      name: "offer_choices",
      description:
        "Show 2-6 tap-to-choose options (short labels in the walker's language) under your next sentence. Use it when you need the walker to pick between kinds of places or alternatives, instead of asking in free text.",
      parameters: {
        type: "object",
        properties: { options: { type: "array", items: { type: "string" } } },
        required: ["options"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Save ONE lasting fact about the walker for all future chats: a diet, a mobility limit, who they walk with, a strong like or dislike, a habit. Short phrase in the walker's language, e.g. 'does not eat meat', 'walks with a stroller'. Only things that stay true beyond this walk; never a one-off request, a place, or a limit for this walk.",
      parameters: {
        type: "object",
        properties: { fact: { type: "string" } },
        required: ["fact"],
        additionalProperties: false,
      },
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
        properties: { stop_ids: { type: "array", items: { type: "string" } }, ordered: {
              type: "boolean",
              description: "true when the walker stated an order for the stops (\"first the beach, then pizza\"); stop_ids must then be in exactly that order",
            }, },
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
        properties: { stop_ids: { type: "array", items: { type: "string" } }, ordered: {
              type: "boolean",
              description: "true when the walker stated an order for the stops (\"first the beach, then pizza\"); stop_ids must then be in exactly that order",
            }, },
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
  choices?: string[];
  /** A lasting fact Sol asked to save; the route stores it. */
  remember?: string;
}

interface Estimate {
  walkKm: number;
  walkMin: number;
  visitMin: number;
  totalMin: number;
  legs: Array<{ to: string; km: number; min: number }>;
  /** The stops in the order they are walked (not shown to the model). */
  order: Candidate[];
}

/** What a real walking route through the stops looks like against the walker's rules. */
interface RouteCheck {
  /** Only meaningful when the walker wants to end where they started. */
  endsAtStart?: boolean;
  repeatedKm: number;
  forbiddenKm: number;
  /** Roads treated as unsafe or named, so the walker can correct the list. */
  avoidedStreets: string[];
  /** Plain-language note when a rule could not be met. */
  problems: string[];
  /** Only with stay_in_area: kilometres of the route outside the town. */
  outsideKm?: number;
  /** Set when a rule fails: the stop whose removal fixes it, and what each removal would leave. */
  forcingStop?: string;
  relaxations?: Array<{ drop: string; repeatedKm: number; outsideKm?: number }>;
}

/** Rule violations of one routed attempt, in km (0 = clean). */
function badKm(repeatedKm: number, forbiddenKm: number, outside: number, params: WalkParams): number {
  return (params.noRepeat ? repeatedKm : 0) + forbiddenKm + outside;
}

/** Routes the stops for real and measures repeats, loop closure and avoided streets; null when no rule needs checking. */
async function checkRoute(origin: Candidate["coordinates"], order: Candidate[], params: WalkParams): Promise<RouteCheck | null> {
  const loop = params.endDistanceKm === 0;
  const streets = params.avoidStreets ?? [];
  if (!loop && !params.noRepeat && !params.avoidDangerous && streets.length === 0 && !params.stayInArea) return null;
  const boundary: Boundary | null = params.stayInArea ? await fetchTownBoundary(params.stayInArea) : null;
  const forbidden =
    streets.length || params.avoidDangerous
      ? await fetchForbiddenWays(origin, Math.max((params.radiusKm ?? 3) * 1500, 2000), { streets, dangerous: params.avoidDangerous })
      : [];
  const waypoints = [origin, ...order.map((s) => s.coordinates), ...(loop ? [origin] : [])];
  const forbiddenPaths = forbidden.map((w) => w.path);
  const clean = await buildCleanRoute({
    waypoints,
    route: orsRoute,
    noRepeat: params.noRepeat === true,
    forbiddenWays: forbiddenPaths,
  });
  const { repeatedKm, forbiddenKm, closesLoop } = clean.quality;
  const outside = boundary ? outsideKm(clean.geometry, boundary) : 0;
  const problems: string[] = [];
  if (boundary && outside > 0.1) problems.push(`${outside} km of the route run outside ${params.stayInArea}`);
  if (params.noRepeat && repeatedKm > 0.1) problems.push(`${repeatedKm} km of street are walked twice even after re-routing`);
  if (forbiddenKm > 0.1) problems.push(`${forbiddenKm} km run along streets they wanted to avoid`);
  if (loop && !closesLoop) problems.push("the route does not end back at the start");
  const check: RouteCheck = {
    ...(loop ? { endsAtStart: closesLoop } : {}),
    repeatedKm,
    forbiddenKm,
    ...(boundary ? { outsideKm: outside } : {}),
    avoidedStreets: [...new Set(forbidden.map((w) => w.name))].slice(0, 8),
    problems,
  };
  if (problems.length && order.length > 1 && badKm(repeatedKm, forbiddenKm, outside, params) > 0.1) {
    // Route again without each stop (one routing call each) to find which stop forces the problem.
    const relaxations: NonNullable<RouteCheck["relaxations"]> = [];
    for (let k = 0; k < order.length; k++) {
      const rest = order.filter((_, i) => i !== k);
      try {
        const alt = await buildCleanRoute({
          waypoints: [origin, ...rest.map((s) => s.coordinates), ...(loop ? [origin] : [])],
          route: orsRoute,
          noRepeat: params.noRepeat === true,
          forbiddenWays: forbiddenPaths,
          maxAttempts: 1,
        });
        relaxations.push({
          drop: order[k].name,
          repeatedKm: alt.quality.repeatedKm,
          ...(boundary ? { outsideKm: outsideKm(alt.geometry, boundary) } : {}),
        });
      } catch {
        // no route without this stop: leave it out of the list
      }
    }
    const left = (r: (typeof relaxations)[number]) => badKm(r.repeatedKm, 0, r.outsideKm ?? 0, params);
    relaxations.sort((a, b) => left(a) - left(b));
    check.relaxations = relaxations.slice(0, 3);
    if (relaxations[0] && left(relaxations[0]) <= 0.1) check.forcingStop = relaxations[0].drop;
  }
  return check;
}

/** Shortest order from the start (closing back to it when `loop`) (or the given order when `ordered`), street distances from ORS (straight line x1.3 if ORS fails). */
async function estimateWalk(
  origin: Candidate["coordinates"],
  stops: Candidate[],
  pace: number,
  ordered = false,
  loop = false,
): Promise<Estimate> {
  const points = [origin, ...stops.map((s) => s.coordinates)];
  let dist: number[][];
  try {
    const m = await getMatrix({ locations: points.map(toOrsCoord) } as Parameters<typeof getMatrix>[0]);
    dist = m.distances as number[][];
    if (!dist?.length) throw new Error("empty");
  } catch {
    dist = points.map((a) => points.map((b) => haversineDistance(a, b) * 1.3));
  }
  const sequence = ordered ? stops.map((_, i) => i + 1) : bestOrder(dist, loop);
  let at = 0;
  const legs: Estimate["legs"] = [];
  const visited: Candidate[] = [];
  let meters = 0;
  for (const best of sequence) {
    const d = dist[at][best] ?? 0;
    meters += d;
    visited.push(stops[best - 1]);
    legs.push({ to: stops[best - 1].name, km: Math.round(d / 100) / 10, min: Math.round((d / 1000) * pace) });
    at = best;
  }
  if (loop) meters += dist[at][0] ?? 0;
  const walkKm = Math.round(meters / 100) / 10;
  const walkMin = Math.round((meters / 1000) * pace);
  const visitMin = stops.reduce((sum, s) => sum + visitMinutes(s.category), 0);
  return { walkKm, walkMin, visitMin, totalMin: walkMin + visitMin, legs, order: visited };
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
      const boundary = state.params.stayInArea ? await fetchTownBoundary(state.params.stayInArea) : null;
      const inTown = boundary ? places.filter((p) => insideBoundary(p.coordinates, boundary)) : places;
      const ranked = (inTown.length ? inTown : places)
        .map((p) => ({
          id: "",
          name: p.name,
          coordinates: p.coordinates,
          category,
          placeId: p.placeId,
          distanceMeters: Math.round(haversineDistance(anchor, p.coordinates)),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
      const picked = args.spread === true ? pickSpread(ranked, wanted, anchor) : ranked.slice(0, wanted);
      const found = addCandidates(state, picked);
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
      if (typeof args.no_repeat === "boolean") state.params.noRepeat = args.no_repeat;
      if (typeof args.avoid_dangerous === "boolean") state.params.avoidDangerous = args.avoid_dangerous;
      if (typeof args.stay_in_area === "string" && args.stay_in_area.trim()) state.params.stayInArea = args.stay_in_area.trim().slice(0, 80);
      if (Array.isArray(args.avoid_streets)) {
        const streets = args.avoid_streets.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 60));
        state.params.avoidStreets = [...new Set([...(state.params.avoidStreets ?? []), ...streets])].slice(0, 10);
      }
      return { output: JSON.stringify({ ok: true, params: state.params }), state };
    }

    if (name === "ask_limits") {
      return { output: JSON.stringify({ ok: true, shown: true }), state, askLimits: true };
    }

    if (name === "offer_choices") {
      const options = Array.isArray(args.options)
        ? args.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim().slice(0, 40)).slice(0, 6)
        : [];
      if (options.length < 2) return { output: JSON.stringify({ error: "need 2-6 options" }), state };
      return { output: JSON.stringify({ ok: true, shown: true }), state, choices: options };
    }

    if (name === "remember") {
      const fact = typeof args.fact === "string" ? args.fact.trim().slice(0, 120) : "";
      if (fact.length < 3) return { output: JSON.stringify({ error: "fact too short" }), state };
      return { output: JSON.stringify({ ok: true, saved: fact }), state, remember: fact };
    }

    if (name === "estimate_walk" || name === "build_walk") {
      const ids = Array.isArray(args.stop_ids) ? args.stop_ids.filter((x): x is string => typeof x === "string") : [];
      const picked = ids
        .map((id) => state.candidates.find((c) => c.id === id))
        .filter((c): c is Candidate => Boolean(c));
      if (picked.length === 0) return { output: JSON.stringify({ error: "no valid stop ids" }), state };
      if (!state.origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      const ordered = args.ordered === true;
      const est = await estimateWalk(state.origin, picked, state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM, ordered, state.params.endDistanceKm === 0);
      const { timeMinutes, maxWalkKm } = state.params;
      const problems: string[] = [];
      if (timeMinutes && est.totalMin > timeMinutes) problems.push(`needs ${est.totalMin} min, they have ${timeMinutes}`);
      if (maxWalkKm && est.walkKm > maxWalkKm * 1.1) problems.push(`walks ${est.walkKm} km, their cap is ${maxWalkKm}`);
      if (name === "estimate_walk") {
        const { order, ...shown } = est;
        let route: RouteCheck | null = null;
        try {
          route = await checkRoute(state.origin, order, state.params);
        } catch {
          route = null; // routing is down: say nothing rather than guess
        }
        return { output: JSON.stringify({ ...shown, fits: problems.length === 0, problems, ...(route ? { route } : {}) }), state };
      }
      if (!state.limitsSettled) {
        return { output: JSON.stringify({ error: "limits not asked yet: call ask_limits first" }), state };
      }
      if (problems.length) {
        return { output: JSON.stringify({ error: "does not fit", problems, estimate: est }), state };
      }
      // The rules are enforced here, not in the prompt: build exactly the order that was checked, and only when it passes.
      let route: RouteCheck | null = null;
      try {
        route = await checkRoute(state.origin, est.order, state.params);
      } catch {
        route = null; // routing is down: the planner still warns
      }
      if (route && route.problems.length) {
        return { output: JSON.stringify({ error: "route breaks the walker's rules", route }), state };
      }
      args.stop_ids = est.order.map((s) => s.id);
      args.ordered = true;
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
        action: { type: "build", origin, params: state.params, stops, ...(args.ordered === true ? { ordered: true } : {}) },
      };
    }
  } catch {
    return { output: JSON.stringify({ error: "lookup failed, try again or say so" }), state };
  }
  return { output: JSON.stringify({ error: "unknown tool" }), state };
}
