import { searchNearbyPlaces, searchTextPlaces } from "@/lib/api/google-places-client";
import type { PlacesGate } from "@/lib/api/places-quota";
import { cleanUntrustedText, coarseCoords } from "@/lib/llm/sanitize";
import { redactForLog } from "@/lib/utils/redact";
import { ASSISTANT_TOOL_ARGS, MAX_NEARBY_RADIUS_M, parseToolArgs } from "./tool-schemas";
import type { ToolDef } from "@/lib/llm/providers/openai-tools";
import type { AttractionCategory, Coordinates } from "@/lib/types";
import { appUserAgent } from "@/lib/api/http-identity";
import { HAZARD_ATTRIBUTION, HAZARD_RADIUS_KM, hazardUrl, parseHazardCounts, seasonalNotes } from "@/lib/safety/nature-hazards";
import { inSafetyCoverage, parseWarnings, SAFETY_ATTRIBUTION, SAFETY_FEED_URL, warningsAt } from "@/lib/safety/meteoalarm";
import { assessWalkWindow, endsAfterDark, FORECAST_ATTRIBUTION, forecastUrl, nextDryStart, parseForecast, parseSunrises, parseSunsets, suggestStart } from "@/lib/weather/forecast";
import { getMatrix } from "@/lib/api/ors-client";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { ACCESS_PROFILES, isAccess, routeModeFor } from "@/lib/walk/access";
import { formatClock, localTimeOnDay, nextLocalTime, parseHHMM, tzOffsetMin } from "@/lib/walk/clock";
import { bestOrderWithRules, type StopOrder } from "@/lib/walk/stop-order";
import { bestOrder, insideBoundary, pickSpread } from "@/lib/walk/loop-search";
import { fetchTownBoundary, fetchTownFootprint } from "@/lib/walk/town-boundary";
import { searchPlaces } from "@/lib/api/nominatim-client";
import { fetchForbiddenWays } from "@/lib/walk/forbidden-ways";
import { makeBudget, matrixCoolingDown, noteMatrixError, type RoutingBudget } from "@/lib/walk/routing-budget";
import { brokenKm, limitRules, makeVerdict, settled, type RuleResult, type Verdict } from "@/lib/walk/rule-verdict";
import { clampPace } from "@/lib/walk/pace";
import { legPace, MAX_DWELL_MIN, timeline, type BreakPlan, type StopPlan, type Timeline } from "@/lib/walk/timing";
import { formatRecalledWalks, type LoadWalks } from "./recall-walks";
import { scheduleFor } from "./schedule";
import { withTransitBack } from "./transit";
import { scheduleOf } from "@/lib/walk/schedule-rules";
import { loadEnv, needsRouteCheck, routeAndJudge, TURN_ROUTING_CALLS, type Judged } from "./route-check";

import {
  DEFAULT_PACE_MIN_PER_KM,
  visitMinutes,
  type AssistantState,
  type BuildAction,
  placeScore,
  type Candidate,
  type WalkParams,
  zoneOf,
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
      name: "set_stop_plan",
      description:
        "Per-stop wishes: how long to stay at a place (dwell_min, 0 = just pass by) and how fast to walk the leg that ARRIVES at it (pace: brisk | normal | stroll, or pace_min_per_km). Use id \"end\" for the leg back to the start of a loop. \"Fast to A, slowly at B\": A gets pace brisk, B gets more dwell_min (or stroll for the leg to B). Estimate again after changing it.",
      parameters: {
        type: "object",
        properties: {
          stops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "candidate id, or \"end\"" },
                dwell_min: { type: "number" },
                pace: { type: "string", enum: ["brisk", "normal", "stroll"] },
                pace_min_per_km: { type: "number" },
                arrive_after: { type: "string", description: "\"HH:MM\": not before this clock time" },
                arrive_before: { type: "string", description: "\"HH:MM\": not after this clock time" },
              },
              required: ["id"],
              additionalProperties: false,
            },
          },
          clear_ids: { type: "array", items: { type: "string" }, description: "ids whose plan to remove" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_stop_order",
      description:
        "Order wishes for the stops. Each ref is a candidate id, or \"kind:food\" / \"kind:park\" (the first stop of that kind). first / last = that stop opens / closes the walk; end_at = the walk ends there (not a loop); before = pairs where a comes before b (\"cafe before the park\"). clear removes all order wishes. The server keeps this order and says if it is not met.",
      parameters: {
        type: "object",
        properties: {
          first: { type: "string" },
          last: { type: "string" },
          end_at: { type: "string" },
          before: { type: "array", items: { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a", "b"], additionalProperties: false } },
          clear: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_breaks",
      description:
        "Rest time inside the walk: rest_min minutes after every rest_every_min minutes or rest_every_km km walked without a stop (a stop at least that long counts as a rest). Meals: windows (from/to \"HH:MM\") that must hold a food stop of at least `minutes`. clear removes breaks and meals.",
      parameters: {
        type: "object",
        properties: {
          rest_min: { type: "number" },
          rest_every_min: { type: "number" },
          rest_every_km: { type: "number" },
          meals: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, minutes: { type: "number" } }, required: ["from", "to", "minutes"], additionalProperties: false } },
          clear: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_clock",
      description:
        "When the walk starts and must end, so opening hours and clock wishes can be checked. start_time \"HH:MM\" (walker's local time, today or the next time it shows) or start_in_hours (0 = now). end_by \"HH:MM\". Per-stop windows go to set_stop_plan (arrive_after / arrive_before). clear removes the start time and end_by.",
      parameters: {
        type: "object",
        properties: {
          start_time: { type: "string" },
          start_in_hours: { type: "number" },
          end_by: { type: "string" },
          clear: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_transit",
      description:
        "Public transport for the way home: back = true means the walker rides a bus or train from where the walk ends back to the start instead of walking back (so the walk is not a loop). The server looks up a real timetable ride and says if there is none. Needs a start time (set_clock). Only the ride back is supported; for anything else say it is not supported yet. back = false removes it.",
      parameters: { type: "object", properties: { back: { type: "boolean" } }, required: ["back"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_start",
      description: "Set the walk's start to a candidate. For a walk IN a town, include area (town + country): the server keeps the current start if inside that town, otherwise defaults to the town candidate. Continue planning immediately; the start question is non-blocking. Omit area only for an explicitly requested start address/venue.",
      parameters: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          area: { type: "string", description: "Named town/area of the walk, with country; checks the actual town outline, not distance from its centre" },
        },
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
          access: { type: "string", enum: ["stroller", "wheelchair", "none"], description: "how the walker moves: a stroller or a wheelchair gets routes without steps and steep slopes, and a slower pace; the server checks steps, slope and surface on the real route" },
          max_grade_pct: { type: "number", description: "steepest slope the walker accepts, in percent (default 8 stroller, 6 wheelchair)" },
          clear: { type: "array", items: { type: "string", enum: ["no_repeat", "stay_in_area", "avoid_streets", "avoid_dangerous", "via_streets", "time", "max_walk", "loop", "end_distance", "access", "max_grade"] }, description: "rules the walker gives up: they are removed" },
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
  /** A default town start to announce without pausing the planning turn. */
  defaultAreaStart?: { name: string; coordinates: Coordinates };
}

interface Estimate {
  walkKm: number;
  walkMin: number;
  visitMin: number;
  totalMin: number;
  legs: Array<{ to: string; km: number; min: number; pace: number; arrive?: string; rest_min?: number }>;
  /** The timeline of this walk (clock times, rests). */
  t: Timeline;
  /** Stop plans that name a stop not in this walk. */
  ignored: string[];
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
  plans?: WalkParams["stops"],
  extra?: { order?: StopOrder; breaks?: BreakPlan; startAt?: number; timeZone?: string; access?: WalkParams["access"] },
): Promise<Estimate> {
  const points = [origin, ...stops.map((s) => s.coordinates)];
  let dist: number[][];
  let approx = false;
  try {
    if (matrixCoolingDown()) throw new Error("matrix cooling down");
    const m = await getMatrix({ locations: points.map(toOrsCoord), ...(extra?.access ? { profile: ACCESS_PROFILES[extra.access].mode.profile, options: ACCESS_PROFILES[extra.access].mode.options } : {}) } as Parameters<typeof getMatrix>[0]);
    dist = m.distances as number[][];
    if (!dist?.length) throw new Error("empty");
    // The router leaves pairs it cannot connect empty: a straight-line estimate, never a free 0 m leg (the real route check still decides).
    dist = dist.map((row, i) => row.map((d, j) => {
      if (typeof d === "number" && Number.isFinite(d)) return d;
      approx = true;
      return haversineDistance(points[i], points[j]) * 1.3;
    }));
  } catch (err) {
    noteMatrixError(err);
    approx = true;
    dist = points.map((a) => points.map((b) => haversineDistance(a, b) * 1.3));
  }
  const ruled = !ordered && extra?.order ? bestOrderWithRules(dist, loop && !extra.order.endAt, stops.map((s) => ({ id: s.id, category: s.category })), extra.order) : null;
  const sequence = ordered ? stops.map((_, i) => i + 1) : (ruled ?? bestOrder(dist, loop));
  let at = 0;
  const legs: Estimate["legs"] = [];
  const visited: Candidate[] = [];
  const legMeters: number[] = [];
  let meters = 0;
  for (const best of sequence) {
    const d = dist[at][best] ?? 0;
    meters += d;
    visited.push(stops[best - 1]);
    const legPaceNow = legPace(plans, stops[best - 1].id, pace);
    legs.push({ to: stops[best - 1].name, km: Math.round(d / 100) / 10, min: Math.round((d / 1000) * legPaceNow), pace: Math.round(legPaceNow * 10) / 10 });
    legMeters.push(d);
    at = best;
  }
  if (loop) {
    const back = dist[at][0] ?? 0;
    meters += back;
    legMeters.push(back);
  }
  const walkKm = Math.round(meters / 100) / 10;
  const t = timeline(visited.map((s) => ({ id: s.id, visitMin: visitMinutes(s.category) })), legMeters.map((m) => m / 1000), plans, pace, null, extra?.breaks);
  const walkMin = Math.round(t.walkMin);
  const visitMin = Math.round(t.visitMin + t.restMin);
  const sched = extra ? scheduleOf({ timeline: t, startAt: extra.startAt, timeZone: extra.timeZone }) : undefined;
  legs.forEach((l, i) => {
    if (sched?.[i]) l.arrive = sched[i].arrive;
    if (t.legs[i]?.restMin) l.rest_min = t.legs[i].restMin;
  });
  return { walkKm, walkMin, visitMin, totalMin: walkMin + visitMin, legs, t, order: visited, approx, ignored: t.ignored };
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
      if (!c.placeId.startsWith("via:")) existing.fetchedAt = Date.now();
      if (!existing.hours && c.hours) existing.hours = c.hours;
      if (existing.wheelchairEntrance === undefined && c.wheelchairEntrance !== undefined) existing.wheelchairEntrance = c.wheelchairEntrance;
      if (existing.rating === undefined && c.rating !== undefined) {
        existing.rating = c.rating;
        existing.ratingCount = c.ratingCount;
      }
      result.push(existing);
      continue;
    }
    const withId = { ...c, name: cleanUntrustedText(c.name, 120), id: `c${++next}`, ...(c.placeId.startsWith("via:") ? {} : { fetchedAt: Date.now() }) };
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

/** "today" / "tomorrow" / the ISO date, relative to the first forecast day. */
function dayLabel(todayIso: string, dateIso: string): string {
  const diff = Math.round((Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
  return diff === 0 ? "today" : diff === 1 ? "tomorrow" : dateIso;
}

export async function runTool(
  name: string,
  rawArgs: string,
  input: AssistantState,
  /** Directions calls shared by every tool of one assistant turn (ORS allows ~40 a minute). */
  budget: RoutingBudget = makeBudget(TURN_ROUTING_CALLS),
  /** Loads the signed-in walker's saved walks; absent for guests. */
  loadWalks?: LoadWalks,
  /** The walker's Google Places budget; a search is refused once it is spent. */
  placesGate?: PlacesGate,
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
  // The place's own UTC offset (from Google) beats the browser zone: a tourist plans Paris from a phone set to Israel.
  if (state.origin) {
    const near = state.candidates
      .filter((c) => c.hours?.utcOffsetMin !== undefined)
      .sort((a, b) => haversineDistance(state.origin!, a.coordinates) - haversineDistance(state.origin!, b.coordinates))[0];
    if (near && haversineDistance(state.origin, near.coordinates) < 30000) state.params.placeOffsetMin = near.hours!.utcOffsetMin;
    else delete state.params.placeOffsetMin; // the origin moved away from the city the old offset came from
  }
  const parsedArgs = parseToolArgs(ASSISTANT_TOOL_ARGS, name, rawArgs);
  if (!parsedArgs.ok) return { output: JSON.stringify({ error: parsedArgs.error }), state };
  const args = parsedArgs.args;

  try {
    if (name === "search_place") {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
      if (!query) return { output: JSON.stringify({ error: "query required" }), state };
      if (placesGate && !(await placesGate.take())) return { output: JSON.stringify({ error: "place search limit reached for today: tell the walker" }), state };
      const places = await searchTextPlaces(query, state.origin ?? undefined, 3, true);
      const found = addCandidates(
        state,
        places.map((p) => ({
          id: "",
          name: p.name,
          coordinates: p.coordinates,
          category: "other" as const,
          placeId: p.placeId,
          ...(p.hours ? { hours: p.hours } : {}),
          ...(p.wheelchairEntrance !== undefined ? { wheelchairEntrance: p.wheelchairEntrance } : {}),
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
      const radius = Math.min(
        MAX_NEARBY_RADIUS_M,
        num(args.radius_m) ?? (state.params.radiusKm ? state.params.radiusKm * 1000 : DEFAULT_NEARBY_RADIUS_M),
      );
      const wanted = Math.min(MAX_RESULTS_TO_MODEL, Math.round(num(args.count) ?? 3));
      const avoid = state.avoid;
      if (placesGate && !(await placesGate.take())) return { output: JSON.stringify({ error: "place search limit reached for today: tell the walker" }), state };
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
          ...(p.hours ? { hours: p.hours } : {}),
          ...(p.wheelchairEntrance !== undefined ? { wheelchairEntrance: p.wheelchairEntrance } : {}),
        }))
        // Near first; a better-rated place may edge ahead (one star is worth about 400 m), but only inside the radius that was asked for.
        .sort((a, b) => a.distanceMeters - (placeScore(a) - RATING_PRIOR_SCORE) * RATING_M_PER_STAR - (b.distanceMeters - (placeScore(b) - RATING_PRIOR_SCORE) * RATING_M_PER_STAR));
      const picked = args.spread === true ? pickSpread(ranked, wanted, anchor) : ranked.slice(0, wanted);
      const found = addCandidates(state, picked);
      const unchecked = state.params.stayInArea && !boundary ? `\nNOTE: the outline of ${state.params.stayInArea} could not be found, so these places were not checked against it: tell the walker.` : "";
      return { output: found.length ? compact(found) + unchecked : JSON.stringify({ error: "nothing found" }), state };
    }

    if (name === "set_stop_plan") {
      const plans = { ...(state.params.stops ?? {}) };
      const clamped: string[] = [];
      const unknown: string[] = [];
      for (const raw of Array.isArray(args.stops) ? args.stops : []) {
        const e = raw as Record<string, unknown>;
        const id = typeof e.id === "string" ? e.id : "";
        if (id !== "end" && !state.candidates.some((c) => c.id === id)) {
          unknown.push(id);
          continue;
        }
        const plan: StopPlan = { ...plans[id] };
        if (typeof e.dwell_min === "number" && Number.isFinite(e.dwell_min) && e.dwell_min >= 0) {
          plan.dwellMin = Math.min(e.dwell_min, MAX_DWELL_MIN);
          if (plan.dwellMin !== e.dwell_min) clamped.push(`${id} dwell`);
        }
        if (typeof e.pace_min_per_km === "number" && Number.isFinite(e.pace_min_per_km) && e.pace_min_per_km > 0) {
          plan.pace = clampPace(e.pace_min_per_km);
          if (plan.pace !== e.pace_min_per_km) clamped.push(`${id} pace`);
        } else if (e.pace === "brisk" || e.pace === "normal" || e.pace === "stroll") {
          plan.pace = e.pace;
        }
        for (const [key, field] of [["arrive_after", "arriveAfter"], ["arrive_before", "arriveBefore"]] as const) {
          const v = e[key];
          if (typeof v === "string" && parseHHMM(v) !== null) plan[field] = v.trim();
        }
        plans[id] = plan;
      }
      for (const id of Array.isArray(args.clear_ids) ? args.clear_ids : []) if (typeof id === "string") delete plans[id];
      if (unknown.length && Object.keys(plans).length === Object.keys(state.params.stops ?? {}).length && !Array.isArray(args.clear_ids)) {
        return { output: JSON.stringify({ error: `unknown stop id: ${unknown.join(", ")}: find the place first`, ...(clamped.length ? { clamped } : {}) }), state };
      }
      if (Object.keys(plans).length) state.params.stops = plans;
      else delete state.params.stops;
      return { output: JSON.stringify({ ok: true, plans: state.params.stops ?? {}, ...(unknown.length ? { unknown_ids: unknown } : {}), ...(clamped.length ? { clamped } : {}), next: "call estimate_walk again to see the new times" }), state };
    }

    if (name === "set_stop_order") {
      if (args.clear === true) {
        delete state.params.order;
        return { output: JSON.stringify({ ok: true, order: null }), state };
      }
      const known = (ref: unknown): ref is string => typeof ref === "string" && (ref.startsWith("kind:") ? state.candidates.some((c) => c.category === ref.slice(5)) : state.candidates.some((c) => c.id === ref));
      const order: StopOrder = { ...state.params.order };
      const bad: string[] = [];
      for (const [key, field] of [["first", "first"], ["last", "last"], ["end_at", "endAt"]] as const) {
        const v = args[key];
        if (v === undefined) continue;
        if (known(v)) order[field] = v;
        else bad.push(String(v));
      }
      if (Array.isArray(args.before)) {
        const pairs = args.before.flatMap((raw) => {
          const e = raw as Record<string, unknown>;
          if (known(e.a) && known(e.b) && e.a !== e.b) return [[e.a, e.b] as [string, string]];
          bad.push(`${String(e.a)}/${String(e.b)}`);
          return [];
        });
        const all = [...(order.before ?? []), ...pairs];
        order.before = all.slice(0, 8);
        if (all.length > 8) bad.push(`${all.length - 8} extra before-pair(s) dropped (max 8)`);
      }
      if (order.endAt && state.params.endDistanceKm === 0) {
        return { output: JSON.stringify({ error: "end_at conflicts with a loop (back at the start): ask the walker which one they want, then clear the other with set_walk_params clear [loop] or set_stop_order clear" }), state };
      }
      if (order.endAt && order.last && order.endAt !== order.last) {
        return { output: JSON.stringify({ error: "last and end_at name different stops: the walk can only end at one. Ask which, then clear with set_stop_order clear" }), state };
      }
      if (bad.length && !order.first && !order.last && !order.endAt && !order.before?.length) return { output: JSON.stringify({ error: `unknown ref: ${bad.join(", ")}` }), state };
      state.params.order = order;
      return { output: JSON.stringify({ ok: true, order, ...(bad.length ? { unknown_refs: bad } : {}), next: "call estimate_walk again" }), state };
    }

    if (name === "set_breaks") {
      if (args.clear === true) {
        delete state.params.breaks;
        delete state.params.meals;
        return { output: JSON.stringify({ ok: true, breaks: null }), state };
      }
      const rest = num(args.rest_min);
      const everyMin = num(args.rest_every_min);
      const everyKm = num(args.rest_every_km);
      if (rest && (everyMin || everyKm)) state.params.breaks = { minutes: Math.min(rest, 120), ...(everyMin ? { everyMin } : {}), ...(everyKm ? { everyKm } : {}) };
      else if (rest || everyMin || everyKm) return { output: JSON.stringify({ error: "a rest needs rest_min and rest_every_min or rest_every_km" }), state };
      if (Array.isArray(args.meals)) {
        const meals = args.meals.flatMap((raw) => {
          const e = raw as Record<string, unknown>;
          const minutes = num(e.minutes);
          return typeof e.from === "string" && typeof e.to === "string" && parseHHMM(e.from) !== null && parseHHMM(e.to) !== null && minutes ? [{ from: e.from.trim(), to: e.to.trim(), minutes: Math.min(minutes, 240) }] : [];
        });
        if (meals.length) state.params.meals = meals.slice(0, 4);
      }
      return { output: JSON.stringify({ ok: true, breaks: state.params.breaks ?? null, meals: state.params.meals ?? [], next: "call estimate_walk again" }), state };
    }

    if (name === "set_clock") {
      if (args.clear === true) {
        delete state.params.startAt;
        delete state.params.endBy;
        return { output: JSON.stringify({ ok: true, startAt: null }), state };
      }
      const tz = zoneOf(state.params);
      let movedToTomorrow = false;
      if (typeof args.start_in_hours === "number" && args.start_in_hours >= 0 && args.start_in_hours < 72) state.params.startAt = Date.now() + Math.round(args.start_in_hours * 3600000);
      else if (typeof args.start_time === "string") {
        const at = tz ? nextLocalTime(args.start_time, tz, Date.now()) : null;
        if (at === null) return { output: JSON.stringify({ error: tz ? `could not read start_time "${args.start_time}" (use HH:MM)` : "the walker's time zone is unknown: use start_in_hours" }), state };
        state.params.startAt = at;
        movedToTomorrow = (localTimeOnDay(args.start_time, tz!, Date.now()) ?? Infinity) < Date.now() - 5 * 60000;
      }
      if (typeof args.end_by === "string") {
        if (parseHHMM(args.end_by) === null) return { output: JSON.stringify({ error: "end_by must be HH:MM" }), state };
        state.params.endBy = args.end_by.trim();
      }
      const off = state.params.startAt !== undefined && tz ? (tzOffsetMin(tz, state.params.startAt) ?? 0) : 0;
      return { output: JSON.stringify({ ok: true, ...(state.params.startAt !== undefined ? { start: formatClock(state.params.startAt, off), ...(movedToTomorrow ? { day: "tomorrow (that time has already passed today): say so" } : {}), zone: tz } : {}), end_by: state.params.endBy ?? null, next: "call estimate_walk again" }), state };
    }

    if (name === "set_transit") {
      if (args.back !== true) {
        delete state.params.transit;
        return { output: JSON.stringify({ ok: true, transit: null }), state };
      }
      if (state.params.endDistanceKm === 0) return { output: JSON.stringify({ error: "a ride back conflicts with a loop (back at the start by walking): ask which one they want, then clear the loop with set_walk_params clear [loop]" }), state };
      state.params.transit = { back: true };
      return { output: JSON.stringify({ ok: true, transit: { back: true }, next: state.params.startAt === undefined ? "ask when they start (set_clock), then call estimate_walk" : "call estimate_walk again" }), state };
    }

    if (name === "set_start") {
      const c = state.candidates.find((x) => x.id === args.candidate_id);
      if (!c) return { output: JSON.stringify({ error: "unknown candidate id" }), state };
      if (typeof args.area === "string") {
        const footprint = await fetchTownFootprint(args.area);
        const inside = state.origin && footprint ? insideBoundary(state.origin, footprint, 0) : null;
        if (state.origin && inside !== false) {
          return {
            output: JSON.stringify({
              ok: true, start_source: "current_location", inside_area: inside,
              next: inside
                ? "Already inside the requested town: keep this exact start and continue planning now. Do not ask where to start or offer to drop the area rule."
                : "Town membership could not be verified. Keep the existing start and continue planning; never claim it is outside the town.",
            }),
            state,
          };
        }
        if (footprint && !insideBoundary(c.coordinates, footprint, 0)) {
          return { output: JSON.stringify({ error: "the candidate is outside the requested town: search for a start in that town; keep the area rule" }), state };
        }
        state.origin = c.coordinates;
        return {
          output: JSON.stringify({
            ok: true, start: c.name, start_source: "named_area", inside_area: inside,
            next: "Continue finding places and planning from this start in this same turn. The server will announce the default start and ask okay without waiting for an answer. Do not offer to remove the area rule or pause for start confirmation. Other safety/route confirmations still apply.",
          }),
          state,
          defaultAreaStart: { name: c.name, coordinates: c.coordinates },
        };
      }
      state.origin = c.coordinates;
      return { output: JSON.stringify({ ok: true, start: c.name }), state };
    }

    if (name === "set_walk_params") {
      const t = num(args.time_minutes);
      const r = num(args.radius_km);
      const e = typeof args.end_distance_km === "number" && args.end_distance_km >= 0 ? args.end_distance_km : undefined;
      const p = num(args.pace_min_per_km);
      const w = num(args.max_walk_km);
      if (e === 0 && (state.params.order?.endAt || state.params.transit?.back)) {
        return { output: JSON.stringify({ error: "a loop (back at the start) conflicts with end_at / the ride home: ask the walker which one they want, then clear the other first" }), state };
      }
      if (w) state.params.maxWalkKm = w;
      state.limitsSettled = true;
      if (t) state.params.timeMinutes = t;
      if (r) state.params.radiusKm = r;
      if (e !== undefined) state.params.endDistanceKm = e;
      if (p) state.params.paceMinPerKm = p;
      if (typeof args.no_repeat === "boolean") state.params.noRepeat = args.no_repeat;
      if (typeof args.avoid_dangerous === "boolean") state.params.avoidDangerous = args.avoid_dangerous;
      if (Array.isArray(args.via_streets)) {
        const via = args.via_streets.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => cleanUntrustedText(x, 60)).filter(Boolean);
        state.params.viaStreets = [...new Set([...(state.params.viaStreets ?? []), ...via])].slice(0, 4);
      }
      if (isAccess(args.access)) state.params.access = args.access;
      else if (args.access === "none") delete state.params.access;
      const grade = num(args.max_grade_pct);
      if (grade && grade <= 30) state.params.maxGradePct = grade;
      if (typeof args.stay_in_area === "string" && args.stay_in_area.trim()) state.params.stayInArea = cleanUntrustedText(args.stay_in_area, 80);
      if (Array.isArray(args.avoid_streets)) {
        const streets = args.avoid_streets.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => cleanUntrustedText(x, 60)).filter(Boolean);
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
        else if (rule === "access") delete state.params.access;
        else if (rule === "max_grade") delete state.params.maxGradePct;
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
        // A wheelchair walker gets the wheelchair matrix, so places it cannot reach (null pairs) drop out before any real routing.
        const m = await getMatrix({ locations: spots.map(toOrsCoord), profile: routeModeFor(state.params.access)?.profile, options: routeModeFor(state.params.access)?.options } as Parameters<typeof getMatrix>[0]);
        full = m.distances as number[][];
      } catch (err) {
        // Matrix quota used up or service down: straight lines x1.3 order the sets; the real routes below are still checked.
        noteMatrixError(err);
        approx = true;
        full = spots.map((a) => spots.map((b) => haversineDistance(a, b) * 1.3));
      }
      const pace = (state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM) * (state.params.access ? ACCESS_PROFILES[state.params.access].paceFactor : 1);
      const { timeMinutes, maxWalkKm } = state.params;
      // Every combination of the pool, ordered as a loop; keep those within the limits, most spread out first.
      const scored: Array<{ idx: number[]; spacing: number; rating: number }> = [];
      let closest: { idx: number[]; over: number } | null = null;
      const consider = (chosen: number[]) => {
        const idx = [...must.map((_, i) => i + 1), ...chosen.map((i) => i + 1 + must.length)];
        const sub = [0, ...idx].map((a) => [0, ...idx].map((b) => full[a]?.[b] ?? Infinity));
        const stopsHere = idx.map((i) => all[i - 1]);
        const rawOrder = (state.params.order ? bestOrderWithRules(sub, loop && !state.params.order.endAt, stopsHere, state.params.order) : null) ?? bestOrder(sub, loop);
        const order = rawOrder.map((i) => idx[i - 1]);
        let at = 0;
        let meters = 0;
        const legKms: number[] = [];
        for (const j of order) {
          const d = full[at]?.[j] ?? Infinity;
          meters += d;
          legKms.push(d / 1000);
          at = j;
        }
        if (loop) {
          const back = full[at]?.[0] ?? Infinity;
          meters += back;
          legKms.push(back / 1000);
        }
        const t = timeline(order.map((i) => ({ id: all[i - 1].id, visitMin: visitMinutes(all[i - 1].category) })), legKms, state.params.stops, pace, null, state.params.breaks);
        const over = Math.max(maxWalkKm ? meters / (maxWalkKm * 1100) : 0, timeMinutes ? t.totalMin / timeMinutes : 0);
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
      let noRoute = 0;
      for (const { idx } of scored.slice(0, SEARCH_ROUTE_BUDGET)) {
        const stops = idx.map((i) => all[i - 1]);
        const r = await routeAndJudge(origin, stops, state.params, [], { alternatives: false, orderSearch: false, budget, env });
        if (r.verdict.unavailable) {
          if (r.verdict.noRoute) {
            noRoute += 1;
            continue;
          } // the router answered "no route" for this set: another set may work
          break; // no route could be built (budget or router down): more sets will not help
        }
        routed += 1;
        if (settled(r.verdict)) {
          best = { stops, verdict: r.verdict };
          break;
        }
        if (!best || score(r.verdict) < score(best.verdict)) best = { stops, verdict: r.verdict };
      }
      if (!best) return { output: JSON.stringify({ error: noRoute > 0 && routed === 0 ? "the router found no route for any set of these places; try other places or a different area" : scored.length ? "routes could not be built just now; try again in a minute" : "no set of places fits the time and distance limits; find more places or relax a limit", tried: scored.length }), state };
      // The chosen set gets the full check: best visiting order and, if it still breaks a rule, the alternatives.
      let judged = await routeAndJudge(origin, best.stops, state.params, pool, { env, budget });
      if (state.params.transit?.back && !judged.verdict.unavailable) {
        const last = [...best.stops, ...pool].find((c) => c.id === judged.orderIds[judged.orderIds.length - 1]);
        if (last) judged = { ...judged, verdict: await withTransitBack(judged.verdict, last.coordinates, origin, state.params) };
      }
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
      // The start the walker set (set_clock) wins over the model's argument: the forecast must cover the hours they really walk.
      const startKnown = typeof state.params.startAt === "number";
      const startIn = startKnown ? Math.min(60, Math.max(0, Math.floor((state.params.startAt! - Date.now()) / 3_600_000))) : typeof args.start_in_hours === "number" && args.start_in_hours >= 0 ? Math.min(args.start_in_hours, 60) : 0;
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
        const sunsets = parseSunsets(body);
        const dark = endsAfterDark(hours, sunsets, startIn, minutes);
        const better = wet || dark ? suggestStart(hours, sunsets, parseSunrises(body), minutes, startIn) : null;
        const recommendation = better
          ? { at: better.at, day: dayLabel(hours[0].time.slice(0, 10), better.date), ...(better.shorterMin ? { shorterMin: better.shorterMin } : {}), sunset: sunsets[better.date]?.slice(11, 16), avoids: [...(wet ? ["rain/thunderstorm"] : []), ...(dark ? ["finishing after sunset"] : [])] }
          : undefined;
        return { output: JSON.stringify({ ok: issues.length === 0, startKnown, ...(recommendation ? { recommendation, next: "propose this recommendation in ONE sentence (start time, why, sunset) plus at most one alternative (shorterMin), then ask one question; do not list the issues separately" } : {}), checkedHours: Math.min(Math.ceil(minutes / 60), Math.max(0, hours.length - Math.floor(startIn))), issues, ...(wet ? { nextDryStartInHours: dryStart, ...(dryStart !== null ? { nextDryStartAt: hours[dryStart].time.slice(11, 16) } : {}), ...(recommendation ? {} : { hint: dryStart === null ? "no dry window in the forecast (about 3 days): say so" : "offer to start later at that time, or pick indoor places" }) } : {}), ...(dark ? { endsAfterDark: true, ...(recommendation ? {} : { note: "the walk ends after sunset: say so and prefer lit, busy streets" }) } : {}), attribution: FORECAST_ATTRIBUTION }), state };
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
        const warnings = found.map(({ event, severity, area, onset, expires }) => ({ event: cleanUntrustedText(String(event), 80), severity, area: cleanUntrustedText(String(area), 120), onset, expires }));
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
      const est = await estimateWalk(state.origin, picked, (state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM) * (state.params.access ? ACCESS_PROFILES[state.params.access].paceFactor : 1), ordered, state.params.endDistanceKm === 0, state.params.stops, { order: state.params.order, breaks: state.params.breaks, startAt: state.params.startAt, timeZone: zoneOf(state.params), access: state.params.access });
      // One verdict per set of stops: build_walk reuses what estimate_walk / find_clean_walk already checked.
      const cached = name === "build_walk" ? state.checks?.find((c) => c.key === checkKey(picked.map((c2) => c2.id), state.params, ordered)) : undefined;
      let judged: Judged;
      if (cached) {
        judged = { verdict: cached.verdict, orderIds: cached.orderIds, geometry: cached.geometry };
      } else if (needsRouteCheck(state.params)) {
        judged = await routeAndJudge(state.origin, est.order, state.params, state.candidates, { orderSearch: !ordered, budget });
      } else {
        // No route rule needs routing, but one route still gives the real distance and the climbing.
        let routed: Judged | null = null;
        try {
          routed = await routeAndJudge(state.origin, est.order, state.params, [], { alternatives: false, orderSearch: false, budget });
        } catch {
          routed = null;
        }
        const sched = scheduleFor(state.params, est.order, est.t);
        judged = routed && !routed.verdict.unavailable ? routed : {
          verdict: { ...makeVerdict([...limitRules(state.params, est.walkKm, est.walkMin, est.visitMin, est.approx), ...sched.rules], est.walkKm, est.walkMin, est.visitMin), ...(sched.schedule ? { schedule: sched.schedule } : {}), ...(est.t.restMin ? { restMin: Math.round(est.t.restMin) } : {}) },
          orderIds: est.order.map((s) => s.id),
        };
      }
      if (judged.verdict.unavailable) {
        // No route: the clock, order and access rules still need an answer; they never read "met" without a route.
        const sched = scheduleFor(state.params, est.order, est.t);
        const gap = state.params.access ? (["no_steps", "max_grade", "surface"] as const).map((rule) => ({ rule, status: "not_checked" as const, dataGap: true as const, detail: "no route to check" })) : [];
        const rules = [...judged.verdict.rules, ...sched.rules, ...gap];
        judged = { ...judged, verdict: { ...judged.verdict, rules, broken: rules.some((r) => r.status === "not_met"), ...(sched.schedule ? { schedule: sched.schedule } : {}), ...(est.t.restMin ? { restMin: Math.round(est.t.restMin) } : {}) } };
      }
      if (state.params.transit?.back && state.origin && !judged.verdict.unavailable && !judged.verdict.rules.some((r) => r.rule === "transit")) {
        const last = state.candidates.find((c) => c.id === judged.orderIds[judged.orderIds.length - 1]);
        if (last) judged = { ...judged, verdict: await withTransitBack(judged.verdict, last.coordinates, state.origin, state.params) };
      }
      if (!cached) state.checks = rememberCheck(state, picked.map((c) => c.id), ordered, judged);
      if (name === "estimate_walk") {
        return { output: JSON.stringify({ walkKm: judged.verdict.walkKm, walkMin: judged.verdict.walkMin, ...(judged.verdict.climbMin !== undefined ? { climbMin: judged.verdict.climbMin } : {}), visitMin: judged.verdict.visitMin, totalMin: judged.verdict.totalMin, legs: est.legs.map((l, i) => { const at = judged.verdict.schedule?.find((x) => x.id === est.order[i]?.id)?.arrive; return at ? { ...l, arrive: at } : l; }), ...(est.ignored.length ? { stop_plan_ignored: est.ignored } : {}), verdict: judged.verdict, ...(judged.alternatives?.length ? { alternatives: judged.alternatives } : {}) }), state };
      }
      if (!state.limitsSettled) {
        return { output: JSON.stringify({ error: "limits not asked yet: call ask_limits first" }), state };
      }
      // A walk this long is a wrong start point or a wrong place, not a request: say so instead of building it.
      const plausibleKm = Math.max(MAX_PLAUSIBLE_WALK_KM, state.params.maxWalkKm ?? 0, state.params.timeMinutes ? (state.params.timeMinutes / (state.params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM)) : 0);
      if (judged.verdict.walkKm > plausibleKm) {
        return { output: JSON.stringify({ error: `this walk is ${Math.round(judged.verdict.walkKm)} km: too long to walk. Check the start point (${coarseCoords(state.origin)}) and the places, and tell the walker.`, verdict: judged.verdict }), state };
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
        action: { type: "build", origin, params: state.params, stops, ...(args.ordered === true ? { ordered: true } : {}), ...(builtGeometry ? { geometry: builtGeometry } : {}), ...(builtVerdict?.restMin ? { restMin: builtVerdict.restMin } : {}) },
      };
    }
  } catch (err) {
    console.error(`[assistant] tool ${name} failed:`, redactForLog(err));
    return { output: JSON.stringify({ error: "lookup failed, try again or say so" }), state };
  }
  return { output: JSON.stringify({ error: "unknown tool" }), state };
}
