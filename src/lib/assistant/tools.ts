import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import type { ToolDef } from "@/lib/llm/providers/openai-tools";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import { appUserAgent } from "@/lib/api/http-identity";
import { HAZARD_ATTRIBUTION, HAZARD_RADIUS_KM, hazardUrl, parseHazardCounts, seasonalNotes } from "@/lib/safety/nature-hazards";
import { inSafetyCoverage, parseWarnings, SAFETY_ATTRIBUTION, SAFETY_FEED_URL, warningsAt } from "@/lib/safety/meteoalarm";
import { assessWalkWindow, endsAfterDark, FORECAST_ATTRIBUTION, forecastUrl, nextDryStart, parseForecast, parseSunsets } from "@/lib/weather/forecast";
import { getMatrix } from "@/lib/api/ors-client";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { bestOrder, insideBoundary, pickSpread } from "@/lib/walk/loop-search";
import { fetchTownBoundary } from "@/lib/walk/town-boundary";
import { searchPlaces } from "@/lib/api/nominatim-client";
import { fetchForbiddenWays } from "@/lib/walk/forbidden-ways";
import { makeBudget, matrixCoolingDown, noteMatrixError, type RoutingBudget } from "@/lib/walk/routing-budget";
import { brokenKm, limitRules, makeVerdict, type RuleResult, type Verdict } from "@/lib/walk/rule-verdict";
import { formatRecalledWalks, type LoadWalks } from "./recall-walks";
import { loadEnv, needsRouteCheck, routeAndJudge, TURN_ROUTING_CALLS, type Judged } from "./route-check";

import {
  DEFAULT_PACE_MIN_PER_KM,
  visitMinutes,
  type AssistantState,
  type BuildAction,
  placeScore,
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
/** find_clean_walk: places considered, combinations scanned, and sets routed for real (each costs 1-2 routing calls). */
const SEARCH_POOL_MAX = 18;
/** A place with no rating counts as this (see placeScore); one star of rating is worth about this many metres of distance. */
const RATING_PRIOR_SCORE = 4.0;
const RATING_M_PER_STAR = 400;
/** Sets whose smallest gap between stops differs by less than this count as equally spread out, so rating decides. */
const SPACING_BUCKET_M = 150;
const SEARCH_COMBOS_MAX = 20000;
const SEARCH_ROUTE_BUDGET = 8;

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
          via_streets: { type: "array", items: { type: "string" }, description: "streets the walker wants the walk to go along; used by find_clean_walk" },
          stay_in_area: { type: "string", description: "town the whole walk must stay inside, with country, e.g. 'Caesarea, Israel'; the server checks the real route against its boundary" },
          clear: { type: "array", items: { type: "string", enum: ["no_repeat", "stay_in_area", "avoid_streets", "avoid_dangerous", "via_streets", "time", "max_walk", "loop", "end_distance"] }, description: "rules the walker gives up: they are removed" },
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
      name: "check_weather",
      description:
        "Check the hourly forecast at the start point for the hours the walk will take. Call it once after estimate_walk and before build_walk (and again if the walker changes the time available or says they start later). Returns `issues` (rain, thunderstorm, heat, cold, wind) with the walk hour they hit.",
      parameters: {
        type: "object",
        properties: {
          start_in_hours: { type: "number", description: "hours from now until the walk starts; 0 when they start now" },
          duration_minutes: { type: "number", description: "the walk's totalMin from estimate_walk; defaults to the time limit" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_safety",
      description:
        "Check official severe-weather warnings (thunderstorm, flood, heat, fire, wind, sea) covering the start point now or during the walk. Call it together with check_weather. Israel only; elsewhere it says no source is available.",
      parameters: {
        type: "object",
        properties: {
          start_in_hours: { type: "number", description: "hours from now until the walk starts; 0 when they start now" },
          duration_minutes: { type: "number", description: "the walk's totalMin from estimate_walk; defaults to the time limit" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_nature_hazards",
      description:
        "Wildlife and seasonal nuisances near the start point for the month of the walk (vipers, scorpions, wild boar, jackals, porcupines, ticks, sand flies, jellyfish season). Call it with check_weather for walks outdoors in nature. Report the record counts as 'N records within 5 km' and never say an area has no snakes or is safe, even when the count is 0.",
      parameters: {
        type: "object",
        properties: { start_in_hours: { type: "number", description: "hours from now until the walk starts; 0 when they start now" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_walks",
      description:
        "The walker's own saved walks, newest first, with stop names and categories. Call it first for 'like yesterday', 'like my last walks', 'other X instead'. Returns an error when none are saved: then say no saved walks were found; never invent history.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "how many walks (1-10, default 5)" },
          contains: { type: "string", description: "optional text the walk title or a stop name must contain" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_clean_walk",
      description:
        "Search the places found so far for a set of stops whose real walking loop meets the walker's rules (no street twice, inside the town, time and distance limits). Use it when the walker wants N stops with such rules, or when estimate_walk reports problems and swapping by hand is not working. Needs the start set and enough places found (call find_nearby for several kinds first, ideally 15+ places). Returns stop_ids to pass to estimate_walk and build_walk.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "how many stops in total (2-6)" },
          must_ids: { type: "array", items: { type: "string" }, description: "candidate ids that must be in the walk" },
        },
        required: ["count"],
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
  /** True when the distances are straight-line estimates (the matrix service was unavailable). */
  approx: boolean;
}

/** Identifies a set of stops under the current rules, so a check made for it can be reused. */
function checkKey(ids: string[], params: WalkParams, ordered: boolean): string {
  return `${ordered ? ids.join(",") : [...ids].sort().join(",")}|${ordered}|${JSON.stringify(params)}`;
}

/** Keeps the last few checks (verdict + order) so build_walk does not route again. */
function rememberCheck(state: AssistantState, ids: string[], ordered: boolean, judged: Judged): NonNullable<AssistantState["checks"]> {
  const key = checkKey(ids, state.params, ordered);
  const geometry = judged.geometry?.map((p) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 }));
  const older = (state.checks ?? []).filter((c) => c.key !== key).map((c) => ({ key: c.key, verdict: c.verdict, orderIds: c.orderIds }));
  return [{ key, verdict: judged.verdict, orderIds: judged.orderIds, ...(geometry ? { geometry } : {}) }, ...older].slice(0, 3);
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
  let approx = false;
  try {
    if (matrixCoolingDown()) throw new Error("matrix cooling down");
    const m = await getMatrix({ locations: points.map(toOrsCoord) } as Parameters<typeof getMatrix>[0]);
    dist = m.distances as number[][];
    if (!dist?.length) throw new Error("empty");
  } catch (err) {
    noteMatrixError(err);
    approx = true;
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
  return { walkKm, walkMin, visitMin, totalMin: walkMin + visitMin, legs, order: visited, approx };
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
      if (existing.rating === undefined && c.rating !== undefined) {
        existing.rating = c.rating;
        existing.ratingCount = c.ratingCount;
      }
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
      ...(c.rating !== undefined ? { google_rating: Math.round(c.rating * 10) / 10, google_reviews: c.ratingCount } : {}),
      ...(c.openNow === false ? { closed_now: true } : {}),
    })),
  );
}

/** Runs one tool call against the state. Never throws: a failure is an answer the model can read. */
/** Longer than this is almost certainly a wrong start or place, not a walk. */
const MAX_PLAUSIBLE_WALK_KM = 30;

export async function runTool(
  name: string,
  rawArgs: string,
  input: AssistantState,
  /** Directions calls shared by every tool of one assistant turn (ORS allows ~40 a minute). */
  budget: RoutingBudget = makeBudget(TURN_ROUTING_CALLS),
  /** Loads the signed-in walker's saved walks; absent for guests. */
  loadWalks?: LoadWalks,
): Promise<ToolRun> {
  let notChecked: RuleResult[] = [];
  let builtVerdict: Verdict | undefined;
  let builtGeometry: Coordinates[] | undefined;
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
        (typeof args.around === "string" ? state.candidates.find((c) => c.id === args.around)?.coordinates : undefined) ??
        state.origin;
      if (!anchor) {
        return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      }
      const radius =
        num(args.radius_m) ??
        (state.params.radiusKm ? state.params.radiusKm * 1000 : DEFAULT_NEARBY_RADIUS_M);
      const wanted = Math.min(MAX_RESULTS_TO_MODEL, Math.round(num(args.count) ?? 3));
      const avoid = state.avoid;
      const places = (await searchNearbyPlaces(category, anchor, radius, 20, true)).filter(
        (p) => !avoid?.placeIds.includes(p.placeId) && !avoid?.spots.some((s) => haversineDistance(s, p.coordinates) <= 40),
      );
      const boundary = state.params.stayInArea ? await fetchTownBoundary(state.params.stayInArea) : null;
      const inTown = boundary ? places.filter((p) => insideBoundary(p.coordinates, boundary)) : places;
      // Never quietly hand back places outside the town the walker asked to stay in.
      if (boundary && inTown.length === 0 && places.length > 0) {
        return { output: JSON.stringify({ error: `no ${category} places found inside ${state.params.stayInArea}: tell the walker, do not use places outside it` }), state };
      }
      const ranked = inTown
        .map((p) => ({
          id: "",
          name: p.name,
          coordinates: p.coordinates,
          category,
          placeId: p.placeId,
          distanceMeters: Math.round(haversineDistance(anchor, p.coordinates)),
          ...(p.rating !== undefined ? { rating: p.rating, ratingCount: p.ratingCount } : {}),
          ...(p.openNow === false ? { openNow: false } : {}),
        }))
        // Near first; a better-rated place may edge ahead (one star is worth about 400 m), but only inside the radius that was asked for.
        .sort((a, b) => a.distanceMeters - (placeScore(a) - RATING_PRIOR_SCORE) * RATING_M_PER_STAR - (b.distanceMeters - (placeScore(b) - RATING_PRIOR_SCORE) * RATING_M_PER_STAR));
      const picked = args.spread === true ? pickSpread(ranked, wanted, anchor) : ranked.slice(0, wanted);
      const found = addCandidates(state, picked);
      const unchecked = state.params.stayInArea && !boundary ? `\nNOTE: the outline of ${state.params.stayInArea} could not be found, so these places were not checked against it: tell the walker.` : "";
      return { output: found.length ? compact(found) + unchecked : JSON.stringify({ error: "nothing found" }), state };
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
      if (Array.isArray(args.via_streets)) {
        const via = args.via_streets.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 60));
        state.params.viaStreets = [...new Set([...(state.params.viaStreets ?? []), ...via])].slice(0, 4);
      }
      if (typeof args.stay_in_area === "string" && args.stay_in_area.trim()) state.params.stayInArea = args.stay_in_area.trim().slice(0, 80);
      if (Array.isArray(args.avoid_streets)) {
        const streets = args.avoid_streets.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 60));
        state.params.avoidStreets = [...new Set([...(state.params.avoidStreets ?? []), ...streets])].slice(0, 10);
      }
      const cleared: string[] = [];
      const ignored: string[] = [];
      for (const rule of Array.isArray(args.clear) ? args.clear : []) {
        if (rule === "no_repeat") delete state.params.noRepeat;
        else if (rule === "stay_in_area") delete state.params.stayInArea;
        else if (rule === "avoid_streets") delete state.params.avoidStreets;
        else if (rule === "avoid_dangerous") delete state.params.avoidDangerous;
        else if (rule === "via_streets") delete state.params.viaStreets;
        else if (rule === "time_minutes" || rule === "time") delete state.params.timeMinutes;
        else if (rule === "max_walk_km" || rule === "max_walk") delete state.params.maxWalkKm;
        else if (rule === "loop" || rule === "end_distance") delete state.params.endDistanceKm;
        else {
          ignored.push(String(rule));
          continue;
        }
        cleared.push(String(rule));
      }
      return { output: JSON.stringify({ ok: true, params: state.params, cleared, ...(ignored.length ? { ignored } : {}) }), state };
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

    if (name === "find_clean_walk") {
      const origin = state.origin;
      if (!origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      const count = Math.min(6, Math.max(2, Math.round(num(args.count) ?? 5)));
      const must = (Array.isArray(args.must_ids) ? args.must_ids : [])
        .map((id) => state.candidates.find((c) => c.id === id))
        .filter((c): c is Candidate => Boolean(c))
        .slice(0, count);
      // Streets the walk must go along: one point on the nearest matching street becomes a zero-minute stop.
      const missingVia: string[] = [];
      const viaBoundary = state.params.stayInArea ? await fetchTownBoundary(state.params.stayInArea) : null;
      const realMust = must.length;
      for (const street of state.params.viaStreets ?? []) {
        let point = state.candidates.find((c) => c.placeId === `via:${street}`);
        if (!point) {
          const ways = (await fetchForbiddenWays(origin, 3000, { streets: [street] })).filter((w) => w.path.length >= 2);
          const near = ways.sort((a, b) => haversineDistance(origin, a.path[0]) - haversineDistance(origin, b.path[0]))[0];
          let at: Candidate["coordinates"] | undefined = near?.path[Math.floor(near.path.length / 2)];
          if (!at) {
            // The map-data service may be down: Nominatim can still place a street near the start.
            try {
              const hit = (await searchPlaces(state.params.stayInArea ? `${street}, ${state.params.stayInArea}` : street, 1, origin))[0];
              at = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : undefined;
            } catch {
              at = undefined;
            }
          }
          // Street names repeat from town to town: a hit outside the town the walker named is the wrong street.
          if (at && viaBoundary && !insideBoundary(at, viaBoundary)) at = undefined;
          if (!at) {
            missingVia.push(street);
            continue;
          }
          point = addCandidates(state, [{ id: "", name: street, coordinates: at, category: "area", placeId: `via:${street}` }])[0];
        }
        must.push(point);
      }
      const env = await loadEnv(origin, state.params);
      const boundary = env.boundary;
      const loop = state.params.endDistanceKm === 0;
      const pool = state.candidates
        .filter((c) => c.category !== "area" && !must.includes(c) && haversineDistance(origin, c.coordinates) > 150 && (!boundary || insideBoundary(c.coordinates, boundary)))
        .sort((a, b) => haversineDistance(origin, a.coordinates) - haversineDistance(origin, b.coordinates))
        .slice(0, SEARCH_POOL_MAX);
      const need = count - realMust; // via points are not stops the walker counts
      if (pool.length < need) {
        return { output: JSON.stringify({ error: `only ${pool.length + must.length} usable places found; call find_nearby for more kinds first` }), state };
      }
      const all = [...must, ...pool];
      const spots = [origin, ...all.map((c) => c.coordinates)];
      let full: number[][];
      let approx = false;
      try {
        if (matrixCoolingDown()) throw new Error("matrix cooling down");
        const m = await getMatrix({ locations: spots.map(toOrsCoord) } as Parameters<typeof getMatrix>[0]);
        full = m.distances as number[][];
      } catch (err) {
        // Matrix quota used up or service down: straight lines x1.3 order the sets; the real routes below are still checked.
        noteMatrixError(err);
        approx = true;
        full = spots.map((a) => spots.map((b) => haversineDistance(a, b) * 1.3));
      }
      const pace = state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM;
      const { timeMinutes, maxWalkKm } = state.params;
      // Every combination of the pool, ordered as a loop; keep those within the limits, most spread out first.
      const scored: Array<{ idx: number[]; spacing: number; rating: number }> = [];
      let closest: { idx: number[]; over: number } | null = null;
      const consider = (chosen: number[]) => {
        const idx = [...must.map((_, i) => i + 1), ...chosen.map((i) => i + 1 + must.length)];
        const sub = [0, ...idx].map((a) => [0, ...idx].map((b) => full[a]?.[b] ?? Infinity));
        const order = bestOrder(sub, loop).map((i) => idx[i - 1]);
        let at = 0;
        let meters = 0;
        for (const j of order) {
          meters += full[at]?.[j] ?? Infinity;
          at = j;
        }
        if (loop) meters += full[at]?.[0] ?? Infinity;
        const visit = idx.reduce((s, i) => s + visitMinutes(all[i - 1].category), 0);
        const over = Math.max(maxWalkKm ? meters / (maxWalkKm * 1100) : 0, timeMinutes ? ((meters / 1000) * pace + visit) / timeMinutes : 0);
        if (over > 1) {
          // Nothing may fit: keep the set that overshoots least, so the walker is shown real numbers instead of "impossible".
          if (!closest || over < closest.over) closest = { idx: order, over };
          return;
        }
        let spacing = Infinity;
        for (const a of idx) for (const b of idx) if (a < b) spacing = Math.min(spacing, haversineDistance(all[a - 1].coordinates, all[b - 1].coordinates));
        const rating = idx.reduce((s, i) => s + placeScore(all[i - 1]), 0) / idx.length;
        scored.push({ idx: order, spacing, rating });
      };
      let seen = 0;
      const walk = (start: number, chosen: number[]) => {
        if (seen > SEARCH_COMBOS_MAX) return;
        if (chosen.length === need) {
          seen += 1;
          consider(chosen);
          return;
        }
        for (let i = start; i < pool.length; i++) walk(i + 1, [...chosen, i]);
      };
      walk(0, []);
      // Every set here already meets the limits: most spread out first, and among equally spread sets the better-rated one.
      scored.sort((a, b) => Math.round(b.spacing / SPACING_BUCKET_M) - Math.round(a.spacing / SPACING_BUCKET_M) || b.rating - a.rating || b.spacing - a.spacing);
      if (!scored.length && closest) scored.push({ idx: (closest as { idx: number[] }).idx, spacing: 0, rating: 0 });
      const score = (v: Verdict) => v.rules.filter((r) => r.status === "not_met").length * 100 + brokenKm(v);
      let best: { stops: Candidate[]; verdict: Verdict } | null = null;
      let routed = 0;
      for (const { idx } of scored.slice(0, SEARCH_ROUTE_BUDGET)) {
        const stops = idx.map((i) => all[i - 1]);
        const r = await routeAndJudge(origin, stops, state.params, [], { alternatives: false, orderSearch: false, budget, env });
        if (r.verdict.unavailable) break; // no route could be built (budget or router): more sets will not help
        routed += 1;
        if (!best || score(r.verdict) < score(best.verdict)) best = { stops, verdict: r.verdict };
        if (r.verdict.ok) break;
      }
      if (!best) return { output: JSON.stringify({ error: scored.length ? "routes could not be built just now; try again in a minute" : "no set of places fits the time and distance limits; find more places or relax a limit", tried: scored.length }), state };
      // The chosen set gets the full check: best visiting order and, if it still breaks a rule, the alternatives.
      const judged = await routeAndJudge(origin, best.stops, state.params, pool, { env, budget });
      state.checks = rememberCheck(state, best.stops.map((s) => s.id), false, judged);
      const byId = new Map(best.stops.map((s) => [s.id, s.name]));
      return {
        output: JSON.stringify({
          found: !judged.verdict.broken,
          all_rules_met: judged.verdict.ok,
          stop_ids: judged.orderIds,
          stops: judged.orderIds.map((id) => byId.get(id)),
          verdict: judged.verdict,
          ...(judged.alternatives?.length ? { alternatives: judged.alternatives } : {}),
          ...(missingVia.length ? { streets_not_found: missingVia } : {}),
          sets_checked: routed,
          ...(approx ? { note_distances: "distances between places are estimates (the matrix service was unavailable); the final route is still checked on real streets" } : {}),
        }),
        state,
      };
    }

    if (name === "check_weather") {
      if (!state.origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      const startIn = typeof args.start_in_hours === "number" && args.start_in_hours >= 0 ? Math.min(args.start_in_hours, 60) : 0;
      const minutes = typeof args.duration_minutes === "number" && args.duration_minutes > 0 ? args.duration_minutes : (state.params.timeMinutes ?? 120);
      try {
        const res = await fetch(forecastUrl(state.origin.lat, state.origin.lng), { headers: { "User-Agent": appUserAgent() }, signal: AbortSignal.timeout(6_000) });
        if (!res.ok) return { output: JSON.stringify({ error: "forecast unavailable: say the weather was not checked" }), state };
        const body = await res.json();
        const hours = parseForecast(body);
        if (hours.length === 0) return { output: JSON.stringify({ error: "forecast unavailable: say the weather was not checked" }), state };
        const issues = assessWalkWindow(hours, startIn, minutes);
        const wet = issues.some((i) => i.kind === "rain" || i.kind === "thunderstorm");
        const dryStart = wet ? nextDryStart(hours, minutes, startIn + 1, hours.length - 1) : null;
        const dark = endsAfterDark(hours, parseSunsets(body), startIn, minutes);
        return { output: JSON.stringify({ ok: issues.length === 0, checkedHours: Math.min(Math.ceil(minutes / 60), Math.max(0, hours.length - Math.floor(startIn))), issues, ...(wet ? { nextDryStartInHours: dryStart, ...(dryStart !== null ? { nextDryStartAt: hours[dryStart].time.slice(11, 16) } : {}), hint: dryStart === null ? "no dry window in the forecast (about 3 days): say so" : "offer to start later at that time, or pick indoor places" } : {}), ...(dark ? { endsAfterDark: true, note: "the walk ends after sunset: say so and prefer lit, busy streets" } : {}), attribution: FORECAST_ATTRIBUTION }), state };
      } catch {
        return { output: JSON.stringify({ error: "forecast unavailable: say the weather was not checked" }), state };
      }
    }

    if (name === "check_safety") {
      if (!state.origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      if (!inSafetyCoverage(state.origin.lat, state.origin.lng)) return { output: JSON.stringify({ error: "no warning source for this region: say safety warnings were not checked" }), state };
      const startIn = typeof args.start_in_hours === "number" && args.start_in_hours >= 0 ? Math.min(args.start_in_hours, 60) : 0;
      const minutes = typeof args.duration_minutes === "number" && args.duration_minutes > 0 ? args.duration_minutes : (state.params.timeMinutes ?? 120);
      try {
        const res = await fetch(SAFETY_FEED_URL, { headers: { "User-Agent": appUserAgent() }, signal: AbortSignal.timeout(6_000) });
        if (!res.ok) return { output: JSON.stringify({ error: "warnings unavailable: say safety warnings were not checked" }), state };
        const now = new Date(Date.now() + startIn * 3_600_000);
        const found = warningsAt(parseWarnings(await res.text()), state.origin.lat, state.origin.lng, now, minutes / 60);
        const warnings = found.map(({ event, severity, area, onset, expires }) => ({ event, severity, area, onset, expires }));
        return { output: JSON.stringify({ ok: warnings.length === 0, warnings, attribution: SAFETY_ATTRIBUTION }), state };
      } catch {
        return { output: JSON.stringify({ error: "warnings unavailable: say safety warnings were not checked" }), state };
      }
    }

    if (name === "recall_walks") {
      const limit = typeof args.limit === "number" ? Math.min(10, Math.max(1, Math.round(args.limit))) : 5;
      const contains = typeof args.contains === "string" ? args.contains : undefined;
      const walks = loadWalks ? formatRecalledWalks(await loadWalks().catch(() => []), limit, contains) : [];
      if (walks.length === 0) return { output: JSON.stringify({ error: "no saved walks found: tell the walker so, do not invent any" }), state };
      return { output: JSON.stringify({ walks }), state };
    }

    if (name === "check_nature_hazards") {
      if (!state.origin) return { output: JSON.stringify({ error: "no start point yet: ask where they are" }), state };
      const startIn = typeof args.start_in_hours === "number" && args.start_in_hours >= 0 ? Math.min(args.start_in_hours, 60) : 0;
      const month = new Date(Date.now() + startIn * 3_600_000).getMonth() + 1;
      const seasonal = seasonalNotes(month);
      try {
        const res = await fetch(hazardUrl(state.origin.lat, state.origin.lng, month), { headers: { "User-Agent": appUserAgent() }, signal: AbortSignal.timeout(6_000) });
        if (!res.ok) return { output: JSON.stringify({ error: "wildlife records unavailable: say wildlife was not checked", seasonal }), state };
        return { output: JSON.stringify({ radiusKm: HAZARD_RADIUS_KM, month, records: parseHazardCounts(await res.json()), seasonal, attribution: HAZARD_ATTRIBUTION }), state };
      } catch {
        return { output: JSON.stringify({ error: "wildlife records unavailable: say wildlife was not checked", seasonal }), state };
      }
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
      // One verdict per set of stops: build_walk reuses what estimate_walk / find_clean_walk already checked.
      const cached = name === "build_walk" ? state.checks?.find((c) => c.key === checkKey(picked.map((c2) => c2.id), state.params, ordered)) : undefined;
      let judged: Judged;
      if (cached) {
        judged = { verdict: cached.verdict, orderIds: cached.orderIds, geometry: cached.geometry };
      } else if (needsRouteCheck(state.params)) {
        judged = await routeAndJudge(state.origin, est.order, state.params, state.candidates, { orderSearch: !ordered, budget });
      } else {
        judged = {
          verdict: makeVerdict(limitRules(state.params, est.walkKm, est.walkMin, est.visitMin, est.approx), est.walkKm, est.walkMin, est.visitMin),
          orderIds: est.order.map((s) => s.id),
        };
      }
      if (!cached) state.checks = rememberCheck(state, picked.map((c) => c.id), ordered, judged);
      if (name === "estimate_walk") {
        return { output: JSON.stringify({ walkKm: judged.verdict.walkKm, walkMin: judged.verdict.walkMin, visitMin: judged.verdict.visitMin, totalMin: judged.verdict.totalMin, legs: est.legs, verdict: judged.verdict, ...(judged.alternatives?.length ? { alternatives: judged.alternatives } : {}) }), state };
      }
      if (!state.limitsSettled) {
        return { output: JSON.stringify({ error: "limits not asked yet: call ask_limits first" }), state };
      }
      // A walk this long is a wrong start point or a wrong place, not a request: say so instead of building it.
      const plausibleKm = Math.max(MAX_PLAUSIBLE_WALK_KM, state.params.maxWalkKm ?? 0, state.params.timeMinutes ? (state.params.timeMinutes / (state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM)) : 0);
      if (judged.verdict.walkKm > plausibleKm) {
        return { output: JSON.stringify({ error: `this walk is ${Math.round(judged.verdict.walkKm)} km: too long to walk. Check the start point (${state.origin.lat.toFixed(4)},${state.origin.lng.toFixed(4)}) and the places, and tell the walker.`, verdict: judged.verdict }), state };
      }
      // The rules are enforced here, not in the prompt: build exactly the order that was checked, and only when no rule is broken.
      if (judged.verdict.broken) {
        const onlyLimits = judged.verdict.rules.every((r) => r.status !== "not_met" || r.rule === "time" || r.rule === "max_walk");
        return { output: JSON.stringify({ error: onlyLimits ? "does not fit" : "route breaks the walker's rules", verdict: judged.verdict, ...(judged.alternatives?.length ? { alternatives: judged.alternatives } : {}) }), state };
      }
      builtVerdict = judged.verdict;
      // The map must show the route that was checked, not a second one the planner computes.
      if (needsRouteCheck(state.params)) {
        if (!judged.geometry) {
          const again = await routeAndJudge(state.origin, judged.orderIds.map((id) => state.candidates.find((c) => c.id === id)).filter((c): c is Candidate => Boolean(c)), state.params, [], { alternatives: false, orderSearch: false, budget });
          if (again.verdict.broken) return { output: JSON.stringify({ error: "route breaks the walker's rules", verdict: again.verdict }), state };
          if (!again.verdict.unavailable) {
            judged.geometry = again.geometry;
            builtVerdict = again.verdict;
          }
        }
        builtGeometry = judged.geometry;
      }
      notChecked = judged.verdict.rules.filter((r) => r.status === "not_checked" || r.status === "partial");
      args.stop_ids = judged.orderIds;
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
        output: JSON.stringify({ built: true, building: stops.map((s) => s.name), ...(builtVerdict ? { verdict: builtVerdict } : {}), ...(notChecked.length ? { not_checked: notChecked } : {}) }),
        state,
        action: { type: "build", origin, params: state.params, stops, ...(args.ordered === true ? { ordered: true } : {}), ...(builtGeometry ? { geometry: builtGeometry } : {}) },
      };
    }
  } catch (err) {
    console.error(`[assistant] tool ${name} failed:`, err);
    return { output: JSON.stringify({ error: "lookup failed, try again or say so" }), state };
  }
  return { output: JSON.stringify({ error: "unknown tool" }), state };
}
